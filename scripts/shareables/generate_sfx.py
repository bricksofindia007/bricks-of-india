#!/usr/bin/env python3
"""
BOI Shareables — SFX generation.

Closes the manual gap in Phase 5: calls ElevenLabs Sound Effects for every
sfx_cues[].description in manifest.json and writes each cue to the exact
path postprocess.py already reads (assets/shareables/sfx/{slug}/cue-{N}.*
via sfx_dir.glob(f"cue-{i}.*")). Does not touch Kling, postprocess.py's
logic, or the manifest schema.

Secret reuse: ELEVENLABS_API_KEY_ASMR, the same key scripts/video already
uses for ElevenLabs Sound Effects (scripts/video/gen_sfx_candidates.py) --
its own .env.example comment documents it as scoped to "TTS + Sound
Effects + Voices", for the Quiet Panic format, separate quota from
ELEVENLABS_API_KEY (VID-P4's TTS-only key). Loaded via scripts/video's
existing secrets_util.get_secret() (BOM-safe) and scripts/video/.env --
reused directly, not duplicated into a new .env.

SDK: elevenlabs.client.ElevenLabs().text_to_sound_effects.convert() --
the same call gen_sfx_candidates.py already makes, not a hand-rolled HTTP
request. duration_seconds is deliberately omitted (not passed) so the API
auto-estimates length for these short one-shot event sounds, instead of
forcing a fixed duration meant for continuous texture beds.

Usage:
  python generate_sfx.py --dry-run                  # list what would be generated, no API calls
  python generate_sfx.py --clip-id 1                 # generate only clip #1's cues
  python generate_sfx.py                             # generate every missing cue for all 27 clips
  python generate_sfx.py --clip-id 1 --force          # regenerate even if the file already exists
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent
REPO_ROOT = BASE_DIR.parent.parent
VIDEO_DIR = REPO_ROOT / "scripts" / "video"
DEFAULT_MANIFEST = BASE_DIR / "manifest.json"

sys.path.insert(0, str(VIDEO_DIR))
from secrets_util import get_secret  # noqa: E402 -- reused, not reimplemented

from dotenv import load_dotenv  # noqa: E402

load_dotenv(VIDEO_DIR / ".env")  # same .env scripts/video already uses -- not a new one


def load_manifest(manifest_path: Path) -> dict:
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def iter_targets(manifest: dict, clip_id: int | None):
    """Yields (clip, cue_index, description, output_path) for every cue,
    optionally scoped to a single clip_id."""
    for clip in manifest["clips"]:
        if clip_id is not None and clip["id"] != clip_id:
            continue
        sfx_dir = REPO_ROOT / clip["assets"]["sfx_dir"]
        for i, cue in enumerate(clip["sfx_cues"], start=1):
            out_path = sfx_dir / f"cue-{i}.mp3"
            yield clip, i, cue["description"], out_path


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    ap.add_argument("--clip-id", type=int, default=None, help="Only generate this clip's cues (1-27). Default: all 27.")
    ap.add_argument("--force", action="store_true", help="Regenerate even if the output file already exists (default: skip existing).")
    ap.add_argument("--dry-run", action="store_true", help="List what would be generated and how many API calls that is. No API calls made.")
    args = ap.parse_args()

    manifest = load_manifest(args.manifest)
    targets = list(iter_targets(manifest, args.clip_id))

    to_generate = [(c, i, desc, p) for c, i, desc, p in targets if args.force or not p.exists()]
    skipped = len(targets) - len(to_generate)

    if args.dry_run:
        for clip, i, desc, out_path in to_generate:
            print(f"Would generate: clip {clip['id']:2d} ({clip['occasion']}) cue-{i} -> {out_path.relative_to(REPO_ROOT)} — {desc!r}")
        print(f"\nDry run: {len(to_generate)} API call(s) would be made, {skipped} cue(s) already exist and would be skipped (use --force to regenerate).")
        return

    api_key = get_secret("ELEVENLABS_API_KEY_ASMR")
    if not api_key:
        print("ERROR: ELEVENLABS_API_KEY_ASMR not set (checked scripts/video/.env and environment).", file=sys.stderr)
        sys.exit(1)

    from elevenlabs.client import ElevenLabs
    client = ElevenLabs(api_key=api_key)

    generated, failed = 0, 0
    for clip, i, desc, out_path in to_generate:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Generating clip {clip['id']:2d} ({clip['occasion']}) cue-{i}: {desc!r} ...")
        try:
            # duration_seconds intentionally omitted -- auto-estimated by
            # the API for these short one-shot event sounds.
            audio = client.text_to_sound_effects.convert(text=desc)
            with open(out_path, "wb") as f:
                for chunk in audio:
                    f.write(chunk)
            size_kb = out_path.stat().st_size / 1024
            print(f"  -> {out_path.relative_to(REPO_ROOT)} ({size_kb:.1f}KB)")
            generated += 1
        except Exception as e:
            print(f"  FAILED: {e}", file=sys.stderr)
            failed += 1

    print(f"\nDone: {generated} generated, {skipped} skipped (already existed), {failed} failed.")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()

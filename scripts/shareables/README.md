# BOI Shareables — post-production pipeline

Phase 5 of the [BOI Shareables project](../../docs/shareables/BOI_Shareables_Master_Production_Script_FINAL.md).
Turns a raw Kling clip into the final shareable asset: loop-trimmed,
captioned, watermarked, SFX placed at locked timestamps.

**Phase status (2026-08-08):** Phase 1 (creative lock) done. Phases 2-4
(reference photography, Kling tool setup, generation) not started — this
script has been built and tested against dummy/placeholder assets only.
No real Kling footage or ElevenLabs SFX exist yet.

## Files

- `build_manifest.py` — generates `manifest.json` from the 27 clips
  transcribed from the FINAL doc. Creative content (scene, caption,
  sfx_cues, kling_prompt, notes) is LOCKED per Phase 1 — to change it,
  edit the FINAL doc first, then this file's `CLIPS` list, then rerun.
  Re-run with `python build_manifest.py` whenever `CLIPS` changes.
- `manifest.json` — generated output, single source of truth read by both
  this pipeline and the `/shareables` Next.js route
  (`src/lib/shareables.ts`). Don't hand-edit; regenerate instead.
- `postprocess.py` — the actual post-production script. No per-clip data
  is hardcoded in it; everything comes from `manifest.json`.
- `requirements.txt` — pinned to match `scripts/video/requirements.txt`'s
  moviepy/numpy/Pillow versions for consistency with the existing video
  pipeline (including the `Image.ANTIALIAS` compat patch it also needs).

## manifest.json schema (per clip)

```
{
  "id": 1,
  "slug": "01-clumsy-tech",
  "occasion": "Clumsy Tech",
  "category": "Flagship Website Intros",
  "source_tag": "D1",
  "raw_duration_s": 10,          // Kling render duration (10 or 5)
  "caption": "...",              // LOCKED
  "scene": "...",                // LOCKED (creative reference only, not used by postprocess.py)
  "kling_prompt": "...",         // LOCKED (for Phase 4, not used by postprocess.py)
  "post_production_notes": "...", "alignment_note": "...",  // LOCKED, may be null
  "sfx_cues": [{"timestamp_s": 3, "description": "..."}, ...],  // LOCKED; timestamp_s is
                                  // null for 5 clips with a single untimed cue
  "loop_trim": {"in_s": 0.0, "out_s": 5.0, "status": "placeholder"},  // NOT locked --
                                  // placeholder, must be re-tuned per clip once real
                                  // footage exists to find the actual seamless loop point
  "assets": {
    "raw_input": "assets/shareables/raw/01-clumsy-tech.mp4",     // where Phase 4 output lands
    "sfx_dir": "assets/shareables/sfx/01-clumsy-tech/",          // cue-1.*, cue-2.*, ...
    "public_output": "public/shareables/01-clumsy-tech.mp4"       // where Phase 5 output is served from
  }
}
```

SFX cue timestamps are on the **raw clip's** timeline (as authored in the
FINAL doc). `postprocess.py` remaps them relative to `loop_trim.in_s` and
drops any cue that falls outside `[in_s, out_s)` — this matters because
the final loop (4-6s) is shorter than the 10s raw clip for 19 of the 27
entries, so re-tuning `loop_trim` later may push some cues out of range
and is worth a manual pass once real footage exists.

## Usage

```
pip install -r requirements.txt

python postprocess.py --clip-id 1 \
  --input path/to/raw_kling_clip.mp4 \
  --output path/to/output.mp4
```

`--sfx-dir` defaults to the manifest's `assets.sfx_dir`; missing SFX files
are skipped with a `WARN`, not a hard failure, so the script runs cleanly
against partial or placeholder asset sets.

## Test fixtures (dummy assets, not real content)

`assets/shareables/raw/01-clumsy-tech.mp4` and
`assets/shareables/sfx/01-clumsy-tech/cue-1.mp3` are synthetic
placeholders (ffmpeg `testsrc` + `sine` tone) — **not** real Kling/
ElevenLabs output. They exist to prove the pipeline runs end-to-end
against clip #1's real caption/SFX config before any real assets exist.
Regenerate with:

```
ffmpeg -y -f lavfi -i "testsrc=size=1080x1920:rate=30:duration=10" -an \
  -c:v libx264 -pix_fmt yuv420p -t 10 assets/shareables/raw/01-clumsy-tech.mp4

ffmpeg -y -f lavfi -i "sine=frequency=110:duration=0.4" -ar 44100 -ac 2 -q:a 4 \
  assets/shareables/sfx/01-clumsy-tech/cue-1.mp3
```

Verified output (2026-08-08): 1080x1920, h264/aac, 5.00s, 0.33MB — well
within the 4-6s / 5MB spec. Caption and watermark burn-in confirmed
visually via an extracted frame.

## Known placeholders (flagged for review before Phase 4)

- `loop_trim` values are a uniform default (first 5s of 10s clips, full
  length of 5s clips), not tuned per clip.
- The watermark is a generated "BRICKS OF INDIA" text wordmark (PIL,
  Fredoka SemiBold, brand yellow, ~12% opacity), not a real logo asset —
  no suitable small logo mark exists in `public/brand` or `public/mascots`
  today (those are full illustrations/photos). Swap in a real mark if one
  gets designed.

#!/usr/bin/env python3
"""
BOI Shareables — Phase 5 post-production script.

Takes one raw Kling MP4 clip + its manifest.json entry and produces the
final shareable: loop-trimmed, captioned, watermarked, with SFX placed at
the manifest's timestamps. No per-clip creative data is hardcoded here —
everything (caption text, SFX cues, loop trim points) comes from
manifest.json (see build_manifest.py, which generates it from the locked
FINAL doc). This script only knows how to apply that data to a video.

Style note: caption/watermark burn-in uses PIL + moviepy ImageClip
compositing, not moviepy TextClip — same choice and same reason as
scripts/video/engine.py::burn_captions (TextClip needs ImageMagick; PIL
keeps this pipeline dependency-free and consistent with the existing
video pipeline).

Usage:
  python postprocess.py --clip-id 1 --input path/to/raw.mp4 --output path/to/out.mp4
  python postprocess.py --clip-id 4 --input raw/holi.mp4 --output out/holi.mp4 --sfx-dir assets/shareables/sfx/04-holi

Missing SFX files are skipped with a warning, not a hard failure — this
lets the pipeline run end-to-end against dummy/placeholder assets before
Phase 2-4 (photography, tool setup, Kling generation, ElevenLabs SFX)
deliver the real files.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

# moviepy 1.x calls PIL.Image.ANTIALIAS, removed in Pillow >=10. Same patch
# as scripts/video/engine.py -- required before any moviepy .resize() call
# with Pillow 10.3.0 installed in this repo's environment.
from PIL import Image, ImageDraw, ImageFont
if not hasattr(Image, "ANTIALIAS"):
    Image.ANTIALIAS = Image.LANCZOS

from moviepy.editor import (  # noqa: E402
    AudioFileClip,
    CompositeAudioClip,
    CompositeVideoClip,
    ImageClip,
    VideoClip,
    VideoFileClip,
)
from moviepy.video.fx.all import crop  # noqa: E402

BASE_DIR = Path(__file__).parent
REPO_ROOT = BASE_DIR.parent.parent
DEFAULT_MANIFEST = BASE_DIR / "manifest.json"

TARGET_W, TARGET_H = 1080, 1920  # matches scripts/video/engine.py
FPS = 30

_CAPTION_FONT_CANDIDATES = [
    str(REPO_ROOT / "scripts" / "video" / "fonts" / "Fredoka-SemiBold.ttf"),
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def _font(size: int):
    for path in _CAPTION_FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except (IOError, OSError):
            continue
    return ImageFont.load_default()


def load_manifest(manifest_path: Path) -> dict:
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def get_clip(manifest: dict, clip_id: int) -> dict:
    for c in manifest["clips"]:
        if c["id"] == clip_id:
            return c
    raise SystemExit(f"clip id {clip_id} not found in manifest ({len(manifest['clips'])} clips)")


def _wrap_text(draw, text: str, font, max_width: int) -> list[str]:
    words = text.split()
    lines, line = [], ""
    for word in words:
        test = (line + " " + word).strip()
        if draw.textbbox((0, 0), test, font=font)[2] > max_width and line:
            lines.append(line)
            line = word
        else:
            line = test
    if line:
        lines.append(line)
    return lines


def make_caption_clip(text: str, duration: float) -> VideoClip:
    """Static bottom-third caption for the clip's full duration -- white
    fill, dark outline, matching engine.py::burn_captions' approved v1
    style. Unlike engine.py this is one caption for the whole clip (no
    per-segment timing), since Shareables captions are a single line, not
    transcribed dialogue."""
    font = _font(56)
    max_width = int(TARGET_W * 0.85)
    caption_y = int(TARGET_H * 0.78)

    frame = np.zeros((TARGET_H, TARGET_W, 4), dtype=np.uint8)
    img = Image.fromarray(frame, "RGBA")
    draw = ImageDraw.Draw(img)
    lines = _wrap_text(draw, text, font, max_width)
    line_height = int(font.size * 1.3)
    total_h = line_height * len(lines)
    y = caption_y - total_h // 2
    for line in lines:
        w = draw.textbbox((0, 0), line, font=font)[2]
        x = (TARGET_W - w) // 2
        for dx, dy in ((-2, -2), (-2, 2), (2, -2), (2, 2), (-2, 0), (2, 0), (0, -2), (0, 2)):
            draw.text((x + dx, y + dy), line, font=font, fill=(0, 0, 0, 255))
        draw.text((x, y), line, font=font, fill=(255, 255, 255, 255))
        y += line_height

    arr = np.array(img)
    clip = ImageClip(arr, transparent=True).set_duration(duration)
    return clip


_BOI_YELLOW = (255, 199, 44)  # #FFC72C


def make_watermark_clip(duration: float, opacity: float) -> VideoClip:
    """Bottom-right 'BRICKS OF INDIA' wordmark, semi-transparent per spec
    (10-15% opacity). Generated via PIL rather than shipping a pre-baked
    PNG so opacity/position stay config-driven, matching the
    'no hardcoded per-clip data' spirit for the technical (non-creative)
    parts of this script too."""
    font = _font(34)
    text = "BRICKS OF INDIA"
    probe = Image.new("RGBA", (10, 10))
    draw = ImageDraw.Draw(probe)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]

    pad = 16
    img = Image.new("RGBA", (text_w + pad * 2, text_h + pad * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    alpha = int(255 * opacity)
    draw.text((pad - bbox[0], pad - bbox[1]), text, font=font, fill=(*_BOI_YELLOW, alpha))

    margin = 40
    arr = np.array(img)
    clip = (
        ImageClip(arr, transparent=True)
        .set_duration(duration)
        .set_position((TARGET_W - arr.shape[1] - margin, TARGET_H - arr.shape[0] - margin))
    )
    return clip


def fit_to_target(clip: VideoFileClip) -> VideoFileClip:
    """Resize-then-center-crop to exactly TARGET_W x TARGET_H, preserving
    aspect ratio (covers the frame, crops overflow) rather than
    stretching. No-ops cleanly if the source is already 1080x1920."""
    src_ratio = clip.w / clip.h
    target_ratio = TARGET_W / TARGET_H
    if src_ratio > target_ratio:
        clip = clip.resize(height=TARGET_H)
    else:
        clip = clip.resize(width=TARGET_W)
    return crop(clip, width=TARGET_W, height=TARGET_H, x_center=clip.w / 2, y_center=clip.h / 2)


def build_sfx_audio(clip_entry: dict, sfx_dir: Path, trim_in: float, trim_out: float):
    """Loads whichever SFX cue files exist under sfx_dir, remaps their
    timestamps to be relative to trim_in, drops cues outside the trimmed
    loop window, and returns a CompositeAudioClip (or None if nothing
    could be placed). Missing files are warned, not fatal."""
    audio_clips = []
    for i, cue in enumerate(clip_entry["sfx_cues"], start=1):
        candidates = sorted(sfx_dir.glob(f"cue-{i}.*")) if sfx_dir.exists() else []
        if not candidates:
            print(f"WARN: no SFX file for cue {i} ({cue['description']!r}) in {sfx_dir} — skipping", file=sys.stderr)
            continue
        ts = cue["timestamp_s"]
        if ts is None:
            # Untimed single-cue clips: place at the trimmed loop's midpoint.
            ts = (trim_out - trim_in) / 2 + trim_in
        if not (trim_in <= ts < trim_out):
            print(f"WARN: cue {i} timestamp {ts}s falls outside loop window [{trim_in}, {trim_out}) — skipping", file=sys.stderr)
            continue
        local_t = ts - trim_in
        a = AudioFileClip(str(candidates[0])).set_start(local_t)
        audio_clips.append(a)
    if not audio_clips:
        return None
    return CompositeAudioClip(audio_clips)


def process_clip(
    clip_entry: dict,
    input_path: Path,
    output_path: Path,
    sfx_dir: Path,
    watermark_opacity: float,
    max_size_mb: float,
) -> None:
    trim_in = clip_entry["loop_trim"]["in_s"]
    trim_out = clip_entry["loop_trim"]["out_s"]

    base = VideoFileClip(str(input_path)).subclip(trim_in, trim_out)
    base = fit_to_target(base)
    duration = base.duration

    caption_clip = make_caption_clip(clip_entry["caption"], duration)
    watermark_clip = make_watermark_clip(duration, watermark_opacity)

    sfx_audio = build_sfx_audio(clip_entry, sfx_dir, trim_in, trim_out)
    if sfx_audio is not None:
        layers = [sfx_audio] + ([base.audio] if base.audio is not None else [])
        final_audio = CompositeAudioClip(layers) if len(layers) > 1 else sfx_audio
    else:
        final_audio = base.audio  # may be None -- silent output is fine

    final = CompositeVideoClip([base, caption_clip, watermark_clip])
    if final_audio is not None:
        final = final.set_audio(final_audio)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    final.write_videofile(
        str(output_path),
        fps=FPS,
        codec="libx264",
        audio_codec="aac" if final_audio is not None else None,
        audio=final_audio is not None,
        ffmpeg_params=["-crf", "23", "-pix_fmt", "yuv420p"],
        logger=None,
    )
    base.close()

    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"Wrote {output_path} — {duration:.2f}s, {base.w if hasattr(base,'w') else TARGET_W}x{TARGET_H}, {size_mb:.2f}MB")
    if size_mb > max_size_mb:
        print(f"WARN: output is {size_mb:.2f}MB, over the {max_size_mb}MB spec — re-tune crf/bitrate once real footage is in.", file=sys.stderr)
    if not (4.0 <= duration <= 6.0):
        print(f"WARN: output duration {duration:.2f}s is outside the 4-6s loop spec — check loop_trim in manifest.json for this clip.", file=sys.stderr)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--clip-id", type=int, required=True, help="Clip id (1-27) from manifest.json")
    ap.add_argument("--input", type=Path, required=True, help="Path to the raw Kling MP4 (or placeholder/dummy clip)")
    ap.add_argument("--output", type=Path, required=True, help="Path to write the post-processed MP4")
    ap.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST, help="Path to manifest.json")
    ap.add_argument("--sfx-dir", type=Path, default=None, help="Directory containing this clip's SFX files (cue-1.*, cue-2.*, ...). Defaults to the manifest's assets.sfx_dir.")
    ap.add_argument("--watermark-opacity", type=float, default=None, help="Overrides manifest global.watermark.opacity (0-1)")
    args = ap.parse_args()

    manifest = load_manifest(args.manifest)
    clip_entry = get_clip(manifest, args.clip_id)

    sfx_dir = args.sfx_dir or (REPO_ROOT / clip_entry["assets"]["sfx_dir"])
    opacity = args.watermark_opacity if args.watermark_opacity is not None else manifest["global"]["watermark"]["opacity"]
    max_size_mb = manifest["global"]["output_spec"]["max_size_mb"]

    process_clip(clip_entry, args.input, args.output, sfx_dir, opacity, max_size_mb)


if __name__ == "__main__":
    main()

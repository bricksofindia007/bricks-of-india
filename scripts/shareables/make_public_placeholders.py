#!/usr/bin/env python3
"""
Generates a generic "Coming Soon" placeholder MP4 and copies it to every
clip's public_output path (from manifest.json) under public/shareables/.

This is NOT part of the Phase 5 post-production pipeline (postprocess.py
never calls this) — it exists purely so Phase 7's /shareables page has a
real file at every download link today, instead of 27 broken links,
while Phases 2-4 are still pending. Re-run postprocess.py per clip once
real Kling+SFX assets exist; its output overwrites these placeholders at
the exact same paths.

Usage:
  python make_public_placeholders.py
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BASE_DIR = Path(__file__).parent
REPO_ROOT = BASE_DIR.parent.parent
MANIFEST_PATH = BASE_DIR / "manifest.json"
FONT_PATH = REPO_ROOT / "scripts" / "video" / "fonts" / "Fredoka-SemiBold.ttf"

TARGET_W, TARGET_H = 1080, 1920
_BOI_NAVY = (26, 35, 50)     # #1a2332, matches engine.py::_BOI_NAVY
_BOI_YELLOW = (255, 199, 44)  # #FFC72C, matches engine.py::_BOI_YELLOW


def render_placeholder_png(png_path: Path) -> None:
    img = Image.new("RGB", (TARGET_W, TARGET_H), color=_BOI_NAVY)
    draw = ImageDraw.Draw(img)
    font_big = ImageFont.truetype(str(FONT_PATH), 84)
    font_small = ImageFont.truetype(str(FONT_PATH), 36)

    text1 = "BOI Shareables"
    text2 = "Coming Soon"
    for text, font, y in ((text1, font_small, TARGET_H // 2 - 90), (text2, font_big, TARGET_H // 2 - 20)):
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        draw.text(((TARGET_W - w) / 2, y), text, font=font, fill=_BOI_YELLOW)

    img.save(png_path)


def render_placeholder_mp4(png_path: Path, mp4_path: Path, duration_s: float = 3.0) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-loop", "1", "-i", str(png_path),
            "-t", str(duration_s), "-an",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-vf", f"scale={TARGET_W}:{TARGET_H}",
            str(mp4_path),
        ],
        check=True,
        capture_output=True,
    )


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    tmp_dir = BASE_DIR / "_tmp_placeholder"
    tmp_dir.mkdir(exist_ok=True)
    png_path = tmp_dir / "coming_soon.png"
    source_mp4 = tmp_dir / "coming_soon.mp4"

    render_placeholder_png(png_path)
    render_placeholder_mp4(png_path, source_mp4)

    count = 0
    for clip in manifest["clips"]:
        dest = REPO_ROOT / clip["assets"]["public_output"]
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(source_mp4, dest)
        count += 1

    shutil.rmtree(tmp_dir)
    print(f"Wrote {count} placeholder MP4s under public/shareables/")


if __name__ == "__main__":
    main()

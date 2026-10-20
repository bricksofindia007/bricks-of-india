#!/usr/bin/env python3
"""Throwaway: side-by-side image of old pins (left) and new pins (right), with a pixel-difference line.

Usage: pins_compare.py <old_dir> <new_dir> <out_dir>. Writes <name>_side_by_side.png and prints the
differing-pixel count for each image. Reads only; no network.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

old_dir, new_dir, out_dir = (Path(a) for a in sys.argv[1:4])
out_dir.mkdir(parents=True, exist_ok=True)
for name in ['shorts_overlay.png', 'placeholder.png']:
    a = Image.open(old_dir / name).convert('RGB')
    b = Image.open(new_dir / name).convert('RGB')
    diff = np.abs(np.asarray(a).astype(int) - np.asarray(b).astype(int)).sum(axis=2) > 0
    gap = 40
    canvas = Image.new('RGB', (a.width + b.width + gap, max(a.height, b.height) + 60), (255, 255, 255))
    canvas.paste(a, (0, 60))
    canvas.paste(b, (a.width + gap, 60))
    d = ImageDraw.Draw(canvas)
    d.text((10, 10), f'OLD pins (Pillow 10.3.0)   {name}', fill=(0, 0, 0))
    d.text((a.width + gap + 10, 10), f'NEW pins (Pillow 12.3.0)   {name}', fill=(0, 0, 0))
    canvas.save(out_dir / name.replace('.png', '_side_by_side.png'))
    print(f'{name}: differing pixels {int(diff.sum())} of {diff.size}; sizes {a.size} {b.size}')

#!/usr/bin/env python3
"""Throwaway: write the shorts text overlay and the placeholder PNG under the pins in this environment.

Usage: pins_artifacts.py <outdir>. Both images are composited on a flat grey background so the text
is visible in a side-by-side view. No network, no posting, no secrets.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'social-automation'))
sys.path.insert(0, str(ROOT / 'scripts' / 'shareables'))

outdir = Path(sys.argv[1])
outdir.mkdir(parents=True, exist_ok=True)

import media_processor as mp  # noqa: E402
import make_public_placeholders as mpp  # noqa: E402

set_data = {'set_num': '99001', 'name': 'Exercise Set With A Longer Name', 'theme': 'Technic', 'year': 2026,
            'num_parts': 1234, 'india_price': '₹12,999', 'source': 'lego_coming_soon'}

overlay = mp._make_shorts_text_overlay(1080, 1920, set_data, False)  # RGBA (H, W, 4)
bg = Image.new('RGBA', (1080, 1920), (120, 120, 120, 255))
composed = Image.alpha_composite(bg, Image.fromarray(overlay.astype(np.uint8), 'RGBA'))
composed.convert('RGB').save(outdir / 'shorts_overlay.png')

mpp.render_placeholder_png(outdir / 'placeholder.png')

print('wrote', sorted(p.name for p in outdir.iterdir()))

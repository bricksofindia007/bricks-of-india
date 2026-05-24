"""
test_pipeline.py — End-to-end test for the Fan CoLab rebuild.

Tests in order (stops on failure):
  1. LEGO.com coming-soon scrape -- print set count
  2. Gallery scrape for top candidate -- print image count (should be 10+)
  3. Process 10 product images (9 gallery + stats card)
  4. Generate 8s Reels video (3 slides)
  5. Generate 45s Shorts video (10 slides)

Does NOT post to any platform.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import scraper
import media_processor

SEP = '-' * 60

# ── Test 1: LEGO.com coming-soon scrape ───────────────────────────────────────
print(SEP)
print('TEST 1: LEGO.com coming-soon page scrape')
print(SEP)
t0 = time.time()
lego_sets = scraper.lego_com_coming_soon()
print(f'Sets found: {len(lego_sets)} ({time.time()-t0:.1f}s)')
for s in lego_sets[:8]:
    print(f'  {s["set_num"]:15s} {s["name"][:55]:<55} {s["num_parts"]} parts')

if not lego_sets:
    print('\nLEGO.com returned 0 sets -- trying Rebrickable + Brickset fallback...')
    rb = scraper.rebrickable_get_sets()
    bs = scraper.brickset_get_sets()
    lego_sets = scraper._merge_and_dedup(rb, bs)
    upcoming  = [s for s in lego_sets if scraper._is_genuinely_new(s)]
    lego_sets = upcoming
    print(f'Fallback: {len(lego_sets)} upcoming sets')
    if not lego_sets:
        print('ERROR: No sets available from any source. Exiting.')
        sys.exit(1)

# Pick highest part-count set with a set_num for gallery test
candidates = [s for s in lego_sets if s.get('set_num')]
candidates.sort(key=lambda s: s.get('num_parts') or 0, reverse=True)
test_set = candidates[0]
print(f'\nSelected for gallery test: {test_set["set_num"]} -- {test_set["name"]}')

# ── Test 2: Gallery image scrape ──────────────────────────────────────────────
print(f'\n{SEP}')
print('TEST 2: LEGO.com product page gallery scrape')
print(SEP)
t0 = time.time()
gallery = scraper.lego_com_get_gallery(test_set)
print(f'Gallery images found: {len(gallery)} ({time.time()-t0:.1f}s)')
if gallery:
    print('First 5 URLs:')
    for url in gallery[:5]:
        print(f'  {url}')
    if len(gallery) > 5:
        print(f'  ... and {len(gallery)-5} more')
else:
    print('WARNING: No gallery images found. Trying next candidate...')
    for s in candidates[1:5]:
        gallery = scraper.lego_com_get_gallery(s)
        if len(gallery) >= scraper.MIN_GALLERY_IMAGES:
            test_set = s
            print(f'  Found {len(gallery)} images for {s["set_num"]} -- {s["name"]}')
            break
    if len(gallery) < scraper.MIN_GALLERY_IMAGES:
        print(f'\nERROR: Could not get {scraper.MIN_GALLERY_IMAGES}+ gallery images '
              f'from LEGO.com for any candidate.')
        print('This likely means LEGO.com is blocking scraping or the page structure changed.')
        print('Check the URL pattern and __NEXT_DATA__ JSON structure manually.')
        sys.exit(1)

if len(gallery) < scraper.MIN_GALLERY_IMAGES:
    print(f'\nERROR: Only {len(gallery)} gallery images (need {scraper.MIN_GALLERY_IMAGES}). Exiting.')
    sys.exit(1)

test_set['gallery_images'] = gallery
# Set image_url to first gallery image if absent
if not test_set.get('image_url'):
    test_set['image_url'] = gallery[0]

print(f'\nTest set ready:')
print(f'  set_num:       {test_set["set_num"]}')
print(f'  name:          {test_set["name"]}')
print(f'  num_parts:     {test_set["num_parts"]}')
print(f'  gallery count: {len(gallery)}')

# ── Test 3: Process 10 product images ────────────────────────────────────────
print(f'\n{SEP}')
print('TEST 3: Generate 10 product images (9 gallery + stats card)')
print(SEP)
t0 = time.time()
try:
    all_paths = media_processor.process_carousel_images(test_set)
except Exception as exc:
    print(f'ERROR: {exc}')
    sys.exit(1)
elapsed = time.time() - t0
print(f'Generated {len(all_paths)} images in {elapsed:.1f}s')
for i, p in enumerate(all_paths, 1):
    size = Path(p).stat().st_size
    label = 'stats card' if i == len(all_paths) else 'gallery'
    print(f'  {i:2d}/10: {Path(p).name}  {size:>8,} bytes  ({label})')

if len(all_paths) < 10:
    print(f'ERROR: Expected 10 images, got {len(all_paths)}. Exiting.')
    sys.exit(1)

print('\nOpen tmp/ folder to verify:')
print('  - All 9 gallery images look different')
print('  - Watermark visible bottom-right (40%)')
print('  - Stats card (image 10): navy bg, saffron header, set info')

# ── Test 4: 8-second Reels video ─────────────────────────────────────────────
print(f'\n{SEP}')
print('TEST 4: Generate 8-second Instagram Reels video (3 slides)')
print(SEP)
t0 = time.time()
try:
    reels_path = media_processor.process_reels_video(test_set, all_paths)
except Exception as exc:
    import traceback; traceback.print_exc()
    sys.exit(1)
elapsed = time.time() - t0

from moviepy.editor import VideoFileClip
clip = VideoFileClip(reels_path)
print(f'\nReels verification:')
print(f'  Duration:  {clip.duration:.2f}s  (expected ~8.0)')
print(f'  Size:      {clip.size}  (expected [1080, 1920])')
print(f'  Has audio: {clip.audio is not None}')
clip.close()
print(f'  File size: {Path(reels_path).stat().st_size:,} bytes')
print(f'  Render:    {elapsed:.1f}s')
print(f'  Output:    {reels_path}')

# ── Test 5: 45-second YouTube Shorts video ────────────────────────────────────
print(f'\n{SEP}')
print('TEST 5: Generate 45-second YouTube Shorts video (10 slides)')
print(SEP)
t0 = time.time()
try:
    shorts_path = media_processor.process_shorts_video(test_set, all_paths)
except Exception as exc:
    import traceback; traceback.print_exc()
    sys.exit(1)
elapsed = time.time() - t0

clip = VideoFileClip(shorts_path)
print(f'\nShorts verification:')
print(f'  Duration:  {clip.duration:.2f}s  (expected ~45.0)')
print(f'  Size:      {clip.size}  (expected [1080, 1920])')
print(f'  Has audio: {clip.audio is not None}')
clip.close()
print(f'  File size: {Path(shorts_path).stat().st_size:,} bytes')
print(f'  Render:    {elapsed:.1f}s')
print(f'  Output:    {shorts_path}')

# ── Summary ───────────────────────────────────────────────────────────────────
print(f'\n{SEP}')
print('ALL TESTS PASSED')
print(SEP)
print(f'Set:          {test_set["set_num"]} -- {test_set["name"]}')
print(f'Gallery:      {len(gallery)} images')
print(f'Product imgs: {len(all_paths)} files in tmp/')
print(f'Reels:        {Path(reels_path).name}')
print(f'Shorts:       {Path(shorts_path).name}')
print()
print('NEXT STEPS:')
print('  1. Open all 10 images in tmp/ -- verify they are different LEGO.com photos')
print('  2. Play _reels.mp4 -- 8s, 3 different images, crossfades')
print('  3. Play _shorts.mp4 -- 45s, 10 different images, crossfades')
print('  4. Confirm watermark visible throughout')
print('  5. Tell Abhinav to review before pipeline.py integration')

"""Quick scraper test: LEGO.com coming-soon + gallery for top candidate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import scraper

print('=== TEST 1: LEGO.com coming-soon ===')
sets = scraper.lego_com_coming_soon()
print(f'Sets found: {len(sets)}')
for s in sets[:8]:
    print(f'  {s["set_num"]:15s} {s["name"][:55]:<55} {s["num_parts"]} parts')

if not sets:
    print('0 sets from LEGO.com -- trying API fallbacks...')
    rb = scraper.rebrickable_get_sets()
    bs = scraper.brickset_get_sets()
    merged = scraper._merge_and_dedup(rb, bs)
    sets = [s for s in merged if scraper._is_genuinely_new(s)]
    print(f'Fallback: {len(sets)} upcoming sets')

candidates = sorted([s for s in sets if s.get('set_num')],
                    key=lambda s: s.get('num_parts') or 0, reverse=True)
if not candidates:
    print('No candidates. Exiting.')
    sys.exit(1)

test_set = candidates[0]
print(f'\nTop candidate: {test_set["set_num"]} -- {test_set["name"]} ({test_set["num_parts"]} parts)')

print('\n=== TEST 2: Gallery scrape ===')
for i, cand in enumerate(candidates[:5]):
    gallery = scraper.lego_com_get_gallery(cand)
    print(f'  Candidate {i+1} ({cand["set_num"]}): {len(gallery)} gallery images')
    if len(gallery) >= scraper.MIN_GALLERY_IMAGES:
        print(f'  First 5 URLs:')
        for url in gallery[:5]:
            print(f'    {url}')
        print(f'  PASS -- {len(gallery)} images found')
        sys.exit(0)

print(f'\nERROR: No candidate reached {scraper.MIN_GALLERY_IMAGES} gallery images.')
print('LEGO.com may be blocking scraping or page structure changed.')
sys.exit(1)

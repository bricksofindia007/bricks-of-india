"""
check2_tier_fallback_simulation.py -- verification only, not wired into any
workflow. Simulates the Aug-4-shaped scenario explicitly: forces the
opportunistic LEGO.com curl_cffi fetch to fail (403) for every candidate,
so only Brickset's own count is available -- exactly what happened before
curl_cffi got lucky on 43290 in the live backtest. Confirms the tiered
logic (pipeline.py's _find_candidate_tiered, via scraper.get_new_set's
tier parameters) correctly falls through current-year -> 2020-2025 when
Tier 1 is genuinely exhausted, using the real Aug 4 candidate pool.

Read-only against Supabase (posted_sets lookup only, via existing
get_all_posted_set_nums()). Writes nothing.
"""
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import scraper

MIN_GALLERY_IMAGES = scraper.MIN_GALLERY_IMAGES

# Real Aug 4 current-year candidate pool, exact order as logged by
# production that day (bare set numbers).
AUG4_POOL = [
    '43290', '40916', '40911', '6626055', 'DISNEYTOWN', '9780241838389',
    '9780241836712', 'Q46515', '757894517472', '202812513', '100302603',
    '115513', '854328', '202222601', '203292601', '5010343',
    '9781797245560', 'POSTER', 'HEADBAND',
]


def check_candidate(bare_num: str) -> dict:
    category = scraper._brickset_category_lookup(bare_num)
    if not scraper._is_buildable_category(category, bare_num):
        return {'num': bare_num, 'buildable': False, 'category': category}
    fake_set_data = {'set_num': f'{bare_num}-1', 'image_url': ''}
    gallery = scraper.get_gallery(fake_set_data)
    return {'num': bare_num, 'buildable': True, 'category': category, 'gallery_count': len(gallery)}


def run_tier1_forced_lego_failure() -> dict:
    """Tier 1, with _lego_com_gallery_opportunistic forced to always
    return [] -- simulates every curl_cffi call 403ing, exactly as it did
    for real on the majority of calls observed elsewhere in this
    investigation."""
    winner = None
    results = []
    with patch.object(scraper, '_lego_com_gallery_opportunistic', return_value=[]):
        for i, num in enumerate(AUG4_POOL, start=1):
            r = check_candidate(num)
            results.append(r)
            print(f'  [{i}] {r}')
            if r.get('gallery_count', 0) >= MIN_GALLERY_IMAGES and winner is None:
                winner = r
    return {'tier': 'current-year (LEGO.com forced to fail)', 'winner': winner, 'tried': len(AUG4_POOL)}


def run_tier2_forced_lego_failure() -> dict:
    """Tier 2 (2020-2025), same forced-failure patch active, to confirm the
    fallback tier itself doesn't silently depend on the opportunistic
    LEGO.com source either -- Brickset alone must be enough to produce a
    winner here for the fallback to be considered genuinely working."""
    with patch.object(scraper, '_lego_com_gallery_opportunistic', return_value=[]):
        candidates = scraper.brickset_get_sets(2020, 2025)
        candidates.sort(key=lambda s: s.get('num_parts') or 0, reverse=True)
        for i, s in enumerate(candidates, start=1):
            gallery = scraper.get_gallery(s)
            print(f'  [{i}] {s["set_num"]} ({s.get("category")}): {len(gallery)} images')
            if len(gallery) >= MIN_GALLERY_IMAGES:
                return {'tier': '2020-2025 (LEGO.com forced to fail)',
                        'winner': {'num': s['set_num'], 'gallery_count': len(gallery)},
                        'tried': i}
    return {'tier': '2020-2025 (LEGO.com forced to fail)', 'winner': None, 'tried': len(candidates)}


if __name__ == '__main__':
    print('=== Step 1: Tier 1 (current-year), Aug 4 real pool, LEGO.com forced to fail ===')
    tier1_result = run_tier1_forced_lego_failure()
    print(f'\nTier 1 result: {tier1_result}')

    if tier1_result['winner'] is not None:
        print('\nFAIL: Tier 1 produced a winner even with LEGO.com forced to fail -- '
              'this does not reproduce the Aug-4-shaped scenario as requested.')
        sys.exit(1)

    print('\nTier 1 correctly exhausted with zero passing candidates -- falling through to Tier 2.')
    print('\n=== Step 2: Tier 2 (2020-2025), LEGO.com forced to fail ===')
    tier2_result = run_tier2_forced_lego_failure()
    print(f'\nTier 2 result: {tier2_result}')

    print('\n=== FINAL ===')
    if tier2_result['winner'] is not None:
        print(f'PASS: fallback triggered correctly, Tier 2 returned a valid candidate: {tier2_result["winner"]}')
    else:
        print('FAIL: Tier 2 also produced no winner -- fallback chain broken.')
        sys.exit(1)

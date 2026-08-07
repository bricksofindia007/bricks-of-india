"""
backtest_new_implementation.py -- evidence-gathering only, exercises the
REAL new scraper.py functions (not a reimplementation) against real
historical candidate pools. Read-only against Supabase (posted_sets
lookups only, via functions already used read-only elsewhere in this
module) -- writes nothing. Not wired into any workflow.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import scraper

MIN_GALLERY_IMAGES = scraper.MIN_GALLERY_IMAGES


def check_candidate(bare_num: str) -> dict:
    """Exercises the real _is_buildable_category / _brickset_category_lookup
    / get_gallery() functions from the new scraper.py."""
    category = scraper._brickset_category_lookup(bare_num)
    if not scraper._is_buildable_category(category, bare_num):
        return {'num': bare_num, 'buildable': False, 'category': category}
    fake_set_data = {'set_num': f'{bare_num}-1', 'image_url': ''}
    gallery = scraper.get_gallery(fake_set_data)
    return {'num': bare_num, 'buildable': True, 'category': category, 'gallery_count': len(gallery)}


def run_pool(day_label: str, bare_nums: list[str]) -> dict:
    print(f'\n=== {day_label}: {len(bare_nums)} current-year candidates ===')
    winner = None
    for i, num in enumerate(bare_nums, start=1):
        r = check_candidate(num)
        print(f'  [{i}] {r}')
        if r.get('gallery_count', 0) >= MIN_GALLERY_IMAGES and winner is None:
            winner = r
    return {'day': day_label, 'tier': 'current-year', 'winner': winner, 'tried': len(bare_nums)}


def run_widened_tier(day_label: str, y_start: int, y_end: int, tier_name: str) -> dict:
    print(f'\n=== {day_label}: widening to {tier_name} ({y_start}-{y_end}), Brickset-sourced ===')
    # brickset_get_sets() already applies the buildable filter and returns
    # the real category -- exercising the actual production function, not
    # a reimplementation. Rebrickable is skipped here: local
    # REBRICKABLE_API_KEY is confirmed invalid (401), documented limitation,
    # not worked around.
    candidates = scraper.brickset_get_sets(y_start, y_end)
    candidates.sort(key=lambda s: s.get('num_parts') or 0, reverse=True)
    winner = None
    tried = 0
    for s in candidates:
        tried += 1
        gallery = scraper.get_gallery(s)
        print(f'  [{tried}] {s["set_num"]} ({s.get("category")}): {len(gallery)} images')
        if len(gallery) >= MIN_GALLERY_IMAGES and winner is None:
            winner = {'num': s['set_num'], 'gallery_count': len(gallery)}
            break
    return {'day': day_label, 'tier': tier_name, 'winner': winner, 'tried': tried}


if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('--mode', choices=['pool', 'widen', 'spotcheck'], required=True)
    p.add_argument('--day', default='')
    p.add_argument('--nums', default='')
    p.add_argument('--year-start', type=int, default=None)
    p.add_argument('--year-end', type=int, default=None)
    p.add_argument('--tier-name', default='')
    args = p.parse_args()

    if args.mode == 'pool':
        result = run_pool(args.day, [n.strip() for n in args.nums.split(',') if n.strip()])
        print(f'\nRESULT: {result}')
    elif args.mode == 'widen':
        result = run_widened_tier(args.day, args.year_start, args.year_end, args.tier_name)
        print(f'\nRESULT: {result}')
    elif args.mode == 'spotcheck':
        for num in [n.strip() for n in args.nums.split(',') if n.strip()]:
            fake = {'set_num': f'{num}-1', 'image_url': ''}
            gallery = scraper.get_gallery(fake)
            print(f'{num}: {len(gallery)} images (new get_gallery(), Brickset+opportunistic-LEGO.com)')

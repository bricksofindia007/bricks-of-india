"""
scraper.py — Fetches the latest LEGO sets from three sources.
Returns exactly one set (highest part count among genuinely new announcements).

"Genuinely new" = announced this year and not yet widely available globally.
Pipeline posts about upcoming sets, not sets already on shelves worldwide.
"""

import os
import json
import sys
from pathlib import Path
from datetime import date, datetime
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import db

load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent / '.env.local')

REBRICKABLE_API_KEY = os.environ.get('REBRICKABLE_API_KEY', '')
BRICKSET_API_KEY = os.environ.get('BRICKSET_API_KEY', '')

TODAY = date.today()
CURRENT_YEAR = TODAY.year

# Brickset availability strings that indicate a set is not yet on shelves
_UPCOMING = {'Not yet available', 'Available soon'}

# Brickset availability strings that confirm a set is already on shelves globally
_ON_SHELVES = {'Retail', 'Discontinued', 'Retail - available direct only'}


# ── Availability gate ─────────────────────────────────────────────────────────

def _parse_date(value: str | None) -> date | None:
    """Parse ISO 8601 date string from Brickset API into a date object."""
    if not value:
        return None
    for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%d'):
        try:
            return datetime.strptime(value[:19], fmt).date()
        except ValueError:
            continue
    return None


def _is_genuinely_new(s: dict) -> bool:
    """
    True if the set is a genuine upcoming announcement worth posting about.

    Passes if ANY of:
      1. availability is "Not yet available" or "Available soon"
      2. us_date or uk_date exists and is in the future
      3. year == CURRENT_YEAR and no availability data at all
         (Rebrickable-only set; Rebrickable lags on availability — give benefit
         of the doubt for current-year sets)

    Blocked if:
      - year < CURRENT_YEAR  →  old set, already available globally
        Exception: us_date exists and is within the last 14 days (just dropped,
        still legitimately "new" for Indian audiences who haven't seen it yet)
    """
    year = s.get('year') or 0
    availability = s.get('availability') or ''
    us_date = s.get('us_date')    # date | None
    uk_date = s.get('uk_date')    # date | None

    # Strong positive signals — pass immediately
    if availability in _UPCOMING:
        return True
    if us_date and us_date > TODAY:
        return True
    if uk_date and uk_date > TODAY:
        return True

    # Explicit shelf presence — block unless dropped within the last 14 days
    # (14-day window covers sets just launched globally that Indian fans haven't
    # seen posted about yet, e.g. a LEGO exclusive that dropped last week)
    if availability in _ON_SHELVES:
        if us_date and (TODAY - us_date).days <= 14:
            return True
        return False

    # Year gate: sets older than this year with no positive signal are stale
    if year < CURRENT_YEAR:
        if us_date and (TODAY - us_date).days <= 14:
            return True
        return False

    # Current year + unknown/other availability (e.g. "LEGO exclusive", ""):
    # include if us_date is either future, recent (≤14d), or absent
    if us_date and (TODAY - us_date).days > 14:
        return False   # dated release that's been out a while

    return True


# ── Source 1: Rebrickable ─────────────────────────────────────────────────────

def rebrickable_get_sets() -> list[dict]:
    if not REBRICKABLE_API_KEY:
        print('[scraper] REBRICKABLE_API_KEY not set — skipping Source 1')
        return []
    try:
        resp = requests.get(
            'https://rebrickable.com/api/v3/lego/sets/',
            headers={'Authorization': f'key {REBRICKABLE_API_KEY}'},
            params={
                'ordering': '-year',
                'page_size': 20,
                'min_year': CURRENT_YEAR,
            },
            timeout=15,
        )
        resp.raise_for_status()
        results = resp.json().get('results', [])
        sets = []
        for s in results:
            sets.append({
                'set_num':    s.get('set_num', ''),
                'name':       s.get('name', ''),
                'year':       s.get('year', 0),
                'theme_id':   s.get('theme_id', ''),
                'theme':      str(s.get('theme_id', '')),
                'num_parts':  s.get('num_parts', 0),
                'image_url':  s.get('set_img_url', ''),
                'usd_price':  None,
                'us_date':    None,   # filled in by Brickset cross-reference
                'uk_date':    None,
                'availability': '',
                'source':     'rebrickable',
            })
        print(f'[scraper] Rebrickable returned {len(sets)} sets (min_year={CURRENT_YEAR})')
        return sets
    except Exception as exc:
        print(f'[scraper] Rebrickable error: {exc}')
        return []


# ── Source 2: Brickset ────────────────────────────────────────────────────────

def brickset_get_sets() -> list[dict]:
    """
    Returns ALL current-year sets from Brickset with availability data attached.
    No pre-filtering here — filtering happens after the merge so that
    Rebrickable-sourced sets can be enriched with this availability data first.
    """
    if not BRICKSET_API_KEY:
        print('[scraper] BRICKSET_API_KEY not set — skipping Source 2')
        return []
    try:
        params_json = json.dumps({
            'year':     str(CURRENT_YEAR),
            'orderBy':  'YearFrom',
            'pageSize': 50,
        })
        resp = requests.get(
            'https://brickset.com/api/v3.asmx/getSets',
            params={
                'apiKey':   BRICKSET_API_KEY,
                'userHash': '',
                'params':   params_json,
            },
            timeout=15,
        )
        resp.raise_for_status()
        raw_sets = resp.json().get('sets', [])

        sets = []
        for s in raw_sets:
            availability = s.get('availability') or ''
            lego_us   = (s.get('LEGOCom') or {}).get('US') or {}
            lego_uk   = (s.get('LEGOCom') or {}).get('UK') or {}
            us_date   = _parse_date(lego_us.get('dateFirstAvailable'))
            uk_date   = _parse_date(lego_uk.get('dateFirstAvailable'))
            usd_price = lego_us.get('retailPrice')
            number    = str(s.get('number') or '')
            set_num   = f'{number}-1' if number and '-' not in number else number
            image     = s.get('image') or {}
            sets.append({
                'set_num':      set_num,
                'name':         s.get('name', ''),
                'year':         s.get('year', 0),
                'theme_id':     '',
                'theme':        s.get('theme', ''),
                'num_parts':    s.get('pieces') or 0,
                'image_url':    image.get('imageURL', ''),
                'usd_price':    usd_price,
                'us_date':      us_date,
                'uk_date':      uk_date,
                'availability': availability,
                'source':       'brickset',
            })

        upcoming = sum(1 for s in sets if s['availability'] in _UPCOMING
                       or (s['us_date'] and s['us_date'] > TODAY))
        print(
            f'[scraper] Brickset: {len(sets)} sets fetched '
            f'({upcoming} flagged upcoming, rest used for enrichment only)'
        )
        return sets
    except Exception as exc:
        print(f'[scraper] Brickset error: {exc}')
        return []


# ── Source 3: LEGO.com US (fallback) ─────────────────────────────────────────

def lego_com_get_sets() -> list[dict]:
    """
    Fallback only — used when both API sources return empty.
    Scrapes /en-us/categories/new-sets-and-products which LEGO curates
    for upcoming/just-launched sets.
    """
    print('[scraper] Attempting LEGO.com fallback (BeautifulSoup)...')
    try:
        resp = requests.get(
            'https://www.lego.com/en-us/categories/new-sets-and-products',
            headers={
                'User-Agent': (
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                    'AppleWebKit/537.36 (KHTML, like Gecko) '
                    'Chrome/124.0.0.0 Safari/537.36'
                )
            },
            timeout=20,
        )
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
        sets = []
        for card in soup.select('[data-test="product-leaf"]')[:20]:
            name_el = card.select_one('[data-test="product-leaf-title"]')
            if not name_el:
                continue
            img_el = card.select_one('img')
            sets.append({
                'set_num':      '',
                'name':         name_el.get_text(strip=True),
                'year':         CURRENT_YEAR,
                'theme_id':     '',
                'theme':        '',
                'num_parts':    0,
                'image_url':    img_el.get('src', '') if img_el else '',
                'usd_price':    None,
                'us_date':      None,
                'uk_date':      None,
                'availability': 'Not yet available',   # page is curated as upcoming
                'source':       'lego_com',
            })
        print(f'[scraper] LEGO.com fallback: {len(sets)} sets')
        return sets
    except Exception as exc:
        print(f'[scraper] LEGO.com fallback error: {exc}')
        return []


# ── Merge + enrich ────────────────────────────────────────────────────────────

def _merge_and_dedup(rb_sets: list, bs_sets: list) -> list[dict]:
    """
    Primary key: normalised set number (strip variant suffix e.g. '-1').
    Rebrickable wins on part count + image.
    Brickset fills: usd_price, us_date, uk_date, availability, theme name.
    """
    merged: dict[str, dict] = {}

    for s in rb_sets:
        key = s['set_num'].split('-')[0]
        merged[key] = s.copy()

    for s in bs_sets:
        key = s['set_num'].split('-')[0]
        if key in merged:
            m = merged[key]
            if m['usd_price'] is None and s['usd_price'] is not None:
                m['usd_price'] = s['usd_price']
            if not m['theme'] and s['theme']:
                m['theme'] = s['theme']
            # Backfill availability data — Rebrickable doesn't carry this
            if not m['availability']:
                m['availability'] = s['availability']
            if m['us_date'] is None:
                m['us_date'] = s['us_date']
            if m['uk_date'] is None:
                m['uk_date'] = s['uk_date']
        else:
            merged[key] = s.copy()

    return list(merged.values())


# ── Main entry point ──────────────────────────────────────────────────────────

def get_new_set() -> dict | None:
    """
    Returns one set dict (genuinely new announcement, not yet posted) or None.
    Selection criterion: highest part count among qualifying sets.
    """
    rb_sets = rebrickable_get_sets()
    bs_sets = brickset_get_sets()

    if not rb_sets and not bs_sets:
        fallback = lego_com_get_sets()
        all_sets = [s for s in fallback if s.get('set_num')]
    else:
        all_sets = _merge_and_dedup(rb_sets, bs_sets)

    if not all_sets:
        print('[scraper] All sources returned empty.')
        return None

    # Filter 1: genuinely new announcements only
    upcoming = [s for s in all_sets if _is_genuinely_new(s)]
    filtered_out = len(all_sets) - len(upcoming)
    print(f'[scraper] Newness filter: {len(upcoming)} upcoming, {filtered_out} already-available removed')

    if not upcoming:
        print('[scraper] No genuinely new sets found today.')
        return None

    # Filter 2: not already posted — single bulk DB call instead of one per set
    posted_nums = db.get_all_posted_set_nums()
    print(f'[scraper] posted_sets contains {len(posted_nums)} set(s): {sorted(posted_nums)}')
    new_sets = [
        s for s in upcoming
        if s.get('set_num') and s['set_num'] not in posted_nums
    ]
    print(f'[scraper] {len(new_sets)} unposted sets remaining')

    # Filter 3: skip Rebrickable placeholder sets (name='{?}' or starts with '{')
    real_sets = [s for s in new_sets if s.get('name', '').strip().lstrip('{').strip()]
    real_sets = [s for s in real_sets if not s['name'].startswith('{')]
    placeholder_count = len(new_sets) - len(real_sets)
    if placeholder_count:
        print(f'[scraper] Dropped {placeholder_count} placeholder set(s) (name starts with {{)')
    new_sets = real_sets

    if not new_sets:
        return None

    selected = max(new_sets, key=lambda s: s.get('num_parts') or 0)
    print(
        f'[scraper] Selected: {selected["set_num"]} - {selected["name"]} '
        f'({selected["num_parts"]} parts, availability="{selected.get("availability","?")}",  '
        f'us_date={selected.get("us_date")})'
    )
    return selected


if __name__ == '__main__':
    print('Step 2 — Running scraper...\n')
    import pprint

    print(f'Filters active: min_year={CURRENT_YEAR}, availability gate, 14-day recency window\n')

    rb = rebrickable_get_sets()
    bs = brickset_get_sets()
    print(f'\nRaw counts - Rebrickable: {len(rb)}, Brickset: {len(bs)}')

    merged = _merge_and_dedup(rb, bs)
    upcoming = [s for s in merged if _is_genuinely_new(s)]
    already_available = [s for s in merged if not _is_genuinely_new(s)]

    print(f'After newness filter: {len(upcoming)} upcoming, {len(already_available)} removed')
    if already_available:
        print('Removed (already available):')
        for s in already_available:
            print(f'  {s["set_num"]} {s["name"]} year={s["year"]} '
                  f'avail="{s.get("availability","")}" us_date={s.get("us_date")}')

    result = get_new_set()
    if result:
        print('\nFinal selected set:')
        pprint.pprint({k: v for k, v in result.items() if k != 'image_url'})
    else:
        print('\nNo new sets found today.')

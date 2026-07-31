"""
select_quiet_panic_candidate.py -- automated candidate selection for the
Quiet Panic format.

Standalone, no imports from generate_quiet_panic_video.py, publish_quiet_
panic.py, or anything under the Reviews Pipeline -- independent read-only
query, same isolation precedent as the rest of this format's scripts
(publish_quiet_panic.py duplicates rather than imports; this does too).

Source: store_prices (live scraper table, MyBrickHouse/Toycra), NOT
sets.lego_mrp_inr/mrp_verified -- operator decision 2026-07-30, replacing
VID-QP-01's original MRP-audit-gated sourcing with the same store_prices
source the Reviews Pipeline Overhaul uses. store_id values confirmed live:
'mybrickhouse' and 'toycra' (no separate stores lookup table exists).

Schema note, verified live (not assumed): despite its name, store_prices.
set_id stores the plain set_number string (e.g. '77243'), NOT sets.id's
UUID -- confirmed directly against RB20/WALL-E/Rivendell rows 2026-07-30.
The join to `sets` below is therefore on set_number, not on `sets.id`.

Permanent dedup: a set_number is excluded once any quiet_panic_posts row
exists for it in a CLAIMED status (pending_approval, approved, posted_ig,
posted_yt, posted_both, rejected). 'publish_blocked' (automated gate
failure) and 'discarded' (operator rejected that specific attempt/draft
with no reason, same precedent as video_posts/content_rejections, not a
permanent set-level verdict) do NOT count as claimed -- the set stays
eligible for a future attempt.

'rejected' (added 20260731000000, rejection-rework loop) DOES count as
claimed, unlike 'discarded' -- a rejected row carries a specific
rejection_reason and is claimed exclusively by rework_quiet_panic.py for
a targeted revision. Without this, a set mid-rework would also be
eligible for an unrelated fresh pick here at the same time, generating
two independent videos for the same set concurrently.
"""

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / '.env')


def get_secret(name: str, default: str = '') -> str:
    """Duplicated from secrets_util.py, same as every other script in this
    directory -- kept local so this file has zero imports from anywhere
    else in scripts/video/."""
    return os.environ.get(name, default).lstrip('﻿').strip()


SUPABASE_URL = get_secret('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = get_secret('SUPABASE_SERVICE_ROLE_KEY')

ELIGIBLE_STORE_IDS = ('mybrickhouse', 'toycra')
CLAIMED_STATUSES = ('pending_approval', 'approved', 'posted_ig', 'posted_yt', 'posted_both', 'rejected')
PAGE = 1000  # PostgREST caps at 1000 rows/request regardless of .limit()/.range()


def get_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print('ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.', file=sys.stderr)
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _paginate(query_fn) -> list:
    """query_fn(offset, page) -> supabase response; paginates until a page
    returns fewer than PAGE rows."""
    rows = []
    offset = 0
    while True:
        r = query_fn(offset, PAGE)
        if not r.data:
            break
        rows.extend(r.data)
        if len(r.data) < PAGE:
            break
        offset += PAGE
    return rows


def claimed_set_numbers(sb) -> set:
    """set_numbers with a quiet_panic_posts row in a CLAIMED status."""
    rows = _paginate(lambda offset, page: (
        sb.table('quiet_panic_posts')
        .select('set_number')
        .in_('status', CLAIMED_STATUSES)
        .range(offset, offset + page - 1)
        .execute()
    ))
    return {row['set_number'] for row in rows if row['set_number']}


def in_stock_priced_listings(sb) -> list:
    """Every in-stock store_prices row from MyBrickHouse/Toycra. All live
    rows have a non-null price_inr (confirmed 2026-07-30), so no extra
    null-price filter is applied."""
    return _paginate(lambda offset, page: (
        sb.table('store_prices')
        .select('set_id,store_id,price_inr,in_stock')
        .in_('store_id', ELIGIBLE_STORE_IDS)
        .eq('in_stock', True)
        .range(offset, offset + page - 1)
        .execute()
    ))


def all_sets_by_set_number(sb) -> dict:
    """set_number -> {name, theme, pieces, image_url}, paginated."""
    rows = _paginate(lambda offset, page: (
        sb.table('sets')
        .select('set_number,name,theme,pieces,image_url')
        .range(offset, offset + page - 1)
        .execute()
    ))
    return {row['set_number']: row for row in rows}


def select_candidates(limit: int = 1) -> list:
    """Up to `limit` eligible candidates: in-stock + priced at MyBrickHouse
    or Toycra, set_number not already claimed. First-eligible-match order
    (by store_prices row order) -- no ranking logic beyond that, per
    operator instruction to keep this simple for now."""
    sb = get_supabase()
    claimed = claimed_set_numbers(sb)
    listings = in_stock_priced_listings(sb)
    sets_by_number = all_sets_by_set_number(sb)

    candidates = []
    seen_set_numbers = set()
    for row in listings:
        set_number = row['set_id']  # misleadingly named column, see module docstring
        set_row = sets_by_number.get(set_number)
        if not set_row:
            continue
        if set_number in claimed or set_number in seen_set_numbers:
            continue
        seen_set_numbers.add(set_number)

        candidates.append({
            'set_number': set_number,
            'set_title': set_row['name'],
            'theme': set_row['theme'],
            'pieces': set_row['pieces'],
            'image_url': set_row['image_url'],
            'price_inr': row['price_inr'],
            'store_id': row['store_id'],
        })
        if len(candidates) >= limit:
            break
    return candidates


def check_set_number(set_number: str) -> dict:
    """Test/diagnostic mode: report whether a specific set_number is
    currently eligible, and why not if it isn't."""
    sb = get_supabase()
    claimed = claimed_set_numbers(sb)
    if set_number in claimed:
        return {'eligible': False, 'reason': 'set_number already claimed in quiet_panic_posts', 'set_number': set_number}

    set_row = sb.table('sets').select('set_number,name,theme,pieces,image_url').eq('set_number', set_number).limit(1).execute()
    if not set_row.data:
        return {'eligible': False, 'reason': 'set_number not found in sets table', 'set_number': set_number}
    s = set_row.data[0]

    listing = (
        sb.table('store_prices')
        .select('set_id,store_id,price_inr,in_stock')
        .eq('set_id', set_number)  # misleadingly named column, see module docstring
        .in_('store_id', ELIGIBLE_STORE_IDS)
        .eq('in_stock', True)
        .limit(1)
        .execute()
    )
    if not listing.data:
        return {'eligible': False, 'reason': 'no in-stock MyBrickHouse/Toycra store_prices row for this set', 'set_number': set_number}

    row = listing.data[0]
    return {
        'eligible': True,
        'set_number': set_number,
        'set_title': s['name'],
        'theme': s['theme'],
        'pieces': s['pieces'],
        'image_url': s['image_url'],
        'price_inr': row['price_inr'],
        'store_id': row['store_id'],
    }


def main():
    parser = argparse.ArgumentParser(description='Select Quiet Panic candidate(s) from store_prices (MyBrickHouse/Toycra), excluding already-claimed set_numbers.')
    parser.add_argument('--set-number', type=str, help='Check a specific set_number for eligibility (diagnostic/test mode) instead of selecting the next candidate(s).')
    parser.add_argument('--limit', type=int, default=1, help='Max candidates to return when not using --set-number (default 1).')
    args = parser.parse_args()

    if args.set_number:
        print(json.dumps(check_set_number(args.set_number), indent=2))
        return

    candidates = select_candidates(limit=args.limit)
    print(json.dumps(candidates, indent=2))


if __name__ == '__main__':
    main()

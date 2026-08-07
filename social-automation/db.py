"""
db.py — Supabase interface for the social automation pipeline.
Handles posted_sets table reads/writes and social-assets storage uploads.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load local .env first, then fall back to the Next.js .env.local in repo root
load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent / '.env.local')

# Accept both CI names (SUPABASE_URL) and the Next.js .env.local names
SUPABASE_URL = (
    os.environ.get('SUPABASE_URL')
    or os.environ.get('NEXT_PUBLIC_SUPABASE_URL', '')
)
SUPABASE_SERVICE_KEY = (
    os.environ.get('SUPABASE_SERVICE_KEY')
    or os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
)
BUCKET_NAME = 'social-assets'


def _client() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise EnvironmentError(
            'SUPABASE_URL and SUPABASE_SERVICE_KEY must be set. '
            'Copy .env.example to .env and fill in values.'
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def ensure_bucket_exists() -> None:
    client = _client()
    try:
        client.storage.create_bucket(BUCKET_NAME, options={'public': True})
        print(f'[db] Created storage bucket: {BUCKET_NAME}')
    except Exception as e:
        msg = str(e).lower()
        if 'already exists' in msg or 'duplicate' in msg or '409' in msg:
            print(f'[db] Storage bucket {BUCKET_NAME} already exists — OK')
        else:
            raise


def is_already_posted(set_num: str) -> bool:
    client = _client()
    result = client.table('posted_sets').select('id').eq('set_num', set_num).execute()
    return len(result.data) > 0


def is_available_in_india(set_num: str) -> tuple:
    """
    Returns (True, price_str) if set has any store_prices row — already in Indian stores.
    Returns (False, '') if not found.
    Fails open (returns False) on any DB error so a check failure never blocks the pipeline.

    store_prices.set_id is the bare set number (e.g. '76342'), NOT a UUID.
    """
    client = _client()
    bare_num = set_num.split('-')[0]
    try:
        prices_r = (client.table('store_prices')
                    .select('id')
                    .eq('set_id', bare_num)
                    .limit(1)
                    .execute())
        if prices_r.data:
            return True, 'available in India'
        return False, ''
    except Exception as exc:
        print(f'[db] India availability check error (fail open): {exc}')
        return False, ''


def get_pieces_from_supabase(set_num: str) -> int:
    """
    Fourth-tier fallback for num_parts when LEGO.com/Rebrickable/Brickset all return 0.
    Queries the Supabase sets table which has 100% pieces coverage (24,633 rows).
    Returns 0 on any error so a lookup failure never blocks the pipeline.
    """
    bare_num = set_num.split('-')[0]
    try:
        result = (_client()
                  .table('sets')
                  .select('pieces')
                  .eq('set_number', bare_num)
                  .maybe_single()
                  .execute())
        return (result.data or {}).get('pieces') or 0
    except Exception as exc:
        print(f'[db] pieces fallback error for {bare_num}: {exc}')
        return 0


def _fmt_inr(amount: float) -> str:
    """Format a number in Indian number format: ₹24,999 / ₹1,05,999."""
    s = str(int(amount))
    if len(s) <= 3:
        return f'₹{s}'
    last3 = s[-3:]
    rest = s[:-3]
    groups = []
    while len(rest) > 2:
        groups.append(rest[-2:])
        rest = rest[:-2]
    if rest:
        groups.append(rest)
    return '₹' + ','.join(reversed(groups)) + ',' + last3


def get_india_price(set_num: str) -> str | None:
    """
    Returns a formatted INR price string (e.g. '₹24,999') for a set from store_prices,
    or None if no live price data. Picks the cheapest in-stock price across stores.
    Used to populate the stats card India Price box with real data when available.
    """
    bare_num = set_num.split('-')[0]
    try:
        result = (_client()
                  .table('store_prices')
                  .select('price_inr, in_stock')
                  .eq('set_id', bare_num)
                  .execute())
        rows = [r for r in (result.data or []) if r.get('price_inr')]
        if not rows:
            return None
        # Prefer in-stock rows; fall back to any price
        in_stock = [r for r in rows if r.get('in_stock')]
        best = min(in_stock or rows, key=lambda r: r['price_inr'])
        return _fmt_inr(best['price_inr'])
    except Exception as exc:
        print(f'[db] India price lookup error for {bare_num}: {exc}')
        return None


def get_all_posted_set_nums() -> set:
    """
    Returns a set of every set_num already in posted_sets.
    Single DB call — use this instead of calling is_already_posted()
    once per candidate set to avoid N separate round-trips.
    """
    client = _client()
    result = client.table('posted_sets').select('set_num').execute()
    return {r['set_num'] for r in result.data}


def mark_as_posted(set_num: str, set_name: str, platforms_dict: dict) -> None:
    """
    platforms_dict keys: ig_feed, ig_reels (bool). yt_shorts recorded if present.
    """
    client = _client()
    row = {
        'set_num': set_num,
        'set_name': set_name,
        'ig_feed_posted': platforms_dict.get('ig_feed', False),
        'ig_reels_posted': platforms_dict.get('ig_reels', False),
        'yt_shorts_posted': platforms_dict.get('yt_shorts', False),
    }
    result = client.table('posted_sets').insert(row).execute()
    print(f'[db] Marked {set_num} as posted. Row ID: {result.data[0]["id"]}')


def record_heartbeat(platform: str, success: bool | None, error: str | None = None) -> None:
    """
    Upsert into social_automation_heartbeat. Non-fatal — never blocks the pipeline.

    success=True  → sets last_attempt_at + last_success_at, resets
                     consecutive_skip_days to 0, clears skip_reason
    success=False → sets last_attempt_at + last_failure_at + last_error.
                     consecutive_skip_days is left untouched -- a hard
                     failure (crash, API error) is a different signal from
                     "ran cleanly, found nothing to post," and conflating
                     them would make the skip-streak alert fire for the
                     wrong reason.
    success=None  → sets last_attempt_at only, increments
                     consecutive_skip_days, persists the real skip_reason
                     (previously discarded entirely). Alerts at >=2.

    NOTE: consecutive_skip_days/skip_reason require migration
    20260808000000_heartbeat_skip_streak.sql, written for review but NOT
    applied to the live database as of this commit -- see PR description.
    """
    import datetime
    client = _client()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    row: dict = {'platform': platform, 'last_attempt_at': now}

    if success is True:
        row['last_success_at'] = now
        row['last_error'] = None
        row['consecutive_skip_days'] = 0
        row['skip_reason'] = None
    elif success is False:
        row['last_failure_at'] = now
        row['last_error'] = (error or 'unknown')[:500]
    else:
        # success is None: increment the streak. Needs the current value
        # first -- Supabase upsert doesn't do atomic increment via a plain
        # dict payload. This runs at most once/day per platform, so the
        # tiny read-then-write race window is accepted rather than adding a
        # Postgres-side increment function for a job at this frequency.
        try:
            current = (client.table('social_automation_heartbeat')
                       .select('consecutive_skip_days')
                       .eq('platform', platform)
                       .maybe_single()
                       .execute())
            prev_streak = (current.data or {}).get('consecutive_skip_days') or 0
        except Exception as exc:
            print(f'[db] Could not read previous skip streak (defaulting to 0): {exc}')
            prev_streak = 0
        row['consecutive_skip_days'] = prev_streak + 1
        row['skip_reason'] = (error or 'no_eligible_candidates')[:500]

    try:
        client.table('social_automation_heartbeat').upsert(row, on_conflict='platform').execute()
        state = 'OK' if success is True else ('FAIL' if success is False else 'SKIP')
        streak_note = f' (consecutive_skip_days={row["consecutive_skip_days"]})' if success is None else ''
        print(f'[db] Heartbeat: {platform} {state}{streak_note}')
    except Exception as exc:
        print(f'[db] Heartbeat write failed (non-fatal): {exc}')
        return

    # Alerting is deliberately outside the write's own try/except -- an
    # alert failure must never be reported as a heartbeat write failure.
    if success is None and row.get('consecutive_skip_days', 0) >= 2:
        try:
            import notifier
            notifier.send_skip_streak_alert(platform, row['consecutive_skip_days'], row.get('skip_reason', ''))
        except Exception as exc:
            print(f'[db] Skip-streak alert failed (non-fatal): {exc}')


def upload_to_storage(local_path: str, filename: str) -> str:
    """Upload file to social-assets bucket. Returns public URL."""
    client = _client()
    content_type = 'video/mp4' if filename.endswith('.mp4') else 'image/jpeg'
    with open(local_path, 'rb') as f:
        client.storage.from_(BUCKET_NAME).upload(
            filename,
            f,
            file_options={'content-type': content_type, 'upsert': 'true'},
        )
    public_url = client.storage.from_(BUCKET_NAME).get_public_url(filename)
    print(f'[db] Uploaded {filename} -> {public_url}')
    return public_url


def upload_many_to_storage(items: list) -> list:
    """
    Upload multiple files to Supabase Storage.
    items: list of (local_path, filename) tuples.
    Returns list of public URLs in the same order.
    """
    return [upload_to_storage(local_path, filename) for local_path, filename in items]


if __name__ == '__main__':
    print('Step 1 — Testing Supabase connection + posted_sets table...')
    try:
        client = _client()
        result = client.table('posted_sets').select('id').limit(1).execute()
        print(f'[db] posted_sets accessible. Row count sample: {len(result.data)}')
        ensure_bucket_exists()
        print('[db] All Supabase checks PASSED.')
    except Exception as exc:
        print(f'[db] ERROR: {exc}')
        sys.exit(1)

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


def mark_as_posted(set_num: str, set_name: str, platforms_dict: dict) -> None:
    """
    platforms_dict keys: ig_feed, ig_reels, yt_shorts (all bool)
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

"""
backfill_youtube.py — One-off backfill: upload YouTube Shorts for sets posted during
the broken-auth window (yt_shorts_posted = false).

Run via .github/workflows/youtube-backfill.yml so YOUTUBE_CLIENT_SECRETS is available.
Idempotent: skips rows where yt_shorts_posted is already true.
"""

import os
import sys
import time
import tempfile
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent / '.env.local')

import db
import publisher
import caption_writer

SLEEP_BETWEEN = 15  # seconds between uploads to avoid YouTube rate limits


def _verify_youtube_channel() -> None:
    """Guard: abort if the authenticated YouTube channel is not Bricks of India."""
    creds = publisher._load_youtube_credentials()
    if creds is None:
        print('[backfill] YouTube credentials not available — skipping channel guard')
        return
    from googleapiclient.discovery import build
    youtube = build('youtube', 'v3', credentials=creds)
    channel_response = youtube.channels().list(part='snippet', mine=True).execute()
    if not channel_response.get('items'):
        raise SystemExit('[guard] No YouTube channel found for authenticated user. Aborting.')
    channel_title = channel_response['items'][0]['snippet']['title']
    channel_id    = channel_response['items'][0]['id']
    print(f'[guard] Authenticated channel: {channel_title} ({channel_id})')
    if channel_title != 'Bricks of India':
        raise SystemExit(f"[guard] WRONG CHANNEL: {channel_title}. Expected 'Bricks of India'. Aborting.")


def _download_shorts(set_num: str) -> str:
    """Download {set_num}_shorts.mp4 from Supabase Storage to a temp file. Returns local path."""
    client = db._client()
    filename = f'{set_num}_shorts.mp4'
    public_url = client.storage.from_(db.BUCKET_NAME).get_public_url(filename)
    print(f'[backfill] Downloading {filename} ...')
    resp = requests.get(public_url, timeout=120)
    resp.raise_for_status()
    tmp = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
    tmp.write(resp.content)
    tmp.close()
    print(f'[backfill] Downloaded to {tmp.name} ({len(resp.content) / 1024 / 1024:.1f} MB)')
    return tmp.name


def _mark_yt_posted(set_num: str) -> None:
    client = db._client()
    client.table('posted_sets').update({'yt_shorts_posted': True}).eq('set_num', set_num).execute()
    print(f'[backfill] DB updated: {set_num} yt_shorts_posted = true')


def _make_caption(set_data: dict) -> str:
    """Try caption_writer; fall back to a simple template if Gemini is unavailable."""
    try:
        return caption_writer.generate_caption(set_data)
    except Exception as exc:
        print(f'[backfill] caption_writer failed ({exc}) — using template')
        name = set_data.get('name', 'LEGO Set')
        bare = set_data.get('set_num', '').split('-')[0]
        return (
            f'Check out the {name} (#{bare})!\n\n'
            f'🧱 Follow Bricks of India for LEGO news, prices & deals in India. '
            f'Link in bio. #LEGOIndia #BricksofIndia'
        )


def main() -> None:
    client = db._client()
    result = (client.table('posted_sets')
              .select('id, set_num, set_name')
              .eq('yt_shorts_posted', False)
              .order('posted_at', desc=False)
              .execute())
    pending = result.data or []
    print(f'[backfill] {len(pending)} rows with yt_shorts_posted = false')

    _verify_youtube_channel()

    if not pending:
        print('[backfill] Nothing to do.')
        return

    successes = []
    failures = []

    for i, row in enumerate(pending):
        set_num  = row['set_num']
        set_name = row.get('set_name') or ''
        print(f'\n[backfill] ({i + 1}/{len(pending)}) {set_num} — {set_name}')

        tmp_path = None
        try:
            tmp_path = _download_shorts(set_num)
            set_data = {'set_num': set_num, 'name': set_name, 'source': 'brickset'}
            caption  = _make_caption(set_data)
            video_id = publisher.post_youtube_shorts(tmp_path, set_data, caption)
            if video_id:
                _mark_yt_posted(set_num)
                print(f'✓ {set_num} → {video_id}')
                successes.append((set_num, video_id))
            else:
                print(f'✗ {set_num} → post_youtube_shorts returned None')
                failures.append(set_num)
        except Exception as exc:
            print(f'✗ {set_num} → {exc}')
            failures.append(set_num)
        finally:
            if tmp_path:
                try:
                    Path(tmp_path).unlink(missing_ok=True)
                except Exception:
                    pass

        if i < len(pending) - 1:
            print(f'[backfill] Sleeping {SLEEP_BETWEEN}s ...')
            time.sleep(SLEEP_BETWEEN)

    failure_nums = [f for f in failures]
    print(f'\n[backfill] Backfilled {len(successes)}/{len(pending)}, failures: {failure_nums if failure_nums else "none"}')


if __name__ == '__main__':
    main()

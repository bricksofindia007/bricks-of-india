"""
publisher.py — Posts to Instagram Feed, Instagram Reels, and YouTube Shorts.

Dry-run mode (--dry-run): validates API credentials without posting anything.
"""

import argparse
import json
import os
import sys
import tempfile
import time

import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent / '.env.local')

IG_ACCESS_TOKEN = os.environ.get('IG_ACCESS_TOKEN', '')
IG_USER_ID = os.environ.get('IG_USER_ID', '')
YOUTUBE_CLIENT_SECRETS = os.environ.get('YOUTUBE_CLIENT_SECRETS', '')

GRAPH_API_BASE = 'https://graph.facebook.com/v19.0'
YT_SCOPES = ['https://www.googleapis.com/auth/youtube.upload']


# ── Instagram ─────────────────────────────────────────────────────────────────

def _ig_check(resp: requests.Response, context: str) -> dict:
    data = resp.json()
    if resp.status_code != 200 or 'error' in data:
        err = data.get('error', {})
        raise RuntimeError(
            f'Instagram API error during {context}: '
            f'[{err.get("code")}] {err.get("message", resp.text)}'
        )
    return data


def post_instagram_feed(image_url: str, caption: str) -> str:
    """Creates an IG feed post. Returns the published media ID."""
    print('[publisher] Creating IG feed media container...')
    resp = requests.post(
        f'{GRAPH_API_BASE}/{IG_USER_ID}/media',
        data={
            'image_url': image_url,
            'caption': caption,
            'access_token': IG_ACCESS_TOKEN,
        },
        timeout=30,
    )
    creation_id = _ig_check(resp, 'feed container create')['id']
    print(f'[publisher] IG feed container ID: {creation_id}')

    print('[publisher] Publishing IG feed post...')
    resp = requests.post(
        f'{GRAPH_API_BASE}/{IG_USER_ID}/media_publish',
        data={
            'creation_id': creation_id,
            'access_token': IG_ACCESS_TOKEN,
        },
        timeout=30,
    )
    media_id = _ig_check(resp, 'feed publish')['id']
    print(f'[publisher] IG feed post live. Media ID: {media_id}')
    return media_id


def post_instagram_reels(video_url: str, caption: str) -> str:
    """Creates an IG Reels post. Polls until processing is FINISHED. Returns media ID."""
    print('[publisher] Creating IG Reels media container...')
    resp = requests.post(
        f'{GRAPH_API_BASE}/{IG_USER_ID}/media',
        data={
            'media_type': 'REELS',
            'video_url': video_url,
            'caption': caption,
            'access_token': IG_ACCESS_TOKEN,
        },
        timeout=30,
    )
    creation_id = _ig_check(resp, 'reels container create')['id']
    print(f'[publisher] IG Reels container ID: {creation_id}. Polling for FINISHED...')

    # Poll every 10s, timeout after 5 minutes (30 attempts)
    for attempt in range(30):
        time.sleep(10)
        status_resp = requests.get(
            f'{GRAPH_API_BASE}/{creation_id}',
            params={'fields': 'status_code', 'access_token': IG_ACCESS_TOKEN},
            timeout=15,
        )
        status_data = status_resp.json()
        status_code = status_data.get('status_code', '')
        print(f'[publisher] Reels status ({attempt + 1}/30): {status_code}')
        if status_code == 'FINISHED':
            break
        if status_code == 'ERROR':
            raise RuntimeError(f'Instagram Reels processing failed: {status_data}')
    else:
        raise TimeoutError('Instagram Reels processing timed out after 5 minutes')

    print('[publisher] Publishing IG Reels post...')
    resp = requests.post(
        f'{GRAPH_API_BASE}/{IG_USER_ID}/media_publish',
        data={
            'creation_id': creation_id,
            'access_token': IG_ACCESS_TOKEN,
        },
        timeout=30,
    )
    media_id = _ig_check(resp, 'reels publish')['id']
    print(f'[publisher] IG Reels post live. Media ID: {media_id}')
    return media_id


# ── YouTube Shorts ────────────────────────────────────────────────────────────

def _load_youtube_credentials():
    """
    Loads OAuth token from YOUTUBE_CLIENT_SECRETS env var (the token JSON,
    not the client_secrets.json file — see README for one-time setup).
    Returns refreshed Credentials or None if secret is not set.
    """
    if not YOUTUBE_CLIENT_SECRETS:
        print('[publisher] YOUTUBE_CLIENT_SECRETS not set — YouTube upload skipped.')
        return None

    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    try:
        token_data = json.loads(YOUTUBE_CLIENT_SECRETS)
    except json.JSONDecodeError as exc:
        print(f'[publisher] YOUTUBE_CLIENT_SECRETS is not valid JSON: {exc}. Skipping YouTube.')
        return None

    creds = Credentials.from_authorized_user_info(token_data, YT_SCOPES)
    if creds.expired and creds.refresh_token:
        print('[publisher] Refreshing YouTube token...')
        creds.refresh(Request())
    return creds


def post_youtube_shorts(video_path: str, set_data: dict, caption_text: str) -> str | None:
    """Uploads video as a YouTube Short. Returns video ID or None if skipped."""
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    creds = _load_youtube_credentials()
    if creds is None:
        return None

    youtube = build('youtube', 'v3', credentials=creds)

    title = (
        f"{set_data['name']} ({set_data['set_num']}) 🧱 | "
        f"One day it will come to India. One day. 🇮🇳 | #LEGO #Shorts"
    )

    description = (
        f"{caption_text}\n\n"
        f"📍 Bricks of India — India's only LEGO price tracker\n"
        f"🔗 bricksofindia.com\n"
        f"🛑 Please do not ask when this set releases in India. I don't know. "
        f"LEGO doesn't know. Nobody knows. One day it will come. One day. 🤫\n\n"
        f"#LEGO #LEGOIndia #LEGOSets #BricksofIndia #Shorts #LEGOShorts"
    )

    print(f'[publisher] Uploading YouTube Short: {title[:60]}...')
    request = youtube.videos().insert(
        part='snippet,status',
        body={
            'snippet': {
                'title': title,
                'description': description,
                'tags': ['LEGO', 'LEGOIndia', 'LEGOSets', 'BricksofIndia', 'Shorts', 'LEGOShorts'],
                'categoryId': '24',
            },
            'status': {
                'privacyStatus': 'public',
            },
        },
        media_body=MediaFileUpload(video_path, mimetype='video/mp4', resumable=True),
    )
    response = request.execute()
    video_id = response['id']
    print(f'[publisher] YouTube Short live. Video ID: {video_id}')
    return video_id


# ── Dry-run ───────────────────────────────────────────────────────────────────

def dry_run() -> None:
    print('\n── Dry-run: verifying API credentials ──\n')
    errors = []

    # Instagram: verify token via /me endpoint
    print('[dry-run] Checking Instagram token...')
    if not IG_ACCESS_TOKEN or not IG_USER_ID:
        errors.append('IG_ACCESS_TOKEN or IG_USER_ID not set')
    else:
        try:
            resp = requests.get(
                f'{GRAPH_API_BASE}/{IG_USER_ID}',
                params={'fields': 'id,username', 'access_token': IG_ACCESS_TOKEN},
                timeout=10,
            )
            data = resp.json()
            if 'error' in data:
                errors.append(f'Instagram token invalid: {data["error"].get("message")}')
            else:
                print(f'  ✓ Instagram: @{data.get("username")} (ID: {data.get("id")})')
        except Exception as exc:
            errors.append(f'Instagram request failed: {exc}')

    # YouTube: verify token loading
    print('[dry-run] Checking YouTube token...')
    if not YOUTUBE_CLIENT_SECRETS:
        print('  ⚠ YOUTUBE_CLIENT_SECRETS not set — YouTube will be skipped in pipeline.')
    else:
        try:
            creds = _load_youtube_credentials()
            if creds and creds.valid:
                print('  ✓ YouTube token valid.')
            elif creds and creds.expired:
                print('  ⚠ YouTube token expired but refresh_token present — will auto-refresh.')
            else:
                errors.append('YouTube token could not be loaded.')
        except Exception as exc:
            errors.append(f'YouTube token check failed: {exc}')

    print()
    if errors:
        for err in errors:
            print(f'  ✗ {err}')
        print('\nDry-run FAILED — fix the above before a live run.')
        sys.exit(1)
    else:
        print('Dry-run PASSED — all checked credentials are valid.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='BOI publisher')
    parser.add_argument('--dry-run', action='store_true', help='Validate credentials only')
    args = parser.parse_args()

    if args.dry_run:
        dry_run()
    else:
        print('Run pipeline.py for a full live post. Use --dry-run to validate credentials.')

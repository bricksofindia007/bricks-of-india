"""
publisher.py — Posts to Instagram Feed, Instagram Reels, and YouTube Shorts.

Dry-run mode (--dry-run): validates API credentials without posting anything.
"""

import argparse
import json
import os
import sys
import time

import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent / '.env.local')

IG_ACCESS_TOKEN      = os.environ.get('IG_ACCESS_TOKEN', '')
IG_USER_ID           = os.environ.get('IG_USER_ID', '')
YOUTUBE_CLIENT_SECRETS = os.environ.get('YOUTUBE_CLIENT_SECRETS', '')

GRAPH_API_BASE = 'https://graph.facebook.com/v19.0'
YT_SCOPES      = ['https://www.googleapis.com/auth/youtube.upload']


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


def post_instagram_carousel(image_urls: list, caption: str) -> str:
    """
    Creates an IG carousel post from a list of image URLs.
    Each image is registered as a child container first, then a parent
    CAROUSEL container is created and published.
    Returns the published media ID.
    """
    # Step 1: create a child container for each image
    # Requires explicit media_type=IMAGE and is_carousel_item=true per Meta Graph API spec.
    # 2-second gap between creations gives Instagram time to register each container
    # before the next is submitted — prevents all slots rendering as the first image.
    child_ids = []
    for i, url in enumerate(image_urls):
        print(f'[publisher] Creating carousel child {i + 1}/{len(image_urls)}: {url}')
        resp = requests.post(
            f'{GRAPH_API_BASE}/{IG_USER_ID}/media',
            data={
                'media_type': 'IMAGE',
                'image_url': url,
                'is_carousel_item': 'true',
                'access_token': IG_ACCESS_TOKEN,
            },
            timeout=30,
        )
        child_id = _ig_check(resp, f'carousel child {i + 1} create')['id']
        child_ids.append(child_id)
        print(f'[publisher] Child {i + 1} container ID: {child_id}')
        if i < len(image_urls) - 1:
            time.sleep(2)  # allow Instagram to register each container before the next

    print(f'[publisher] All child IDs: {child_ids}')

    # Step 2: create the parent carousel container
    print('[publisher] Creating carousel parent container...')
    resp = requests.post(
        f'{GRAPH_API_BASE}/{IG_USER_ID}/media',
        data={
            'media_type': 'CAROUSEL',
            'children': ','.join(child_ids),
            'caption': caption,
            'access_token': IG_ACCESS_TOKEN,
        },
        timeout=30,
    )
    carousel_id = _ig_check(resp, 'carousel parent create')['id']
    print(f'[publisher] Carousel container ID: {carousel_id}. Polling for FINISHED...')

    # Step 2b: poll until container is ready — same as Reels flow.
    # 9007 "Media ID not available" fires when we publish before Instagram has
    # finished processing all child containers. Poll every 5s, timeout 90s.
    for attempt in range(18):
        time.sleep(5)
        status_resp = requests.get(
            f'{GRAPH_API_BASE}/{carousel_id}',
            params={'fields': 'status_code', 'access_token': IG_ACCESS_TOKEN},
            timeout=15,
        )
        status_data = status_resp.json()
        status_code = status_data.get('status_code', '')
        print(f'[publisher] Carousel status ({attempt + 1}/18): {status_code}')
        if status_code == 'FINISHED':
            break
        if status_code == 'ERROR':
            raise RuntimeError(f'Instagram carousel container failed: {status_data}')
    else:
        print('[publisher] WARNING: Carousel status poll timed out — attempting publish anyway')

    # Step 3: publish
    print('[publisher] Publishing carousel...')
    resp = requests.post(
        f'{GRAPH_API_BASE}/{IG_USER_ID}/media_publish',
        data={
            'creation_id': carousel_id,
            'access_token': IG_ACCESS_TOKEN,
        },
        timeout=30,
    )
    media_id = _ig_check(resp, 'carousel publish')['id']
    print(f'[publisher] IG carousel post live. Media ID: {media_id}')
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
    not client_secrets.json — see setup notes).
    Returns refreshed Credentials or None if secret not set / invalid.
    """
    if not YOUTUBE_CLIENT_SECRETS:
        print('[publisher] YOUTUBE_CLIENT_SECRETS not set — YouTube upload skipped.')
        return None

    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    try:
        token_data = json.loads(YOUTUBE_CLIENT_SECRETS.lstrip('﻿').strip())
    except json.JSONDecodeError as exc:
        print(f'[publisher] YOUTUBE_CLIENT_SECRETS is not valid JSON: {exc}. Skipping YouTube.')
        return None

    from google.auth.exceptions import RefreshError

    creds = Credentials.from_authorized_user_info(token_data, YT_SCOPES)
    if creds.expired and creds.refresh_token:
        print('[publisher] Refreshing YouTube token...')
        try:
            creds.refresh(Request())
        except RefreshError as exc:
            print(f'[publisher] YouTube token refresh failed: {exc}. Skipping YouTube.')
            return None
    return creds


def post_youtube_shorts(video_path: str, set_data: dict, caption_text: str) -> str | None:
    """
    Uploads a local video file as a YouTube Short.
    Returns video ID on success, None if credentials are absent or upload fails.
    """
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    creds = _load_youtube_credentials()
    if creds is None:
        return None

    youtube = build('youtube', 'v3', credentials=creds)

    channel_response = youtube.channels().list(part='snippet', mine=True).execute()
    if not channel_response.get('items'):
        raise SystemExit('[guard] No YouTube channel found for authenticated user. Aborting.')
    channel_title = channel_response['items'][0]['snippet']['title']
    channel_id    = channel_response['items'][0]['id']
    print(f'[guard] Authenticated channel: {channel_title} ({channel_id})')
    if channel_title != 'Bricks of India':
        raise SystemExit(f"[guard] WRONG CHANNEL: {channel_title}. Expected 'Bricks of India'. Aborting.")

    title       = f"{set_data['name']} ({set_data['set_num']}) | #LEGO #Shorts"[:100]
    description = (
        f"{caption_text}\n\n"
        f"📍 Bricks of India — India's only LEGO price tracker\n"
        f"🔗 bricksofindia.com\n\n"
        f"#LEGO #LEGOIndia #LEGOSets #BricksofIndia #Shorts #LEGOShorts"
    )

    print(f'[publisher] Uploading YouTube Short: {set_data["set_num"]} — {set_data["name"][:50]}...')
    request = youtube.videos().insert(
        part='snippet,status',
        body={
            'snippet': {
                'title':       title,
                'description': description,
                'tags':        ['LEGO', 'LEGOIndia', 'LEGOSets', 'BricksofIndia', 'Shorts', 'LEGOShorts'],
                'categoryId':  '24',
            },
            'status': {'privacyStatus': 'public'},
        },
        media_body=MediaFileUpload(video_path, mimetype='video/mp4', resumable=True),
    )
    response = request.execute()
    video_id = response['id']
    print(f'[publisher] YouTube Short live. Video ID: {video_id}')
    return video_id


# ── Dry-run ───────────────────────────────────────────────────────────────────

def dry_run() -> None:
    print('\n-- Dry-run: verifying API credentials --\n')
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
                print(f'  [ok] Instagram: @{data.get("username")} (ID: {data.get("id")})')
        except Exception as exc:
            errors.append(f'Instagram request failed: {exc}')

    # YouTube: verify token loading
    print('[dry-run] Checking YouTube token...')
    if not YOUTUBE_CLIENT_SECRETS:
        print('  [!] YOUTUBE_CLIENT_SECRETS not set — YouTube Shorts will be skipped.')
    else:
        try:
            creds = _load_youtube_credentials()
            if creds and creds.valid:
                print('  [ok] YouTube token valid.')
            elif creds and creds.expired:
                print('  [!] YouTube token expired but refresh_token present — will auto-refresh.')
            else:
                errors.append('YouTube token could not be loaded.')
        except Exception as exc:
            errors.append(f'YouTube token check failed: {exc}')

    print()
    if errors:
        for err in errors:
            print(f'  [x] {err}')
        print('\nDry-run FAILED - fix the above before a live run.')
        sys.exit(1)
    else:
        print('Dry-run PASSED - all checked credentials are valid.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='BOI publisher')
    parser.add_argument('--dry-run', action='store_true', help='Validate credentials only')
    args = parser.parse_args()

    if args.dry_run:
        dry_run()
    else:
        print('Run pipeline.py for a full live post. Use --dry-run to validate credentials.')

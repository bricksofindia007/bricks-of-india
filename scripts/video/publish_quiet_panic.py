"""
publish_quiet_panic.py -- fully standalone poll-and-publish for the Quiet
Panic format.

Deliberately imports nothing from engine.py or publish.py (operator
decision, 2026-07-29): the IG/YT upload logic below is a duplicated,
independently-maintained copy of the same approach used there, not a
shared function or shared module. The only thing this script shares with
the rest of the video pipeline is DATA, not code -- the same Bricks of
India IG Business account / YouTube channel credentials (IG_ACCESS_TOKEN,
IG_USER_ID, YOUTUBE_CLIENT_SECRETS), because there is only one of each
account regardless of which pipeline posts to it. IG_ACCESS_TOKEN is kept
fresh by the existing ig-token-refresh.yml workflow; nothing here re-reads
or re-implements that refresh cycle.

See briefs/VID-QP-01.md (persona/voice/SFX/bumpers) and
briefs/VID-QP-02.md (this build's spec) for full context.
"""

import argparse
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from supabase import create_client


def get_secret(name: str, default: str = '') -> str:
    """Duplicated from secrets_util.py rather than imported -- BOM-safe
    os.environ wrapper, kept local so this file has zero imports from
    anywhere else in scripts/video/."""
    return os.environ.get(name, default).lstrip('﻿').strip()


load_dotenv(Path(__file__).parent / '.env')
# Same IG/YT accounts as the rest of the video pipeline -- these secrets
# live in social-automation's .env locally. Shared DATA dependency (one
# Bricks of India IG/YouTube account), not a code import.
load_dotenv(Path(__file__).parent.parent.parent / 'social-automation' / '.env')

SUPABASE_URL = get_secret('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = get_secret('SUPABASE_SERVICE_ROLE_KEY')
IG_ACCESS_TOKEN = get_secret('IG_ACCESS_TOKEN')
IG_USER_ID = get_secret('IG_USER_ID')
YOUTUBE_CLIENT_SECRETS = get_secret('YOUTUBE_CLIENT_SECRETS')

GRAPH_API_BASE = 'https://graph.facebook.com/v19.0'
YT_SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
]
VIDEO_STORAGE_BUCKET = 'quiet-panic-assets'

IST_OFFSET = timedelta(hours=5, minutes=30)
DAILY_CAP = 1  # Quiet Panic's own cap -- independent counter/state from VID-P4's.


class GateFailureError(Exception):
    pass


def get_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print('ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.', file=sys.stderr)
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# ---------------------------------------------------------------------------
# Gates -- placeholder until Phase 2b's script-gen/assembly side exists.
# quiet_panic_posts.gate_results defaults to '{}'::jsonb, so this is
# vacuously true until real gates populate it with per-gate pass/fail dicts.
# ---------------------------------------------------------------------------

def assert_all_gates_passed(gate_results: dict) -> None:
    for key, result in (gate_results or {}).items():
        if key.startswith('_'):
            continue
        if not isinstance(result, dict) or result.get('pass') is not True:
            raise GateFailureError(f'Gate {key!r} did not pass: {result!r}')


# ---------------------------------------------------------------------------
# Supabase Storage upload -- own bucket (quiet-panic-assets), fully separate
# from VID-P4's social-assets bucket. A shared-bucket-with-prefix approach
# was tried first but rejected: service_role bypasses RLS entirely and
# cannot be scoped to a prefix, so sharing a bucket would have given this
# script full read/write/delete on VID-P4's stored videos too. Full bucket
# separation is the only way this isolation goal actually holds.
# ---------------------------------------------------------------------------

def upload_video_to_storage(sb, local_path: str, filename: str) -> str:
    with open(local_path, 'rb') as f:
        sb.storage.from_(VIDEO_STORAGE_BUCKET).upload(
            filename, f, {'content-type': 'video/mp4', 'upsert': 'true'}
        )
    return sb.storage.from_(VIDEO_STORAGE_BUCKET).get_public_url(filename)


# ---------------------------------------------------------------------------
# Instagram Reels upload -- duplicated from publish.py's
# post_instagram_reels: same container-create -> poll -> publish ->
# fetch-back-verify sequence, copied as its own function here.
# ---------------------------------------------------------------------------

def build_ig_caption(script: str) -> str:
    return (
        f'{script}\n\n'
        f"📍 Bricks of India — India's only LEGO price tracker\n"
        f'🔗 bricksofindia.com\n\n'
        f'#LEGO #LEGOIndia #LEGOSets #BricksofIndia #QuietPanic #Reels'
    )


def _ig_check(resp: requests.Response, context: str) -> dict:
    data = resp.json()
    if resp.status_code != 200 or 'error' in data:
        err = data.get('error', {})
        raise RuntimeError(f'Instagram API error during {context}: [{err.get("code")}] {err.get("message", resp.text)}')
    return data


def post_instagram_reels(video_url: str, caption: str) -> dict:
    print('[publish_quiet_panic] Creating IG Reels media container...')
    resp = requests.post(
        f'{GRAPH_API_BASE}/{IG_USER_ID}/media',
        data={'media_type': 'REELS', 'video_url': video_url, 'caption': caption, 'access_token': IG_ACCESS_TOKEN},
        timeout=30,
    )
    creation_id = _ig_check(resp, 'reels container create')['id']
    print(f'[publish_quiet_panic] IG Reels container ID: {creation_id}. Polling for FINISHED...')

    for attempt in range(30):  # 10s * 30 = 5 min timeout
        time.sleep(10)
        status_resp = requests.get(
            f'{GRAPH_API_BASE}/{creation_id}',
            params={'fields': 'status_code', 'access_token': IG_ACCESS_TOKEN},
            timeout=15,
        )
        status_data = status_resp.json()
        status_code = status_data.get('status_code', '')
        print(f'[publish_quiet_panic] Reels status ({attempt + 1}/30): {status_code}')
        if status_code == 'FINISHED':
            break
        if status_code == 'ERROR':
            raise RuntimeError(f'Instagram Reels processing failed: {status_data}')
    else:
        raise TimeoutError('Instagram Reels processing timed out after 5 minutes')

    print('[publish_quiet_panic] Publishing IG Reels post...')
    resp = requests.post(
        f'{GRAPH_API_BASE}/{IG_USER_ID}/media_publish',
        data={'creation_id': creation_id, 'access_token': IG_ACCESS_TOKEN},
        timeout=30,
    )
    publish_data = _ig_check(resp, 'reels publish')
    media_id = publish_data['id']

    print(f'[publish_quiet_panic] Publish call returned media_id={media_id}. Fetching back to confirm live...')
    verify_resp = requests.get(
        f'{GRAPH_API_BASE}/{media_id}',
        params={'fields': 'id,permalink,media_type,timestamp', 'access_token': IG_ACCESS_TOKEN},
        timeout=30,
    )
    verify_data = _ig_check(verify_resp, 'reels post-publish verification fetch')
    permalink = verify_data.get('permalink')
    if not permalink:
        raise RuntimeError(f'IG post {media_id} did not return a permalink on fetch-back -- cannot confirm it is live: {verify_data}')

    print(f'[publish_quiet_panic] IG Reels post confirmed live: {permalink}')
    return {'media_id': media_id, 'permalink': permalink, 'raw_response': verify_data}


# ---------------------------------------------------------------------------
# YouTube Short upload -- duplicated from publish.py's post_youtube_short:
# same channel-identity guard and fetch-back verification, copied as its
# own function here.
# ---------------------------------------------------------------------------

def build_yt_metadata(set_title: str, set_number, script: str) -> dict:
    base_title = f'{set_title} ({set_number})' if set_number else set_title
    title = f'{base_title} | The Quiet Panic #Shorts'[:100]
    description = (
        f'{script}\n\n'
        f"📍 Bricks of India — India's only LEGO price tracker\n"
        f'🔗 bricksofindia.com\n\n'
        f'#LEGO #LEGOIndia #LEGOSets #BricksofIndia #QuietPanic #Shorts'
    )
    return {'title': title, 'description': description}


def _load_youtube_credentials():
    if not YOUTUBE_CLIENT_SECRETS:
        print('[publish_quiet_panic] YOUTUBE_CLIENT_SECRETS not set.', file=sys.stderr)
        return None

    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from google.auth.exceptions import RefreshError

    try:
        token_data = json.loads(YOUTUBE_CLIENT_SECRETS.lstrip('﻿').strip())
    except json.JSONDecodeError as exc:
        print(f'[publish_quiet_panic] YOUTUBE_CLIENT_SECRETS is not valid JSON: {exc}', file=sys.stderr)
        return None

    creds = Credentials.from_authorized_user_info(token_data, YT_SCOPES)
    if creds.expired and creds.refresh_token:
        print('[publish_quiet_panic] Refreshing YouTube token...')
        try:
            creds.refresh(Request())
        except RefreshError as exc:
            print(f'[publish_quiet_panic] YouTube token refresh failed: {exc}', file=sys.stderr)
            return None
    return creds


def post_youtube_short(video_path: str, title: str, description: str) -> dict:
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    creds = _load_youtube_credentials()
    if creds is None:
        raise RuntimeError('YouTube credentials unavailable -- cannot publish.')

    youtube = build('youtube', 'v3', credentials=creds)

    channel_response = youtube.channels().list(part='snippet', mine=True).execute()
    if not channel_response.get('items'):
        raise RuntimeError('[guard] No YouTube channel found for authenticated user. Aborting.')
    channel_title = channel_response['items'][0]['snippet']['title']
    if channel_title != 'Bricks of India':
        raise RuntimeError(f"[guard] WRONG CHANNEL: {channel_title}. Expected 'Bricks of India'. Aborting.")
    print(f'[publish_quiet_panic] Authenticated channel confirmed: {channel_title}')

    print(f'[publish_quiet_panic] Uploading YouTube Short: {title[:60]}...')
    request = youtube.videos().insert(
        part='snippet,status',
        body={
            'snippet': {
                'title': title,
                'description': description,
                'tags': ['LEGO', 'LEGOIndia', 'LEGOSets', 'BricksofIndia', 'QuietPanic', 'Shorts'],
                'categoryId': '24',
            },
            'status': {
                'privacyStatus': 'public',
                'containsSyntheticMedia': True,
            },
        },
        media_body=MediaFileUpload(video_path, mimetype='video/mp4', resumable=True),
    )
    response = request.execute()
    video_id = response['id']
    print(f'[publish_quiet_panic] Upload call returned video_id={video_id}. Fetching back to confirm live...')

    verify_response = youtube.videos().list(part='snippet,status,processingDetails', id=video_id).execute()
    items = verify_response.get('items', [])
    if not items:
        raise RuntimeError(f'YouTube video {video_id} not found on fetch-back -- cannot confirm it exists: {verify_response}')

    url = f'https://youtube.com/shorts/{video_id}'
    print(f'[publish_quiet_panic] YouTube Short confirmed live: {url}')
    return {'video_id': video_id, 'url': url, 'raw_response': items[0]}


# ---------------------------------------------------------------------------
# Own daily cap -- independent counter against quiet_panic_posts only. No
# shared state/function with engine.py's already_published_today_ist.
# ---------------------------------------------------------------------------

def _ist_day_bounds_utc(now_utc: datetime):
    now_ist = now_utc + IST_OFFSET
    start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    start_utc = start_ist - IST_OFFSET
    end_utc = start_utc + timedelta(days=1)
    return start_utc.isoformat(), end_utc.isoformat()


def already_published_today_ist(sb):
    start, end = _ist_day_bounds_utc(datetime.now(timezone.utc))
    res = (
        sb.table('quiet_panic_posts')
        .select('id, posted_at')
        .in_('status', ['posted_ig', 'posted_yt', 'posted_both'])
        .gte('posted_at', start)
        .lt('posted_at', end)
        .limit(1)
        .execute()
    )
    return res.data[0]['id'] if res.data else None


# ---------------------------------------------------------------------------
# Orchestration -- own copy of the publish_video_post pattern, against
# quiet_panic_posts instead of video_posts.
# ---------------------------------------------------------------------------

def publish_quiet_panic_post(sb, post: dict) -> dict:
    assert_all_gates_passed(post.get('gate_results') or {})

    local_video_path = post['video_path']
    storage_url = post.get('storage_url')

    if not Path(local_video_path).exists():
        if not storage_url:
            raise RuntimeError(
                f"video_path {local_video_path!r} does not exist on this machine and no "
                f"storage_url is set -- cannot recover the video file to publish it."
            )
        print(f'[publish_quiet_panic] {local_video_path} not present locally -- downloading from {storage_url}')
        tmp_path = Path(tempfile.gettempdir()) / f"qp_{post['id']}.mp4"
        resp = requests.get(storage_url, timeout=120, stream=True)
        resp.raise_for_status()
        with open(tmp_path, 'wb') as f:
            for chunk in resp.iter_content(chunk_size=1 << 20):
                f.write(chunk)
        local_video_path = str(tmp_path)

    if not storage_url:
        filename = f"{post['id']}.mp4"
        storage_url = upload_video_to_storage(sb, local_video_path, filename)
        sb.table('quiet_panic_posts').update({'storage_url': storage_url}).eq('id', post['id']).execute()

    caption = build_ig_caption(post['script'])
    yt_meta = build_yt_metadata(post['set_title'], post.get('set_number'), post['script'])

    results: dict = {}
    errors: list = []

    try:
        ig_result = post_instagram_reels(storage_url, caption)
        sb.table('quiet_panic_posts').update({
            'ig_media_id': ig_result['media_id'],
            'ig_permalink': ig_result['permalink'],
            'ig_raw_response': ig_result['raw_response'],
        }).eq('id', post['id']).execute()
        results['ig'] = ig_result
    except Exception as exc:
        errors.append(f'Instagram: {exc}')
        print(f'[publish_quiet_panic] Instagram post failed: {exc}', file=sys.stderr)

    try:
        yt_result = post_youtube_short(local_video_path, yt_meta['title'], yt_meta['description'])
        sb.table('quiet_panic_posts').update({
            'yt_video_id': yt_result['video_id'],
            'yt_url': yt_result['url'],
            'yt_raw_response': yt_result['raw_response'],
        }).eq('id', post['id']).execute()
        results['yt'] = yt_result
    except Exception as exc:
        errors.append(f'YouTube: {exc}')
        print(f'[publish_quiet_panic] YouTube upload failed: {exc}', file=sys.stderr)

    if 'ig' in results and 'yt' in results:
        status = 'posted_both'
    elif 'ig' in results:
        status = 'posted_ig'
    elif 'yt' in results:
        status = 'posted_yt'
    else:
        status = post['status']

    if status != post['status']:
        sb.table('quiet_panic_posts').update({
            'status': status,
            'posted_at': datetime.now(timezone.utc).isoformat(),
        }).eq('id', post['id']).execute()

    results['errors'] = errors
    return results


def poll_and_publish() -> int:
    sb = get_supabase()

    already_posted_id = already_published_today_ist(sb)
    if already_posted_id:
        print(f'[publish_quiet_panic] Already published today (IST): quiet_panic_posts {already_posted_id}. '
              f'Holding all approved rows for tomorrow (daily cap={DAILY_CAP}).')
        return 0

    approved_res = sb.table('quiet_panic_posts').select('*').eq('status', 'approved').order('sequence_number').execute()
    approved_rows = approved_res.data

    if not approved_rows:
        print('[publish_quiet_panic] No approved rows found. Nothing to publish.')
        return 0

    print(f'[publish_quiet_panic] Found {len(approved_rows)} approved row(s) queued; publishing at most {DAILY_CAP} this run.')
    exit_code = 0

    for i, post in enumerate(approved_rows):
        pid = post['id']
        print(f"\n--- Publishing quiet_panic_posts {pid} ({post['set_title']}) ---")

        try:
            results = publish_quiet_panic_post(sb, post)
        except GateFailureError as exc:
            print(f'ERROR: hard guard blocked {pid}: {exc}', file=sys.stderr)
            sb.table('quiet_panic_posts').update({'status': 'publish_blocked'}).eq('id', pid).execute()
            exit_code = 1
            continue

        if 'ig' in results and 'yt' in results:
            print(f"{pid}: posted_both -- IG {results['ig']['permalink']} | YT {results['yt']['url']}")
        elif 'ig' in results:
            print(f"{pid}: posted_ig only -- IG {results['ig']['permalink']} live; YouTube FAILED: {results['errors']}", file=sys.stderr)
            exit_code = 1
        elif 'yt' in results:
            print(f"{pid}: posted_yt only -- YT {results['yt']['url']} live; Instagram FAILED: {results['errors']}", file=sys.stderr)
            exit_code = 1
        else:
            print(f"{pid}: BOTH platforms failed: {results['errors']}", file=sys.stderr)
            exit_code = 1

        if 'ig' in results or 'yt' in results:
            remaining = len(approved_rows) - i - 1
            if remaining:
                print(f'[publish_quiet_panic] Daily cap reached -- {remaining} remaining approved row(s) held.')
            break

    return exit_code


def main():
    parser = argparse.ArgumentParser(description='Quiet Panic standalone poll-and-publish (no engine.py/publish.py imports).')
    parser.add_argument('--poll-and-publish', action='store_true', help='Poll quiet_panic_posts for approved rows and publish up to the daily cap.')
    args = parser.parse_args()

    if args.poll_and_publish:
        sys.exit(poll_and_publish())
    else:
        parser.print_help()


if __name__ == '__main__':
    main()

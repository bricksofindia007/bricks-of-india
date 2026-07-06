"""
publish.py — VID-P4 posting functions: Instagram Reels + YouTube Shorts.

Reuses the proven IG container/poll/publish flow and YouTube resumable-upload
pattern from social-automation/publisher.py (same IG Business account, same
YouTube channel -- one company, one set of social accounts, shared by both
pipelines). Adds what VID-P4 needs on top:

  - A structural hard-gate guardrail (assert_all_gates_passed) that every
    publish entry point below calls FIRST -- this function never fires on a
    video_posts row with a failed gate, regardless of caller behavior.
  - Live fetch-back verification after publish: the platform's own API is
    queried post-publish to confirm the post actually exists publicly, not
    just that the publish call returned 200.
  - Disclosure policy (resolved 2026-07-06, explicit operator decision):
      * YouTube: status.containsSyntheticMedia = True on every upload -- this
        pipeline's audio is always an ElevenLabs clone of the operator's
        voice, so this is never conditional.
      * Instagram: no AI-voiceover caption suffix. Operator decision -- no
        platform-mandated requirement exists here (unlike YouTube's stated
        policy), so this is discretionary. Do not add a disclosure suffix
        without a new explicit instruction.
  - Real post IDs/URLs/raw API responses stored on video_posts on success
    (ig_media_id, ig_permalink, ig_raw_response, yt_video_id, yt_url,
    yt_raw_response) -- fields added in migration
    20260706120000_video_posts_publish_fields.sql.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

# VID-P4's own .env first, then fall back to social-automation's .env for
# IG_ACCESS_TOKEN / IG_USER_ID / YOUTUBE_CLIENT_SECRETS -- same underlying
# accounts, no reason to duplicate those secrets into a second .env file.
load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent.parent / 'social-automation' / '.env')

IG_ACCESS_TOKEN        = os.environ.get('IG_ACCESS_TOKEN', '')
IG_USER_ID             = os.environ.get('IG_USER_ID', '')
YOUTUBE_CLIENT_SECRETS = os.environ.get('YOUTUBE_CLIENT_SECRETS', '')

GRAPH_API_BASE = 'https://graph.facebook.com/v19.0'
VIDEO_STORAGE_BUCKET = 'social-assets'  # reuse the existing proven public bucket
YT_SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
]


class GateFailureError(Exception):
    """Raised by assert_all_gates_passed() -- never caught silently by callers."""


def assert_all_gates_passed(gate_results: dict) -> None:
    """
    Hard guardrail. Reads the actual stored gate_results dict (not a flag the
    caller sets) and raises if ANY gate's "pass" key is not True. Every
    publish function below calls this first, before any IG/YouTube API call.
    "_sanitization" is metadata, not a gate, and is skipped.
    """
    failed = [
        gate for gate, result in gate_results.items()
        if gate != '_sanitization' and not result.get('pass', False)
    ]
    if failed:
        raise GateFailureError(f'Refusing to publish: gate(s) failed: {", ".join(failed)}')


# ── Storage ──────────────────────────────────────────────────────────────────

def upload_video_to_storage(sb, video_path: str, filename: str) -> str:
    """
    Uploads to the same social-assets bucket SOC-AUTO-01 already uses (proven
    public-hosting mechanism -- IG's video_url field requires a publicly
    reachable URL, not a direct file upload). Filenames are namespaced under
    a video/ prefix so they never collide with SOC-AUTO-01's own
    {set_num}_reels.mp4 naming in the same bucket.
    """
    storage_path = f'video/{filename}'
    with open(video_path, 'rb') as f:
        sb.storage.from_(VIDEO_STORAGE_BUCKET).upload(
            storage_path, f,
            file_options={'content-type': 'video/mp4', 'upsert': 'true'},
        )
    public_url = sb.storage.from_(VIDEO_STORAGE_BUCKET).get_public_url(storage_path)
    print(f'[publish] Uploaded {filename} -> {public_url}')
    return public_url


def extract_and_upload_qc_frames(sb, video_path: str, video_id: str, count: int = 3) -> list[str]:
    """
    Grabs `count` still frames spread across the video (evenly spaced,
    excluding the very first/last instant) via ffmpeg, uploads each to
    storage, and returns their public URLs. Used for the Stage F post-publish
    notification so the operator can eyeball the video from a phone without
    downloading it.

    No such frame-extraction existed in the pipeline before this -- the
    "qc_frames" referenced in engine.py's comments were the operator manually
    reviewing the rendered output, not a generated artifact.
    """
    import subprocess
    import tempfile

    probe = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', video_path],
        capture_output=True, text=True, check=True,
    )
    duration = float(probe.stdout.strip())

    urls = []
    with tempfile.TemporaryDirectory() as tmpdir:
        for i in range(count):
            timestamp = duration * (i + 1) / (count + 1)
            frame_path = Path(tmpdir) / f'qc_{i}.jpg'
            subprocess.run(
                ['ffmpeg', '-y', '-ss', str(timestamp), '-i', video_path, '-frames:v', '1', '-q:v', '3', str(frame_path)],
                capture_output=True, check=True,
            )
            storage_path = f'video/qc_frames/{video_id}_{i}.jpg'
            with open(frame_path, 'rb') as f:
                sb.storage.from_(VIDEO_STORAGE_BUCKET).upload(
                    storage_path, f,
                    file_options={'content-type': 'image/jpeg', 'upsert': 'true'},
                )
            urls.append(sb.storage.from_(VIDEO_STORAGE_BUCKET).get_public_url(storage_path))

    print(f'[publish] Uploaded {len(urls)} QC frames for {video_id}')
    return urls


# ── Captions / metadata ──────────────────────────────────────────────────────

def build_ig_caption(script: str) -> str:
    """No AI-voiceover disclosure suffix -- explicit operator decision, 2026-07-06."""
    return (
        f'{script}\n\n'
        f"📍 Bricks of India — India's only LEGO price tracker\n"
        f'🔗 bricksofindia.com\n\n'
        f'#LEGO #LEGOIndia #LEGOSets #BricksofIndia #Reels'
    )


def build_yt_metadata(set_title: str, set_number: str | None, script: str) -> dict:
    base_title = f'{set_title} ({set_number})' if set_number else set_title
    title = f'{base_title} | #LEGO #Shorts'[:100]
    description = (
        f'{script}\n\n'
        f"📍 Bricks of India — India's only LEGO price tracker\n"
        f'🔗 bricksofindia.com\n\n'
        f'#LEGO #LEGOIndia #LEGOSets #BricksofIndia #Shorts #LEGOShorts'
    )
    return {'title': title, 'description': description}


# ── Instagram Reels ───────────────────────────────────────────────────────────

def _ig_check(resp: requests.Response, context: str) -> dict:
    data = resp.json()
    if resp.status_code != 200 or 'error' in data:
        err = data.get('error', {})
        raise RuntimeError(f'Instagram API error during {context}: [{err.get("code")}] {err.get("message", resp.text)}')
    return data


def post_instagram_reels(video_url: str, caption: str) -> dict:
    """
    Creates an IG Reels container, polls until FINISHED (video needs this --
    unlike images, publishing before FINISHED reliably fails), publishes, then
    fetches the published post back from the Graph API to confirm it's
    actually live (not just trusting the publish response).

    Returns {'media_id', 'permalink', 'raw_response'}.
    """
    print('[publish] Creating IG Reels media container...')
    resp = requests.post(
        f'{GRAPH_API_BASE}/{IG_USER_ID}/media',
        data={'media_type': 'REELS', 'video_url': video_url, 'caption': caption, 'access_token': IG_ACCESS_TOKEN},
        timeout=30,
    )
    creation_id = _ig_check(resp, 'reels container create')['id']
    print(f'[publish] IG Reels container ID: {creation_id}. Polling for FINISHED...')

    for attempt in range(30):  # 10s * 30 = 5 min timeout
        time.sleep(10)
        status_resp = requests.get(
            f'{GRAPH_API_BASE}/{creation_id}',
            params={'fields': 'status_code', 'access_token': IG_ACCESS_TOKEN},
            timeout=15,
        )
        status_data = status_resp.json()
        status_code = status_data.get('status_code', '')
        print(f'[publish] Reels status ({attempt + 1}/30): {status_code}')
        if status_code == 'FINISHED':
            break
        if status_code == 'ERROR':
            raise RuntimeError(f'Instagram Reels processing failed: {status_data}')
    else:
        raise TimeoutError('Instagram Reels processing timed out after 5 minutes')

    print('[publish] Publishing IG Reels post...')
    resp = requests.post(
        f'{GRAPH_API_BASE}/{IG_USER_ID}/media_publish',
        data={'creation_id': creation_id, 'access_token': IG_ACCESS_TOKEN},
        timeout=30,
    )
    publish_data = _ig_check(resp, 'reels publish')
    media_id = publish_data['id']

    # Fetch back from the platform's own API -- do not trust the publish
    # response alone. permalink only exists once the post is genuinely live.
    print(f'[publish] Publish call returned media_id={media_id}. Fetching back to confirm live...')
    verify_resp = requests.get(
        f'{GRAPH_API_BASE}/{media_id}',
        params={'fields': 'id,permalink,media_type,timestamp', 'access_token': IG_ACCESS_TOKEN},
        timeout=30,
    )
    verify_data = _ig_check(verify_resp, 'reels post-publish verification fetch')
    permalink = verify_data.get('permalink')
    if not permalink:
        raise RuntimeError(f'IG post {media_id} did not return a permalink on fetch-back -- cannot confirm it is live: {verify_data}')

    print(f'[publish] IG Reels post confirmed live: {permalink}')
    return {'media_id': media_id, 'permalink': permalink, 'raw_response': verify_data}


# ── YouTube Shorts ────────────────────────────────────────────────────────────

def _load_youtube_credentials():
    if not YOUTUBE_CLIENT_SECRETS:
        print('[publish] YOUTUBE_CLIENT_SECRETS not set.', file=sys.stderr)
        return None

    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from google.auth.exceptions import RefreshError

    try:
        token_data = json.loads(YOUTUBE_CLIENT_SECRETS.lstrip('﻿').strip())
    except json.JSONDecodeError as exc:
        print(f'[publish] YOUTUBE_CLIENT_SECRETS is not valid JSON: {exc}', file=sys.stderr)
        return None

    creds = Credentials.from_authorized_user_info(token_data, YT_SCOPES)
    if creds.expired and creds.refresh_token:
        print('[publish] Refreshing YouTube token...')
        try:
            creds.refresh(Request())
        except RefreshError as exc:
            print(f'[publish] YouTube token refresh failed: {exc}', file=sys.stderr)
            return None
    return creds


def post_youtube_short(video_path: str, title: str, description: str) -> dict:
    """
    Resumable upload via YouTube Data API v3. status.containsSyntheticMedia
    is always True -- this pipeline's audio is always an ElevenLabs voice
    clone, never conditional (2026-07-06 operator decision, holds regardless
    of anything else about the video).

    After upload, fetches the video back via videos().list() to confirm it
    actually exists and is processed, not just trusting the insert response.

    Returns {'video_id', 'url', 'raw_response'}.
    """
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
    print(f'[publish] Authenticated channel confirmed: {channel_title}')

    print(f'[publish] Uploading YouTube Short: {title[:60]}...')
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
                'containsSyntheticMedia': True,
            },
        },
        media_body=MediaFileUpload(video_path, mimetype='video/mp4', resumable=True),
    )
    response = request.execute()
    video_id = response['id']
    print(f'[publish] Upload call returned video_id={video_id}. Fetching back to confirm live...')

    verify_response = youtube.videos().list(part='snippet,status,processingDetails', id=video_id).execute()
    items = verify_response.get('items', [])
    if not items:
        raise RuntimeError(f'YouTube video {video_id} not found on fetch-back -- cannot confirm it exists: {verify_response}')

    url = f'https://youtube.com/shorts/{video_id}'
    print(f'[publish] YouTube Short confirmed live: {url}')
    return {'video_id': video_id, 'url': url, 'raw_response': items[0]}


# ── Orchestration ─────────────────────────────────────────────────────────────

def publish_video_post(sb, video_post: dict) -> dict:
    """
    Full publish flow for one video_posts row: hard gate check, storage
    upload (if not already done), IG Reels, YouTube Shorts, DB write of real
    post IDs/URLs/raw responses on success.

    video_post must have: id, set_title, set_number, script, gate_results,
    video_path, storage_url (nullable -- uploaded here if absent).

    Returns {'ig': {...} | absent, 'yt': {...} | absent, 'errors': [...]}.
    Platform failures are captured per-platform (one platform failing does
    not prevent the other from being attempted) and never raised past this
    function -- the caller needs the partial results dict even when
    something failed (e.g. to still send a notification showing what
    succeeded), so failure is signaled via the 'errors' key, not an
    exception. Only assert_all_gates_passed() above raises -- that's the one
    case where nothing should be attempted at all.
    """
    assert_all_gates_passed(video_post['gate_results'])

    # video_path is a path on whatever machine rendered the video -- that's
    # this machine for a local run, but a GitHub Actions runner (the cloud
    # poller, or today's one-off run triggered via workflow_dispatch) never
    # has it locally. Resolve to an actual local file either way: use it
    # directly if present, otherwise download it from storage_url (which
    # must already be set in that case -- the render step is responsible for
    # uploading before this function's caller ever runs on a different box).
    local_video_path = video_post['video_path']
    storage_url = video_post.get('storage_url')

    if not Path(local_video_path).exists():
        if not storage_url:
            raise RuntimeError(
                f"video_path {local_video_path!r} does not exist on this machine and no "
                f"storage_url is set -- cannot recover the video file to publish it."
            )
        print(f'[publish] {local_video_path} not present locally -- downloading from {storage_url}')
        tmp_path = Path(tempfile.gettempdir()) / f"{video_post['id']}.mp4"
        resp = requests.get(storage_url, timeout=120, stream=True)
        resp.raise_for_status()
        with open(tmp_path, 'wb') as f:
            for chunk in resp.iter_content(chunk_size=1 << 20):
                f.write(chunk)
        local_video_path = str(tmp_path)

    if not storage_url:
        filename = f"{video_post['id']}.mp4"
        storage_url = upload_video_to_storage(sb, local_video_path, filename)
        sb.table('video_posts').update({'storage_url': storage_url}).eq('id', video_post['id']).execute()

    if not video_post.get('qc_frame_urls'):
        qc_urls = extract_and_upload_qc_frames(sb, local_video_path, video_post['id'])
        sb.table('video_posts').update({'qc_frame_urls': qc_urls}).eq('id', video_post['id']).execute()

    caption = build_ig_caption(video_post['script'])
    yt_meta = build_yt_metadata(video_post['set_title'], video_post.get('set_number'), video_post['script'])

    results: dict = {}
    errors: list[str] = []

    try:
        ig_result = post_instagram_reels(storage_url, caption)
        sb.table('video_posts').update({
            'ig_media_id': ig_result['media_id'],
            'ig_permalink': ig_result['permalink'],
            'ig_raw_response': ig_result['raw_response'],
        }).eq('id', video_post['id']).execute()
        results['ig'] = ig_result
    except Exception as exc:
        errors.append(f'Instagram: {exc}')
        print(f'[publish] Instagram post failed: {exc}', file=sys.stderr)

    try:
        yt_result = post_youtube_short(local_video_path, yt_meta['title'], yt_meta['description'])
        sb.table('video_posts').update({
            'yt_video_id': yt_result['video_id'],
            'yt_url': yt_result['url'],
            'yt_raw_response': yt_result['raw_response'],
        }).eq('id', video_post['id']).execute()
        results['yt'] = yt_result
    except Exception as exc:
        errors.append(f'YouTube: {exc}')
        print(f'[publish] YouTube upload failed: {exc}', file=sys.stderr)

    # Status reflects exactly what actually succeeded -- never claim "posted_both"
    # if only one platform confirmed live.
    from datetime import datetime, timezone
    if 'ig' in results and 'yt' in results:
        status = 'posted_both'
    elif 'ig' in results:
        status = 'posted_ig'
    elif 'yt' in results:
        status = 'posted_yt'
    else:
        status = video_post['status']  # neither succeeded -- leave status unchanged

    if status != video_post['status']:
        sb.table('video_posts').update({
            'status': status,
            'posted_at': datetime.now(timezone.utc).isoformat(),
        }).eq('id', video_post['id']).execute()

    results['errors'] = errors
    return results

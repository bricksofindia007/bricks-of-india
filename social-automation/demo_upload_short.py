"""
demo_upload_short.py — One-off script to upload a single YouTube Short.

Used for the OAuth restricted-scope verification demo video: run this
right after youtube_oauth_helper.py so the upload uses the freshly
granted consent.

Usage (from within social-automation/, after youtube_oauth_helper.py has run):
  python demo_upload_short.py "C:\\path\\to\\your\\short.mp4"

Reads the freshly written youtube_token.json directly (not the
YOUTUBE_CLIENT_SECRETS env var), so it works immediately without
needing GitHub Secrets propagation or a restart.
"""
import json
import sys
from pathlib import Path

from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

YT_SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
]


def main():
    if len(sys.argv) != 2:
        print('Usage: python demo_upload_short.py <path-to-video.mp4>')
        sys.exit(1)

    video_path = sys.argv[1]
    if not Path(video_path).exists():
        print(f'ERROR: video file not found: {video_path}')
        sys.exit(1)

    token_path = Path('youtube_token.json')
    if not token_path.exists():
        print('ERROR: youtube_token.json not found. Run youtube_oauth_helper.py first.')
        sys.exit(1)

    token_data = json.loads(token_path.read_text())
    creds = Credentials.from_authorized_user_info(token_data, YT_SCOPES)
    if creds.expired and creds.refresh_token:
        print('[demo_upload] Refreshing token...')
        creds.refresh(Request())

    youtube = build('youtube', 'v3', credentials=creds)

    channel_response = youtube.channels().list(part='snippet', mine=True).execute()
    if not channel_response.get('items'):
        print('[guard] No YouTube channel found for authenticated user. Aborting.')
        sys.exit(1)
    channel_title = channel_response['items'][0]['snippet']['title']
    channel_id = channel_response['items'][0]['id']
    print(f'[guard] Authenticated channel: {channel_title} ({channel_id})')
    if channel_title != 'Bricks of India':
        print(f"[guard] WRONG CHANNEL: {channel_title}. Expected 'Bricks of India'. Aborting.")
        sys.exit(1)

    print(f'[demo_upload] Uploading {video_path} as a YouTube Short...')
    request = youtube.videos().insert(
        part='snippet,status',
        body={
            'snippet': {
                'title': 'Bricks of India — OAuth Verification Demo Upload #Shorts',
                'description': (
                    'Demo upload for Google OAuth restricted scope verification.\n\n'
                    '📍 Bricks of India — India\'s only LEGO price tracker\n'
                    '🔗 bricksofindia.com\n\n'
                    '#LEGO #LEGOIndia #BricksofIndia #Shorts'
                ),
                'tags': ['LEGO', 'BricksofIndia', 'Shorts'],
                'categoryId': '24',
            },
            'status': {'privacyStatus': 'public'},
        },
        media_body=MediaFileUpload(video_path, mimetype='video/mp4', resumable=True),
    )
    response = request.execute()
    video_id = response['id']
    print(f'[demo_upload] SUCCESS. Video live at: https://youtube.com/shorts/{video_id}')


if __name__ == '__main__':
    main()

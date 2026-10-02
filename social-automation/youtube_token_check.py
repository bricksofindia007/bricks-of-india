"""Read-only check of the YouTube posting login (round 10h). Posts nothing.
Prints only the channel title and the scopes Google says the token holds (never the token itself).
Exits 1 if the channel isn't "Bricks of India" or a required scope is missing."""
import sys

import requests

import publisher

REQUIRED = ['https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/youtube.force-ssl',
            'https://www.googleapis.com/auth/yt-analytics.readonly']


def main():
    creds = publisher._load_youtube_credentials()
    if creds is None:
        sys.exit('FAIL: no usable YouTube login (see message above)')
    from google.auth.transport.requests import Request
    if not creds.valid:
        creds.refresh(Request())
    info = requests.get('https://oauth2.googleapis.com/tokeninfo', params={'access_token': creds.token}, timeout=30).json()
    granted = sorted((info.get('scope') or '').split())
    from googleapiclient.discovery import build
    items = build('youtube', 'v3', credentials=creds).channels().list(part='snippet', mine=True).execute().get('items', [])
    title = items[0]['snippet']['title'] if items else '(no channel)'
    print('channel title:', title)
    print('scopes granted:', *granted, sep='\n  ')
    missing = [s for s in REQUIRED if s not in granted]
    ok = title == 'Bricks of India' and not missing
    print('missing:', missing or 'none')
    print('RESULT:', 'PASS' if ok else 'FAIL')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()

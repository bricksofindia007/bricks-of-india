"""Read-only check of the YouTube posting login (round 10h). Posts nothing.
Prints only the channel title, the scopes Google says the token holds and HTTP statuses (never a token).
Exits 1 if the channel isn't "Bricks of India" or a required scope is missing.

Round 2 (2 Oct 2026): always refresh first and ask tokeninfo about THAT fresh access token. The stored
access token can be stale; googleapiclient refreshes silently on a 401, so the channel call worked while
tokeninfo, asked about the stale token, returned no scopes (run 37030309810)."""
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
    if not creds.refresh_token:
        sys.exit('FAIL: the stored login has no refresh token')
    from google.auth.transport.requests import Request
    creds.refresh(Request())  # raises on failure; a fresh access token is required for tokeninfo
    print('token refresh: OK (fresh access token)')
    r = requests.get('https://oauth2.googleapis.com/tokeninfo', params={'access_token': creds.token}, timeout=30)
    info = r.json() if r.headers.get('content-type', '').startswith('application/json') else {}
    print('tokeninfo HTTP', r.status_code, '' if r.ok else f"({info.get('error_description') or info.get('error') or 'no detail'})")
    granted = sorted((info.get('scope') or '').split())
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    try:
        items = build('youtube', 'v3', credentials=creds).channels().list(part='snippet', mine=True).execute().get('items', [])
        print('channels.list HTTP 200')
    except HttpError as e:
        print('channels.list HTTP', e.resp.status, str(e.reason)[:200])
        items = []
    title = items[0]['snippet']['title'] if items else '(no channel)'
    print('channel title:', title)
    print('scopes granted:', *(granted or ['(none)']), sep='\n  ')
    missing = [s for s in REQUIRED if s not in granted]
    ok = r.ok and title == 'Bricks of India' and not missing
    print('missing:', missing or 'none')
    print('RESULT:', 'PASS' if ok else 'FAIL')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()

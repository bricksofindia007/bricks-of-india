"""
youtube_oauth.py — One-time local OAuth setup for YouTube Shorts uploads.

Run this ONCE on your local machine:
  1. Place client_secrets.json (downloaded from Google Cloud Console) in this directory
  2. Run: python youtube_oauth.py
  3. Log in via the browser that opens
  4. Copy the contents of youtube_token.json into GitHub Secret YOUTUBE_CLIENT_SECRETS
  5. Delete client_secrets.json and youtube_token.json from your machine

This script is NOT used in CI — it only needs to be run once.
"""

import json
import os

from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials

SCOPES = ['https://www.googleapis.com/auth/youtube.upload']
CLIENT_SECRETS_FILE = 'client_secrets.json'
TOKEN_OUTPUT_FILE = 'youtube_token.json'


def main():
    if not os.path.exists(CLIENT_SECRETS_FILE):
        print(f'ERROR: {CLIENT_SECRETS_FILE} not found.')
        print('Download it from Google Cloud Console → Credentials → your OAuth client → Download JSON')
        return

    print('Opening browser for Google OAuth consent...')
    flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_FILE, SCOPES)
    creds = flow.run_local_server(port=0)

    token_data = {
        'token': creds.token,
        'refresh_token': creds.refresh_token,
        'token_uri': creds.token_uri,
        'client_id': creds.client_id,
        'client_secret': creds.client_secret,
        'scopes': list(creds.scopes),
    }

    with open(TOKEN_OUTPUT_FILE, 'w') as f:
        json.dump(token_data, f, indent=2)

    print(f'\nToken saved to {TOKEN_OUTPUT_FILE}')
    print('\nNext steps:')
    print(f'  1. Copy the contents of {TOKEN_OUTPUT_FILE} into GitHub Secret YOUTUBE_CLIENT_SECRETS')
    print(f'  2. Run: rm {CLIENT_SECRETS_FILE} {TOKEN_OUTPUT_FILE}')
    print('  3. Never commit either file.')


if __name__ == '__main__':
    main()

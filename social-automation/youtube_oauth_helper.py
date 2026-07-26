"""One-shot OAuth helper — redirect_uri set before authorization_url so the URL is valid.

Run from within social-automation/:
  pip install -r requirements.txt
  python youtube_oauth_helper.py

Requires client_secrets.json (downloaded from Google Cloud Console → Credentials →
your OAuth 2.0 Client ID → Download JSON) to be present in this directory.
The script opens a local callback server on :8080, prints the authorization URL
for you to open in a browser, then:
  1. Asks whether this OAuth app is in Testing or Production/Verified status
     in Google Cloud Console (Console -> APIs & Services -> OAuth consent
     screen) -- this can't be checked programmatically without separate
     Google Cloud API credentials this script doesn't have, so it asks rather
     than guessing.
  2. Writes youtube_token.json locally
  3. Pushes the token to GitHub Secrets as YOUTUBE_CLIENT_SECRETS via gh CLI
  4. Prints the expiry health-check.mjs will track (7 days for Testing-mode
     apps; a 180-day inactivity window for Production/Verified apps, per
     Google's own general refresh-token revocation policy -- not a fixed
     calendar expiry, since verified apps don't have one)
"""
import json
import secrets
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
]

if not Path('client_secrets.json').exists():
    print('ERROR: client_secrets.json not found in current directory.')
    print('Download it from Google Cloud Console → Credentials → your OAuth client → Download JSON')
    sys.exit(1)

flow = InstalledAppFlow.from_client_secrets_file('client_secrets.json', SCOPES)

# Must set redirect_uri before calling authorization_url — run_local_server sets this
# internally to "http://localhost:8080/" so we mirror that here.
flow.redirect_uri = 'http://localhost:8080/'

state = secrets.token_urlsafe(32)
auth_url, _ = flow.authorization_url(prompt='consent', state=state)

print('', flush=True)
print('=' * 72, flush=True)
print('OPEN THIS URL IN YOUR BROWSER:', flush=True)
print(auth_url, flush=True)
print('=' * 72, flush=True)
print('Waiting for callback on http://localhost:8080 ...', flush=True)

# Pass same state so run_local_server accepts the callback
creds = flow.run_local_server(port=8080, open_browser=False, state=state)

# Testing-mode Google Cloud OAuth apps issue refresh tokens that expire after
# 7 days; Production/Verified apps don't have a fixed calendar expiry at all
# (Google only revokes for ~6 months of total inactivity, explicit revocation,
# or a password change). Can't tell which this app is without separate Google
# Cloud API credentials this script doesn't have -- confirmed 2026-07-26 that
# evidence contradicts the old hardcoded "always 7 days" assumption (a token
# issued 2026-06-20 was still working 2026-07-22, 32 days later, well past any
# real 7-day Testing-mode limit) -- so ask instead of guessing. This value is
# what health-check.mjs Check 6b reads to warn before the real expiry hits;
# it must be persisted in the secret itself, since the health check only ever
# sees YOUTUBE_CLIENT_SECRETS, not this script's console output.
print('', flush=True)
publish_status = input(
    "Is this OAuth app's status in Google Cloud Console (APIs & Services -> "
    "OAuth consent screen) 'Testing' or 'In production'/Verified?\n"
    "Enter 'production' or 'testing': "
).strip().lower()

if publish_status in ('production', 'prod', 'verified', 'p'):
    expiry_days = 180  # Google's general inactivity-revocation window, not a fixed expiry
    print(f'[OK] Treating as Production/Verified -- tracking a {expiry_days}-day inactivity window, not a fixed expiry.', flush=True)
else:
    expiry_days = 7
    print(f'[OK] Treating as Testing mode -- refresh token expires in {expiry_days} days.', flush=True)

expiry = datetime.now(timezone.utc) + timedelta(days=expiry_days)

token_data = {
    'token':         creds.token,
    'refresh_token': creds.refresh_token,
    'token_uri':     creds.token_uri,
    'client_id':     creds.client_id,
    'client_secret': creds.client_secret,
    'scopes':        list(creds.scopes),
    'expiry':        expiry.strftime('%Y-%m-%dT%H:%M:%SZ'),
}

token_path = Path('youtube_token.json')
token_path.write_text(json.dumps(token_data, indent=2))
print('youtube_token.json written.', flush=True)

print('Pushing to GitHub Secrets via gh CLI...', flush=True)
try:
    subprocess.run(
        ['gh', 'secret', 'set', 'YOUTUBE_CLIENT_SECRETS'],
        input=token_path.read_bytes(),
        check=True,
    )
except subprocess.CalledProcessError as exc:
    print(f'gh secret set failed (exit {exc.returncode}).', flush=True)
    print('Run manually: gh secret set YOUTUBE_CLIENT_SECRETS < youtube_token.json', flush=True)
    sys.exit(1)
except FileNotFoundError:
    print('gh CLI not found — install GitHub CLI or run manually:', flush=True)
    print('  gh secret set YOUTUBE_CLIENT_SECRETS < youtube_token.json', flush=True)
    sys.exit(1)

print(f'[OK] Token stored. Next expiry: {expiry.strftime("%Y-%m-%dT%H:%M:%SZ")}', flush=True)
print('Remember to delete client_secrets.json and youtube_token.json from this directory.', flush=True)

"""One-shot OAuth helper — redirect_uri set before authorization_url so the URL is valid.

Run from within social-automation/:
  pip install -r requirements.txt
  python youtube_oauth_helper.py

Requires client_secrets.json (downloaded from Google Cloud Console → Credentials →
your OAuth 2.0 Client ID → Download JSON) to be present in this directory.
The script opens a local callback server on :8080, prints the authorization URL
for you to open in a browser, then:
  1. Writes youtube_token.json locally
  2. Pushes the token to GitHub Secrets as YOUTUBE_CLIENT_SECRETS via gh CLI
  3. Prints the next expiry date (7 days from now for Testing-mode apps)
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

token_data = {
    'token':         creds.token,
    'refresh_token': creds.refresh_token,
    'token_uri':     creds.token_uri,
    'client_id':     creds.client_id,
    'client_secret': creds.client_secret,
    'scopes':        list(creds.scopes),
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

expiry = datetime.now(timezone.utc) + timedelta(days=7)
print(f'[OK] Token stored. Next expiry: {expiry.strftime("%Y-%m-%dT%H:%M:%SZ")}', flush=True)
print('Remember to delete client_secrets.json and youtube_token.json from this directory.', flush=True)

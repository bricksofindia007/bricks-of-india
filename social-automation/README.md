# BOI Social Automation Pipeline

Automatically finds the latest high-piece-count LEGO set, generates a 1080x1080 feed image and a 1080x1920 Reels/Shorts video with Ken Burns effect, writes an India-voice caption via Gemini, posts to Instagram Feed, Instagram Reels, and YouTube Shorts, then records everything in Supabase. Runs daily at 12:00 IST via GitHub Actions.

---

## GitHub Secrets Required

| Secret | Where to get it |
|--------|----------------|
| `REBRICKABLE_API_KEY` | [rebrickable.com/api](https://rebrickable.com/api) → free account → My Keys |
| `BRICKSET_API_KEY` | [brickset.com/tools/webservices/requestkey](https://brickset.com/tools/webservices/requestkey) → free |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Already set |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Already set |
| `GEMINI_API_KEY` | ✅ Already set |
| `RESEND_API_KEY` | ✅ Already set |
| `IG_ACCESS_TOKEN` | ✅ Already set (refresh every 55 days — see below) |
| `IG_USER_ID` | ✅ Already set |
| `YOUTUBE_CLIENT_SECRETS` | One-time OAuth flow — see below |

---

## Supabase Setup (one-time)

Apply the migration in the Supabase Dashboard SQL Editor:

```
supabase/migrations/20260524000000_posted_sets.sql
```

The `social-assets` storage bucket is created automatically the first time `db.py` runs.

---

## YouTube One-Time OAuth Setup

YouTube requires a local OAuth consent flow. Run this once on your machine.

### Step 1 — Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or use an existing one)
3. Enable **YouTube Data API v3** (APIs & Services → Library)
4. Go to APIs & Services → Credentials → Create Credentials → **OAuth 2.0 Client ID**
5. Application type: **Desktop app**
6. Download the JSON → save as `client_secrets.json` (do NOT commit this file)

### Step 2 — Run the auth script locally

```bash
cd social-automation
pip install -r requirements.txt
python youtube_oauth.py
```

This opens a browser, asks you to log in to the Google account that owns the YouTube channel, and generates `youtube_token.json`.

### Step 3 — Save as GitHub Secret

Copy the entire contents of `youtube_token.json` and save it as the GitHub Secret `YOUTUBE_CLIENT_SECRETS`:

```bash
# Print the token JSON
cat youtube_token.json
```

Paste that JSON blob as the secret value at:  
GitHub → Settings → Secrets and variables → Actions → New repository secret

### Step 4 — Delete local files

```bash
rm client_secrets.json youtube_token.json
```

**The token auto-refreshes on every pipeline run** as long as it has a `refresh_token` field (it will). You do not need to redo this unless you revoke access in Google account settings.

---

## How to Manually Trigger a Test Run

1. Go to the repo on GitHub
2. Actions → BOI Social Automation → Run workflow
3. Click **Run workflow** (uses `main` branch by default)

Monitor the run logs for each step. The pipeline exits with code 0 if no new sets are found (not an error).

---

## How to Refresh the Instagram Access Token

Instagram long-lived tokens expire after **60 days**. Refresh before day 55:

```bash
curl -i -X GET "https://graph.facebook.com/refresh_access_token \
  ?grant_type=fb_exchange_token \
  &client_id={APP_ID} \
  &client_secret={APP_SECRET} \
  &fb_exchange_token={CURRENT_TOKEN}"
```

Update the `IG_ACCESS_TOKEN` GitHub Secret with the new token value.

Set a calendar reminder for 55 days after each refresh.

---

## Troubleshooting: Failure Emails

Each failure email includes the module name and full traceback. Common causes:

| Module | Common failure | Fix |
|--------|---------------|-----|
| `scraper` | `REBRICKABLE_API_KEY not set` | Add the GitHub Secret |
| `scraper` | `401 Unauthorized` from Rebrickable | Key invalid — regenerate at rebrickable.com |
| `media_processor` | `No image_url for set` | Set has no image in Rebrickable yet — wait 24h |
| `media_processor` | `ffmpeg not found` | Should not happen in CI (workflow installs it). For local: `brew install ffmpeg` |
| `caption_writer` | `429 Resource Exhausted` | Gemini rate limit — wait and retry |
| `publisher` | `Error validating access token` | IG token expired — refresh it (see above) |
| `publisher` | `status_code: ERROR` on Reels | Video encoding issue — check `{set_num}_reels.mp4` locally |
| `publisher` | YouTube upload `403` | OAuth token expired or revoked — redo one-time setup |
| `db` | `relation "posted_sets" does not exist` | Apply migration SQL in Supabase dashboard |
| `notifier` | Failure email itself fails | Check `RESEND_API_KEY` and that `notifications@bricksofindia.com` is an approved sender in Resend |

---

## Local Development

Create `social-automation/.env` (never commit this):

```env
SUPABASE_URL=https://hqpaiarhmiocmjrzjhtw.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
REBRICKABLE_API_KEY=your_key
BRICKSET_API_KEY=your_key
GEMINI_API_KEY=your_key
IG_ACCESS_TOKEN=your_token
IG_USER_ID=your_id
RESEND_API_KEY=your_key
YOUTUBE_CLIENT_SECRETS={"token":"...","refresh_token":"..."}
```

Run the test sequence from the `social-automation/` directory:

```bash
cd social-automation

# Step 1 — Supabase connection
python db.py

# Step 2 — Scraper
python scraper.py

# Step 3 — Media generation
python media_processor.py

# Step 4 — Caption
python caption_writer.py

# Step 5 — Credential dry-run (no live posts)
python publisher.py --dry-run

# Step 6 — FULL LIVE RUN (posts one real set — confirm with Abhinav first)
python pipeline.py
```

Generated images/videos are saved to `social-automation/tmp/` (gitignored).

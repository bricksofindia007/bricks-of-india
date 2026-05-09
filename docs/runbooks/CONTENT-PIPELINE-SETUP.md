# Content Pipeline — Operator Setup

**Purpose:** One-time setup steps for the BOI content pipeline.  
**Audience:** Operator (Abhinav) — run once before first pipeline execution.

---

## 1. Gmail App Password

The pipeline sends a morning-brief email at 08:00 IST using a Gmail App Password.
You need this because Google blocks direct password auth for apps.

**Steps:**
1. Sign in to your Google Account at https://myaccount.google.com
2. Go to **Security** → **2-Step Verification** (must be enabled first)
3. At the bottom of the 2-Step Verification page, click **App passwords**
4. Select app: **Mail** / Select device: **Other (custom name)** → type `BOI Pipeline`
5. Click **Generate** — Google shows a 16-character password (e.g. `xxxx xxxx xxxx xxxx`)
6. Copy it immediately — Google will not show it again

Official Google docs: https://support.google.com/accounts/answer/185833

---

## 2. Add GMAIL_APP_PASSWORD to GitHub Secrets

1. Open your repo on GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `GMAIL_APP_PASSWORD`
4. Value: the 16-character app password (spaces are optional — paste as-is)
5. Click **Add secret**

Repeat for `GMAIL_USER` if not already set (value: `bricksofindia007@gmail.com`).

**All secrets the pipeline expects:**

| Secret name | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `REBRICKABLE_API_KEY` | Rebrickable API key |
| `BRICKSET_API_KEY` | Brickset API key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GMAIL_USER` | `bricksofindia007@gmail.com` |
| `GMAIL_APP_PASSWORD` | 16-char Gmail app password |
| `ADMIN_PASSWORD` | Admin route password |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 measurement ID |
| `NEXT_PUBLIC_SITE_URL` | `https://bricksofindia.com` |

---

## 3. Set ADMIN_PASSWORD

Choose a single secure password for `/admin` routes.

Rules:
- 16 or more characters
- Mix of letters, numbers, and symbols
- No spaces
- Don't reuse a password from another service

Example generator (run in terminal — don't use this exact output):
```
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Add `ADMIN_PASSWORD` to GitHub Secrets following the same steps in section 2.  
Also add it to your local `.env.local` file for dev testing.

---

## 4. YouTube Channel IDs

The pipeline reads YouTube RSS feeds using channel IDs.  
Placeholder `TBD-OPERATOR` entries exist in `config/sources.json` — fill these in.

**How to find a channel ID (view-source method):**

1. Open the YouTube channel page in your browser (e.g. `https://www.youtube.com/@SomeLEGOChannel`)
2. Right-click → **View Page Source** (or press `Ctrl+U`)
3. Press `Ctrl+F` and search for `"channelId"`
4. You'll find a line like: `"channelId":"UCxxxxxxxxxxxxxxxxxxxxxx"`
5. Copy the value starting with `UC` — that's the channel ID

**YouTube RSS feed URL format:**
```
https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxxxxxxxxxxxxxxxxxx
```

**Update `config/sources.json`:** Replace each `"TBD-OPERATOR"` with the real channel ID and feed URL.

---

## 5. Gemini API Key Smoke Test

Verify the API key works before the pipeline runs for the first time.

**Prerequisite:** `GEMINI_API_KEY` set in `.env.local`

**Run this one-off script from the project root:**

```bash
node -e "
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
model.generateContent('Say: Gemini API key confirmed working')
  .then(r => console.log('✅', r.response.text()))
  .catch(e => console.error('❌', e.message));
" 2>&1
```

**Expected output:**
```
✅ Gemini API key confirmed working
```

**Common errors:**
- `API_KEY_INVALID` — wrong key; check GitHub Secrets and `.env.local`
- `QUOTA_EXCEEDED` — hit the 1,000 RPD free-tier limit; wait until midnight Pacific Time
- `MODEL_NOT_FOUND` — wrong model name; confirm `gemini-2.5-flash-lite` is correct in Google AI Studio

---

## 6. First-run checklist

Before triggering the pipeline for the first time:

- [ ] `GMAIL_APP_PASSWORD` added to GitHub Secrets
- [ ] `ADMIN_PASSWORD` added to GitHub Secrets and `.env.local`
- [ ] `GEMINI_API_KEY` smoke test passes (section 5)
- [ ] YouTube channel IDs filled in `config/sources.json` (or left as TBD if YouTube phase is deferred)
- [ ] `npm run lint` passes locally
- [ ] `npm run build` passes locally

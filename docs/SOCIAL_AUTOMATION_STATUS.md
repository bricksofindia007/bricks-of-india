# Social Automation Pipeline — Status

**ID:** SOC-AUTO-01  
**Status:** LIVE — 3 successful runs (latest: 75641-1, 2026-05-25)  
**Last updated:** 2026-05-25

---

## Architecture

| Item | Detail |
|------|--------|
| Trigger | GitHub Actions cron — daily 06:30 UTC (12:00 IST) |
| Entry point | `social-automation/pipeline.py` |
| Language | Python 3.11 |
| Secrets | All in GitHub Secrets (IG_ACCESS_TOKEN, IG_USER_ID, YOUTUBE_CLIENT_SECRETS, REBRICKABLE_API_KEY, BRICKSET_API_KEY, GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY) |

---

## Output per run

| Platform | Format | Duration/Count | Status |
|----------|--------|----------------|--------|
| Instagram Feed | Carousel — 8 images (7 gallery + stats card) | — | ✅ Live |
| Instagram Reels | MP4 video | 8s, 3 slides, 0.3s crossfade | ✅ Live |
| YouTube Shorts | MP4 video | 45s, 10 slides, 0.5s crossfade | ✅ Live |

---

## Source priority

### Set discovery
1. **LEGO.com `/categories/coming-soon`** — intended primary source. Currently blocked by Cloudflare (403 on all plain requests). Returns 0 sets every run.
2. **Rebrickable API** — fallback. `min_year=CURRENT_YEAR`, page size 20. Returns ~20 sets.
3. **Brickset API** — fallback. `year=CURRENT_YEAR`, page size 50. Returns ~50 sets.

Merge strategy: Rebrickable wins on part count + image URL. Brickset fills: usd_price, us_date, uk_date, availability, theme name, **brickset_set_id**.

### Gallery images
- **Primary:** Brickset `getAdditionalImages` API with `setID` (from Brickset `getSets`). Returns 10–50 high-res product photos from Brickset CDN (`images.brickset.com`).
- **Minimum required:** 10 gallery images per set (sets with fewer are skipped).
- **Typical yield:** 20–30 images for recently released sets.

---

## Selection logic

1. Merge Rebrickable + Brickset sets (Rebrickable first)
2. Filter: `_is_genuinely_new()` — availability in {Not yet available, Available soon} OR us/uk release date in future OR on shelves within 14 days
3. Filter: not already in `posted_sets` Supabase table
4. Filter: remove Rebrickable placeholder names (start with `{`)
5. **India defense check:** `db.is_available_in_india(set_num)` — queries `store_prices` by bare set number. If any row exists, set is already in Indian stores → skip. Fails open. [First proven effective in run 3 — blocked 75441-1, 31385-1, 76343-1, 31376-1.]
6. Sort: highest part count first
7. Gallery enrichment: for each candidate, fetch Brickset additional images; skip if < 10 images
8. Select: first candidate with ≥ 10 gallery images

---

## Media processing

### Product images (10 total)
- **Images 1–9:** Gallery photos from Brickset CDN. Each: 1080×1080 JPEG, white canvas, centre-contained inner 960×960, BOI watermark bottom-right at 40% opacity.
- **Image 10:** Stats card. Navy background (`#0B1829`), saffron header (`#F7A800`), set name + set number + part count + price (USD / estimated INR).
- **Fallback:** If a gallery URL fails (timeout/404), skips to next available URL. With 20–50 URLs available, 1–3 failures are recoverable.

### Video: Instagram Reels (`_reels.mp4`)
- 8 seconds total, 3 slides (feed_1, feed_2, stats card)
- Segment duration: `(8 + 2×0.3) / 3 = 2.87s`
- Ken Burns zoom: +5% per slide
- Crossfade: 0.3s
- Music: `assets/background_music.mp4` at 20% volume, subclipped to 8s
- Resolution: 1080×1920, 30fps, H.264/AAC

### Video: YouTube Shorts (`_shorts.mp4`)
- 45 seconds total, 10 slides (all feed images)
- Segment duration: `(45 + 9×0.5) / 10 = 4.95s`
- Ken Burns zoom: +8% per slide
- Crossfade: 0.5s
- Music: `assets/background_music.mp4` at 20% volume, looped/trimmed to 45s
- Resolution: 1080×1920, 30fps, H.264/AAC
- **Text overlays (PIL, composited via numpy alpha blend):**
  - Slides 1–9: set name (65px white, stroke, y=80), info line `Set #X · N pieces · $Y` (38px saffron `#F7A800`, below name), theme (34px white, y=1700). All text in blurred background areas above the product image zone.
  - Slide 10 (stats card): "COMING SOON / TO INDIA 🇮🇳" (source=lego_coming_soon) or "NEW AT / BRICKSOFINDIA.COM" (source=rebrickable/brickset) at y=1540 in navy area below card.
  - Zero pixels composited in product image zone (y 420–1500) — verified via pixel zone analysis.

---

## Publishing

### Instagram carousel
- 8 images: `image_urls[:7] + [image_urls[-1]]` (7 gallery + stats card)
- API: Meta Graph API v19.0
- Flow: create 8 child containers (2s delay between each) → create CAROUSEL parent → **poll for FINISHED** (every 5s, max 18 attempts / 90s) → publish
- Caption: Gemini Flash Lite generated (Jeremy Clarkson + Indian wallet anxiety voice)
- Note: carousel parent requires FINISHED poll before publish (same as Reels). Error 9007 "Media ID not available" fires without it.

### Instagram Reels
- Video URL from Supabase Storage (public bucket)
- Flow: create REELS container → poll for FINISHED (max 5 min, 10s interval) → publish

### YouTube Shorts
- Uploaded directly from local file (not via Supabase URL)
- OAuth2 credentials stored as JSON in `YOUTUBE_CLIENT_SECRETS` GitHub Secret
- Token auto-refreshes on every run
- Account: kungfu500@gmail.com (permanent refresh token — no expiry)

---

## Storage

All assets uploaded to Supabase Storage bucket `social-assets` before publishing:
- `{set_num}_feed_1.jpg` through `{set_num}_feed_10.jpg`
- `{set_num}_reels.mp4`
- `{set_num}_shorts.mp4`

Uploaded URLs are used for IG carousel (Meta requires public HTTPS URLs for image uploads).  
Local `tmp/` files are deleted after successful upload.

---

## Caption generation

**Model:** Gemini 2.5 Flash Lite  
**Voice:** Jeremy Clarkson meets Indian wallet anxiety — dry, witty, precise. Opens with Indian hook (chai/traffic/EMIs/cricket), pivots to LEGO. Wallet is always a character.  
**Retry:** 3 attempts with 30/60/90s back-off on Gemini 503 capacity errors.  
**Source-aware footer:**
- `lego_coming_soon` / `lego_com`: DISCLAIMER — "🛑 Please do not ask when this set releases in India. I don't know. LEGO doesn't know. Nobody knows. One day it will come. One day. 🤫"
- `rebrickable` / `brickset`: NEUTRAL_SIGN_OFF — "🧱 Follow Bricks of India for LEGO news, prices & deals in India. Link in bio. #LEGOIndia #BricksofIndia"

---

## Monitoring

- **Failure:** Resend email to `abhinav@bricksofindia.com` with traceback and failing module
- **Success:** Resend email with set details + platform status summary
- **DB record:** `posted_sets` table — one row per run with `ig_feed`, `ig_reels`, `yt_shorts` booleans

---

## Token expiry

| Token | Account | Expires | Action required |
|-------|---------|---------|----------------|
| IG Access Token (long-lived) | bricksofindia Instagram | ~2026-07-23 | Re-exchange every 55 days. Alert at 7 days remaining. |
| YouTube OAuth | kungfu500@gmail.com | Permanent (refresh token) | None |

**IG System User Token (permanent):** Not yet set up. Requires Meta Business Manager → System User → generate non-expiring token. Deferred. Current workaround: 60-day long-lived token, manual re-exchange.

---

## Known issues

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| — | LEGO.com Cloudflare block | Medium | Accepted. Rebrickable/Brickset fallback works reliably. India check is the real safety layer. |
| — | Scrape Store Prices failure 2026-05-25 02:40 UTC | Low | Investigate — may be transient. Price data current from previous run (1955 rows). |

---

## Run history

| Row | Set | Date (UTC) | India check result | IG Feed | IG Reels | YouTube |
|-----|-----|------------|-------------------|---------|---------|---------|
| 1 | 11377-1 — Minas Tirith | 2026-05-24 13:10 | Pre-fix (not active) | ✅ | ✅ | ✅ |
| 2 | 76342-1 — Daily Bugle | 2026-05-24 17:58 | Active (no blocks) | ✅ | ✅ | ✅ |
| 3 | 75641-1 — Dr. Hiriluk's Hideout | 2026-05-25 02:57 | **4 sets blocked** | ✅ | ✅ | ✅ |

Run 3 India check blocked: 75441-1, 31385-1, 76343-1, 31376-1

---

## Next actions

1. Investigate Scrape Store Prices failure (02:40 UTC 2026-05-25)
2. Set calendar reminder to re-exchange IG token before 2026-07-16 (7 days before ~2026-07-23 expiry)
3. Set up IG System User Token for permanent non-expiring access (deferred, low urgency while 60-day token is active)
4. Monitor daily cron posts for correct text overlay rendering on mobile

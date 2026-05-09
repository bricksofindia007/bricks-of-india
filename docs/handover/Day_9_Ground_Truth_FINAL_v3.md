# Day 9 Ground Truth FINAL v3 — Bricks of India

**Date written:** 2026-05-10, end of Day 9 session 3 (absolute final)
**Supersedes:** Day_9_Ground_Truth.md, Day_9_Ground_Truth_FINAL.md, Day_9_Ground_Truth_FINAL_v2.md — all deprecated
**Last commit verified:** `fb42975`

Every claim below is anchored in a verified terminal command, DB query, or live URL from this session.

---

## A. Repo state

**Branch:** `main`
**Last commit:** `fb42975` — `fix(footer): two-column quick links, add The Lab, verify social links`
**Remote:** `origin/main` in sync

**Full Day 9 commit trail (sessions 2 + 3, chronological):**
```
57cd130  feat(admin): on-demand generation — Generate Article button
6d8d0f4  fix(admin): show 'Awaiting Generation' badge
5b90e1a  fix(publish): fetch OG image from source_url at publish time
276d38f  fix: hero images + INDIA_PARAGRAPH marker cleanup
afdd09a  feat(homepage): YouTube video strip from raw_signals
76d063d  fix(homepage): YoutubeStrip — filter to BOI channel only, rename heading
6e5cb1a  feat(newsletter): Server Action + confirmation email + RLS hardening
04114ee  feat(radar): add Bricks of India YouTube channel to Tier 4 sources
41856ed  fix(ci): opt into Node.js 24 action runtime across all workflows
7142b43  fix(sitemap): paginate sets query + correct ordering
e8a4f2d  chore(email): add scripts/test-email.js
c5d3400  fix(footer): add all main nav pages to Quick Links
c56df21  feat(newsletter): switch email sending to Resend API
fb42975  fix(footer): two-column quick links, add The Lab, verify social links
```

**Verification command:**
```bash
cd "C:\Users\bharg\Documents\BricksofIndia\website"
git log --oneline -15
git status  # expect: nothing to commit, working tree clean
```

---

## B. Infrastructure

| Component | Status | Evidence |
|---|---|---|
| Netlify (hosting) | ✅ Live | Auto-deploys on push to main via deploy.yml |
| GitHub Actions — deploy | ✅ Running | deploy.yml, FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true (commit 41856ed) |
| GitHub Actions — scraper | ✅ Running every 6h | scrape-prices.yml |
| GitHub Actions — RADAR cron | ✅ Running daily 17:30 UTC | radar.yml (RADAR-01 → 02 → 03 only; RADAR-04 on-demand) |
| GitHub Actions — snapshot | ✅ Running daily 03:00 UTC | snapshot-prices.yml |
| GitHub Actions — catalogue sync | ✅ Running weekly Sun 02:00 UTC | sync-catalogue.yml |
| GitHub Actions — catalogue audit | ✅ Running weekly Mon 03:30 UTC | catalogue-audit.yml |
| Node.js 24 migration | ✅ Done | FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true in all 6 workflow env blocks. Before forced date 2026-06-02. |
| Supabase | ✅ Healthy | store_prices + raw_signals + pending_drafts + newsletter_subscribers all healthy |
| Cloudflare (DNS + WAF) | ✅ Stable | NS: kira + yadiel. AI crawler policy active. |

---

## C. RADAR pipeline

**Status: Fully operational end-to-end.**

| Step | Status | Detail |
|---|---|---|
| RADAR-01 — fetch | ✅ Nightly cron | 15 sources (up from 14 — BOI YouTube added). Last run: green. |
| RADAR-02 — dedupe | ✅ Nightly cron | 4-pass design. |
| RADAR-03 — classify | ✅ Nightly cron | score ≥4 threshold. 349+ pending_drafts accumulated. |
| RADAR-04 — generate | ✅ On-demand only | "Generate Article" amber button in /admin/pending. Gemini 2.5 Flash-Lite. NOT in cron (DEFECT-012 prevention). |
| RADAR-05 — publish | ✅ Operator-initiated | "Publish" blue button in /admin/pending. Routes opinion→blog_posts, review/news→news_articles. OG image fetched at publish time. |

**Active sources (15 total):**
- Tier 1: Brothers Brick, Jay's Brick Blog, BrickNerd (New Elementary disabled — PARSER-01)
- Tier 2: Brickset (`/feed`), Rebrickable API (LEGO New Sets disabled — SPA)
- Tier 3: r/lego
- Tier 4: BrickClicker, JANGBRiCKS, Brick Vault, Tiago Catarino, Brick Finds & Flips, JB Spielwaren, **Bricks of India** (UC1CCrLlp4XnOoxVzAftFwfQ — added this session)
- Tier 5: Blocks Magazine, Brick Fanatics

**Published articles via pipeline:** 4 (Road Bike, Friends Summer 2026, NYC Architecture, Road Bike 11380). All have hero_image populated.

---

## D. Frontend — new/changed this session

### YoutubeStrip
- **File:** `src/components/content/YoutubeStrip.tsx`
- **Behaviour:** Queries `raw_signals` filtered to `source_type='youtube' AND source_name='Bricks of India'`. Deduplicates by `external_id`, shows up to 5 most recent. Returns `null` (component hidden) if BOI has no videos in raw_signals.
- **Heading:** "LATEST VIDEOS"
- **YouTube link:** `https://www.youtube.com/@BricksofIndia` (via `BRAND.youtube`)
- **Verified:** 15 BOI videos in raw_signals after RADAR-01 run post channel-add.

### Footer
- **File:** `src/components/layout/Footer.tsx`
- **Layout:** 4-column desktop (`grid-cols-4`), 2-column tablet (`grid-cols-2`, logo spans 2), stacked mobile
- **Col 1:** Logo + tagline
- **Col 2 (Pages):** Sets, Themes, Deals, Reviews, News, Blog, The Lab
- **Col 3 (Company):** About, Contact, Privacy, Terms
- **Col 4 (Connect):** YouTube (`BRAND.youtube` = `https://www.youtube.com/@BricksofIndia` ✓), Instagram, Email

### Sitemap
- **File:** `src/app/sitemap.ts`
- **Fix:** Sets query now paginated with `range()` loop — was silently capped at 1000 by PostgREST despite `.limit(10000)`. All sets now included.
- **Ordering:** `year DESC, set_number ASC` — recent sets appear first, not EAN barcodes.
- **Client:** Switched from anon `supabase` client to `createServerClient()`.

---

## E. Newsletter

### Subscription flow
1. User submits email on homepage (`NewsletterSignup.tsx` — client component)
2. Calls `subscribeNewsletter(email)` Server Action (`src/app/actions/newsletter.ts`)
3. Action inserts into `newsletter_subscribers` via service role (bypasses RLS safely)
4. Sends confirmation via **Resend SDK** (`resend@6.12.3`)
5. From: `Bricks of India <abhinav@bricksofindia.com>`
6. Duplicate emails: subscription succeeds, no email resent, different success message

### Email provider
- **Provider:** Resend (API key, not SMTP)
- **Domain verified:** `bricksofindia.com` in Resend dashboard
- **RESEND_API_KEY:** in `.env.local`, Netlify (runtime scope), GitHub Secrets
- **Test confirmed:** email id `a33f46a8` delivered to `abhinav@bricksofindia.com` 2026-05-10

### Providers investigated and rejected
- **Gmail SMTP** (`bricksofindia007@gmail.com`): works technically (tested, creds confirmed), rejected because from-address is Gmail not bricksofindia.com
- **ImprovMX SMTP:** free plan is receive-only — no outbound SMTP capability. MX records remain on ImprovMX for forwarding.

### Database
- **Table:** `newsletter_subscribers` — 2 rows as of session end (`toab82@gmail.com`, `kungfu500@gmail.com`, both active)
- **RLS:** enabled, anon INSERT only (migration `20260510000000`). No SELECT/UPDATE/DELETE for anon.

### Logging in Netlify function logs
```
[newsletter] sending confirmation to: <email>
[newsletter] confirmation sent ok to: <email>        # success
[newsletter] confirmation email FAILED — to: <email> | name: ... | message: ...  # failure
```

---

## F. Defects — all closed as of this session

| ID | Description | Status |
|---|---|---|
| DEFECT-010 | GitHub Actions Node.js 20 deprecated | ✅ Closed — `41856ed` — FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true in all 6 workflows |
| DEFECT-011 | fetchFullBody `[class*="sidebar"]` removed JBB content | ✅ Closed — `68aa474` (session 2) |
| DEFECT-012 | RADAR-04 auto-ran on all approved drafts, burning Gemini quota | ✅ Closed — `57cd130` (session 2) |

**All defects DEFECT-001 through DEFECT-012 are now closed or have documented workarounds.**

---

## G. Environment variables — complete set

| Variable | .env.local | Netlify | GitHub Secrets | Purpose |
|---|---|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | ✅ | ✅ | ✅ | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | ✅ | ✅ | ✅ | Supabase anon key |
| SUPABASE_SERVICE_ROLE_KEY | ✅ | ✅ | ✅ | Supabase service role |
| REBRICKABLE_API_KEY | ✅ | ✅ | ✅ | Rebrickable API |
| BRICKSET_API_KEY | ✅ | ✅ | ✅ | Brickset API |
| GEMINI_API_KEY | ✅ | ✅ | ✅ | Gemini 2.5 Flash-Lite |
| RESEND_API_KEY | ✅ | ✅ | ✅ | Newsletter confirmation email |
| ADMIN_PASSWORD | ✅ | ✅ | ✅ | /admin/pending auth |
| NEXT_PUBLIC_GA_MEASUREMENT_ID | ✅ | ✅ | — | GA4 |
| NEXT_PUBLIC_SITE_URL | ✅ | ✅ | — | Canonical URL |
| NETLIFY_AUTH_TOKEN | ✅ | — | ✅ | Netlify CLI/API |
| NETLIFY_SITE_ID | ✅ | — | — | Netlify site ref |
| GMAIL_USER | ✅ | ✅ | ✅ | Gmail SMTP (RADAR digest — not newsletter) |
| GMAIL_APP_PASSWORD | ✅ | ✅ | ✅ | Gmail SMTP (RADAR digest — not newsletter) |
| IMPROVMX_USER | ✅ | — | — | ImprovMX (receive-only, not used for sending) |
| IMPROVMX_PASSWORD | ✅ | — | — | ImprovMX (receive-only, not used for sending) |

---

## H. Open carry-overs entering next session

| ID | Item | Priority |
|---|---|---|
| PARSER-01 | New Elementary feed broken — needs `@extractus/feed-extractor` swap | P2 |
| PRICE-PIPELINE-01 | `lego_mrp_inr` 0% populated — catalogue audit ≥50% gate failing | P1 |
| REVIEWS-FIRST-3 | Zero reviews in table — blocks GEO-01-FU1 and RLFM | P2 |
| CONTENT-RENDER-02 | /blog markdown not rendered (raw text) | P2 |
| CONTENT-RENDER-03 | ArticleCard excerpt leaks markdown literals | P3 |
| RADAR-03-TUNE | Over-indexes Rebrickable as NEWS; misses community round-ups | P2 |
| WEB-01 | 4-gate article lint pipeline | P2 |
| LAB-05 | Price Drop Board — needs 30 days snapshot data | P3 |
| LAB-06 | Retirement Radar — needs CATALOG-04 v2 | P3 |
| DEFECT-005 | RADAR-04 format/structure voice ceiling — Day 3.5 deferred | P2 |

---

## I. Next session entry point

Recommended:
1. **PRICE-PIPELINE-01** — populate `lego_mrp_inr` on sets table. This unlocks the catalogue audit ≥50% gate and makes the price filter on /compare meaningful.
2. **REVIEWS-FIRST-3** — write 3 set reviews to the reviews table. Unlocks GEO-01-FU1 JSON-LD verification and RLFM application.
3. **CONTENT-RENDER-02** — one-line fix: add `ReactMarkdown` to `/blog/[slug]/page.tsx`.

---

*This document supersedes all previous Day 9 ground truth files. See deprecation notices in v1 and v2.*

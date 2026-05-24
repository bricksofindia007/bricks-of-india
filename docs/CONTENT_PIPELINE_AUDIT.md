# Content Pipeline Audit

**Audit date:** 2026-05-24  
**Auditor:** Claude Code session

---

## RADAR pipeline status

| Step | ID | Description | Status |
|------|----|-------------|--------|
| Fetch | RADAR-01 | RSS/JSON ingestion from 16 active sources | ✅ LIVE |
| Dedupe | RADAR-02 | 4-pass deduplication into `raw_signals` | ✅ LIVE |
| Classify | RADAR-03 | Score + classify signals into `pending_drafts` | ✅ LIVE |
| Generate | RADAR-04 | Gemini article generation (on-demand, operator-triggered) | ✅ LIVE |
| Publish | RADAR-05 | `/admin/pending` publish button → Supabase `news_articles`/`blog_posts` | ✅ LIVE — auto-publish may be failing (see below) |

**Cron schedule:** `radar.yml` — daily 17:30 UTC (23:00 IST)  
**Pipeline:** RADAR-01 → RADAR-02 → RADAR-03 (automatic). RADAR-04 and RADAR-05 are operator-initiated only.

---

## Content freshness

| Section | Last updated | Staleness | Severity |
|---------|-------------|-----------|----------|
| /news | 2026-05-09 | 15 days | **CRITICAL** |
| /reviews | 2026-05-14 | 10 days | OK — manual cadence, expected |
| /blog | 2026-04-19 | 35 days | **CRITICAL** |

### /news — 15 days stale (CRITICAL)

RADAR-01/02/03 cron has been running daily since 2026-05-09. Signals are being ingested and classified into `pending_drafts`. However, no new articles have appeared on `/news` since 2026-05-09.

**Root cause — under investigation.** Possible causes:
1. RADAR-04 is on-demand only — no articles generated since last operator session
2. RADAR-05 auto-publish (`publish-drafts.js`) may not be correctly inserting into `news_articles`
3. Operator has not visited `/admin/pending` to approve + publish pending drafts
4. Draft generation may be failing silently (Gemini 503s unhandled in generate-drafts.js)

**Most likely cause:** No operator visits to `/admin/pending` since Day 14 (2026-05-14). RADAR-04 generates article bodies only when the operator clicks "Generate Article" on an approved signal. If no operator visits, no articles are generated, and therefore nothing can be published.

**Action needed:** Operator visit to `/admin/pending` to review pending_drafts → approve → generate bodies → publish. Target: ≥3 news articles published by 2026-05-31.

### /blog — 35 days stale (CRITICAL)

Last blog post was 2026-04-19. Blog pipeline (RADAR-05 targeting `blog_posts`) has not produced output in 35 days.

**Root cause:** Blog format requires longer-form content. RADAR-04 does not distinguish blog vs. news at generation time — all generated articles go to `news_articles` or `blog_posts` based on the `format` field in `pending_drafts`. If no `blog` format signals are being classified and approved, blog stays stale.

**Action needed:** Check RADAR-03 classifier — confirm some signals are being classified as `format: blog`. If not, review classifier threshold and category mappings.

### /reviews — 10 days stale (OK)

3 reviews live (Day 14 — McLaren P1, Rivendell, NHM). Manual content, expected cadence. RADAR-08 (automated reviews pipeline) is logged but not started. Current pace insufficient for Fan CoLab application.

---

## Image repetition issue

**Symptom:** Multiple published articles appear to reuse the same hero image.

**Root cause:** `fetchOgImage()` in `src/app/admin/pending/actions.ts` fetches the OG image from the article's source URL. For some sources (particularly Rebrickable and YouTube thumbnails), all signals from the same source share the same default OG image.

**Impact:** Low visual variety on `/news` article cards. May affect click-through rate.

**Investigation needed:**
- Audit `news_articles` hero_image column — count duplicate URLs
- Review `fetchOgImage()` fallback logic — what is returned when OG image is missing?
- Consider: fallback to set image (Brickset CDN) when OG image is not unique

---

## Active sources (as of 2026-05-24)

| Tier | Source | Count | Status |
|------|--------|-------|--------|
| 1 | The Brothers Brick | 1 | ✅ Active |
| 1 | Jay's Brick Blog | 1 | ✅ Active |
| 1 | BrickNerd | 1 | ✅ Active |
| 1 | New Elementary | 1 | ✅ Active (Blogger JSON endpoint) |
| 2 | Brickset (`/feed`) | 1 | ✅ Active |
| 3 | r/lego | 1 | ✅ Active |
| 4 | BrickClicker | 1 | ✅ Active |
| 4 | JANGBRiCKS | 1 | ✅ Active |
| 4 | Brick Vault | 1 | ✅ Active |
| 4 | Tiago Catarino | 1 | ✅ Active |
| 4 | Brick Finds & Flips | 1 | ✅ Active |
| 4 | JB Spielwaren | 1 | ✅ Active |
| 4 | Bricks of India (BOI channel) | 1 | ✅ Active |
| 5 | Blocks Magazine | 1 | ✅ Active |
| 5 | Brick Fanatics | 1 | ✅ Active |
| — | LEGO New Sets | — | Disabled — SPA, requires Playwright |
| — | Rebrickable API | — | Disabled — skipped in RADAR-03 classifier |

**Total active: 15 sources**

---

## Pending actions

| Priority | Action | Owner |
|----------|--------|-------|
| P1 | Visit `/admin/pending` — review + approve + generate + publish ≥3 news articles | Abhinav |
| P1 | Investigate why blog format drafts are not being generated | Abhinav + Claude |
| P2 | Audit hero image duplication in news_articles — fix fetchOgImage() fallback | Claude |
| P2 | Verify RADAR-05 `publish-drafts.js` is correctly wiring format → target table | Claude |
| P3 | RADAR-08: automated reviews pipeline (start scoping) | Deferred to June 2026 |

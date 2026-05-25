# RADAR Auto-Publish Failure — Root Cause Report

**Investigation date:** 2026-05-25  
**Reported symptoms:** /news 16 days stale (last article 2026-04-20); /blog 36 days stale; 308 pending drafts unresolved

---

## Findings summary

**This is NOT a system failure.** The RADAR cron is healthy. The content pipeline is stalled because it requires operator action at two mandatory steps that have not been taken since April 20.

---

## Pipeline stage audit

| Stage | Component | Status | Evidence |
|-------|-----------|--------|---------|
| RADAR-01 | RSS fetch (`fetch-rss.js`) | ✅ Running | Nightly cron, all runs green |
| RADAR-02 | Dedup (`dedupe-signals.js`) | ✅ Running | `raw_signals` table: 7,403 rows, latest 2026-05-24T18:39 UTC |
| RADAR-03 | Classify (`classify-signals.js`) | ✅ Running | 312 drafts inserted into `pending_drafts` with `status='draft'` |
| RADAR-04 | Generate (`generateArticle()`) | ⛔ **OPERATOR-GATED** | Server Action requires operator to click "Generate Article" in `/admin/pending` for each draft |
| Publish | `publishDraft()` | ⛔ **OPERATOR-GATED** | Requires operator click "Publish" after generation. Nothing auto-publishes. |

**Cron schedule:** `30 17 * * *` = 17:30 UTC = 23:00 IST. All nightly runs succeeded.

---

## Why content stopped on April 20

The last batch of 24 articles was published April 1–20 manually. After April 20, the operator stopped visiting `/admin/pending`. The cron continued inserting new draft signals every night, but:
- No one ran "Generate Article" on any new approved signal
- No one clicked "Publish" on any generated draft

As of 2026-05-25 Supabase query, `pending_drafts` breakdown:
- `draft` (raw signals, awaiting approval): 5
- `approved` (awaiting Generate Article click): 312
- `published`: 6

The 312 approved signals have bodies missing — they need a "Generate Article" click each, which calls Gemini 2.5 Flash-Lite and populates `draft_body`.

---

## Image repetition bug

**Symptom:** `images.brickset.com/sets/images/60422-1.jpg` appeared as hero image for 4 separate published articles.

**Root cause:** `fetchOgImage()` in `publishDraft()` fetches the `og:image` meta tag from the source article URL. When multiple different news sources (Brothers Brick, Jay's Brick Blog, etc.) all write about the same LEGO set, they each use Brickset's canonical product image as their OG image — same URL across all articles.

**Fix applied (2026-05-25):** Added dedup guard in `publishDraft()` — after fetching the OG image, queries the target table for existing rows with the same `hero_image` URL. If a match is found, sets `heroImage = null` and publishes without a hero image rather than repeating the same image. `const heroImage` changed to `let heroImage` to allow reassignment.

**File:** `src/app/admin/pending/actions.ts` — lines 471–492 (dedup block added after Gate 4).

---

## What RADAR-04 auto-generation was and why it was removed

DEFECT-012: RADAR-04 was previously wired into `radar.yml` as a nightly auto-generation step. This was removed because:
1. It burned Gemini quota on every approved signal regardless of quality
2. Some signals had bad source URLs or paywalled content — auto-generation produced low-quality drafts with no operator review
3. The operator-review gate was the core value — it filters noise before Gemini spend

**Current design is intentional.** The pipeline is gated by design.

---

## Corrected attribution — 02:40 UTC 2026-05-25 failures

The GitHub Actions failures at 02:40 and 02:41 UTC on 2026-05-25 that initially appeared in the monitoring email were **BOI Social Automation** (workflow: `social-automation.yml`) manual test runs triggered before the `libgl1` package fix was pushed to main — NOT Scrape Store Prices. Confirmed by:
- `gh run list --workflow "Scrape Store Prices"` showing all successes
- `gh run list --workflow "BOI Social Automation"` showing two failures at exactly those times with `libgl1-mesa-glx` package-not-found errors

---

## Operator actions required (for Abhinav)

1. Visit `https://bricksofindia.com/admin/pending?status=approved`
2. For each signal: click **Generate Article** (calls Gemini, populates body — ~10s per article)
3. Review the generated body, edit if needed
4. Click **Publish**

**Gemini rate limit:** 10 RPM free tier. Add manual pause between articles. Do not click Generate on more than 8 articles per minute.

**Batch suggestion:** Start with the highest-quality signals (Tier 1 sources: Brothers Brick, Jay's Brick Blog, BrickNerd). Discard signals from low-quality sources or about sets irrelevant to India.

---

## No code changes needed for pipeline

The system is working as designed. The only change was the image dedup fix above. Content staleness is 100% operator attention, not a technical fault.

---

## Next RADAR milestone

**RADAR-08** — automated reviews pipeline (scope deferred until content freshness stabilises, per BOI_MASTER_TRACKER.md).

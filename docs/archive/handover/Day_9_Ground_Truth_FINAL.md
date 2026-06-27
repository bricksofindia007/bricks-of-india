> **DEPRECATED — superseded by `Day_9_Ground_Truth_FINAL_v2.md`**
> This file reflects session 2 state before on-demand generation redesign, RADAR-05 publish step, DEFECT-011/012, and JBB selector fix. Read `Day_9_Ground_Truth_FINAL_v2.md` instead.

---

# Day 9 Ground Truth FINAL — Bricks of India (DEPRECATED)

**Date written:** 2026-05-09, end of session (two-part day)
**Supersedes:** Day_9_Ground_Truth.md, all prior Day 9 drafts
**Last commit:** cbb4ac9

This document is the single authoritative state of the project as of end of Day 9. Every claim is anchored in a verified terminal command, DB query, or GitHub Actions log from today's session. No claim is based on memory or prior handovers alone.

---

## A. Repo and deploy state

**Branch:** `main` at `cbb4ac9`
**Remote:** `origin/main` in sync

**Verification block:**
```bash
cd "C:\Users\bharg\Documents\BricksofIndia\website"
git log --oneline -5
git status
git branch --show-current
gh run list --repo bricksofindia007/bricks-of-india --limit 3
```
Expected: main, clean, last commit cbb4ac9, latest Netlify deploy green.

**Day 9 commit trail (chronological):**
```
84c73e3  docs(handover): Day 9 Ground Truth (session 1 — now superseded)
7bc74c9  chore(trackers): Day 9 close-out (session 1)
7fb5b6d  chore: update package-lock.json for @netlify/plugin-nextjs@^5.0.0
8d178c6  fix(supabase): guard createClient against empty URL
772624d  fix(admin): Server Actions redirect+filter+bulk approve+Netlify plugin v5
60fca80  fix(admin): filter chip labels on own line
784adb6  fix(radar): PARSER-01/SCRAPE-01 + Jay's Brick Blog + sanitizeXml
1f82da0  fix(nav+sitemap+sources): Blog in nav, sitemap fixes, PARSER-01 docs
cbb4ac9  fix(nav+sitemap+sources): PARSER-01 findings documented
```

---

## B. Database state

| Table | Count | Notes |
|---|---|---|
| sets | 24,190 | Synced from Rebrickable. Weekly Sunday 02:00 UTC. |
| store_prices | ~1,900 rows | Scraped 6h. 3 stores: toycra, mybrickhouse (lego subdomain), jaiman. |
| raw_signals | ~1,200+ | Accumulated across all radar runs. |
| pending_drafts | **349** | 298 session 1 + 1 pre-existing + 50 session 2 run. status='draft', iteration_label IS NULL. |
| news_articles | 20 | Frozen — no new articles published. |
| blog_posts | 19 | Frozen. |
| reviews | 0 | Empty — blocks GEO-01-FU1 and RLFM. |
| price_snapshots | active | RLS enabled (DEFECT-007, fixed 2026-05-06). LAB-03 cron 08:30 IST. |

**RLS status:** All 11 public tables have `rowsecurity = true` as of 2026-05-06 DB fix.

---

## C. RADAR pipeline state

**Status: RADAR-01 → 02 → 03 → 04 all live in radar.yml cron (daily 17:30 UTC)**

| Stage | Script | Status |
|---|---|---|
| RADAR-01 | `scripts/radar/fetch-rss.js` | ✅ 14 sources active |
| RADAR-02 | `scripts/radar/dedupe-signals.js` | ✅ 4-pass dedup |
| RADAR-03 | `scripts/radar/classify-signals.js` | ✅ score ≥4 threshold |
| RADAR-04 | `scripts/radar/generate-drafts.js` | ✅ reads approved+no-body rows |
| RADAR-05 | `/admin/pending` | ✅ live on production |
| RADAR-06 | morning brief email | 🔴 not started |

**Last run (2026-05-09 ~16:41 UTC):**
- RADAR-01: 322 signals fetched, 0 errors, 14 sources
- RADAR-02: 280 unique, 36 title dupes, 3 cross-source groups
- RADAR-03: 997 candidates, 489 skipped (existing), 50 queued (news=47 review=3)
- RADAR-04: 0 processed (no approved rows yet — requires operator action at /admin/pending)

**Active sources (14):**

| Tier | Source | Status |
|---|---|---|
| 1 | The Brothers Brick | ✅ active |
| 1 | Jay's Brick Blog | ✅ active — added Day 9 |
| 1 | BrickNerd | ✅ active |
| 1 | New Elementary | 🔴 disabled — PARSER-01 (3 cascading XML violations) |
| 2 | Brickset | ✅ active — re-enabled Day 9 (fixed URL /feed) |
| 2 | Rebrickable Recent Sets | ✅ active |
| 2 | LEGO New Sets | 🔴 disabled — SPA, requires Playwright |
| 3 | r/lego | ✅ active (min 500 upvotes) |
| 4 | BrickClicker, JANGBRiCKS, Brick Vault, Tiago Catarino, Brick Finds & Flips, JB Spielwaren | ✅ 6 YouTube channels |
| 5 | Blocks Magazine | ✅ active — re-enabled Day 9 (fixed URL blocksmag.com/news/) |
| 5 | Brick Fanatics | ✅ active |
| 5 | LEGO Ideas Blog, Eurobricks News | 🔴 disabled — SCRAPE-01 |

---

## D. /admin/pending state

- **URL:** bricksofindia.com/admin/pending
- **Auth:** cookie `boi_admin` = `ADMIN_PASSWORD` env var. 8h session.
- **Filters:** status chips (draft/approved/rejected), format chips (news/review/opinion), source domain chips (data-driven), bulk approve button.
- **Server Actions:** use `redirect(redirectTo)` — NOT `revalidatePath` (Netlify ISR doesn't work same as Vercel).
- **349 drafts** currently status='draft', awaiting operator review.
- **Netlify plugin v5** pinned in package.json — required for Server Actions support.

---

## E. Bugs closed today (session 2)

| ID | Description | Fix |
|---|---|---|
| BUG-01/02/03 | Nav Sets→/compare, hero CTAs→/compare | Fixed to /sets (commit `4651696`) |
| SERVER-ACTIONS-01 | Approve/Reject buttons did nothing on production | redirect() not revalidatePath(); plugin v5 (commit `772624d`) |
| NETLIFY-ENV | Opaque Digest crash on /admin/pending | supabase.ts guard; NEXT_PUBLIC_SUPABASE_URL must be in Netlify env UI |
| PARSER-01-BRICKSET | Wrong URL `/article/rss` returned HTML | Fixed to `/feed` (commit `784adb6`) |
| SCRAPE-01-BLOCKS | Hostname mismatch after www redirect | Fixed URL to `blocksmag.com/news/` (commit `784adb6`) |
| SITEMAP-01 | /compare in sitemap (should be /sets); /calendar in sitemap (doesn't exist) | Fixed (commit `1f82da0`) |

---

## F. Still open

| ID | Description | Priority |
|---|---|---|
| PARSER-01 | New Elementary feed — 3 cascading XML violations, needs @extractus/feed-extractor swap | P2 |
| RADAR-03-TUNE | Classifier: Rebrickable signals always 'news'; BrickNerd digests not caught as community | P2 |
| PRICE-PIPELINE-01 | lego_mrp_inr 0% populated — catalogue-audit keeps failing; price filter thin | P1 |
| CONTENT-RENDER-02/03 | Markdown on /blog; excerpt leakage in ArticleCard | P2 |
| BUG-04 | DK books / non-LEGO ISBNs appearing in /compare | Low |
| DEFECT-010 | actions/checkout + setup-node on Node.js 20, deadline 2026-06-02 | Medium |
| RADAR-04-FULLTEXT | RADAR-04 drafts from 500-char excerpt; Tier 1 bodies richer | P3 |
| REVIEWS-FIRST-3 | 0 reviews in DB — blocks GEO-01-FU1, RLFM | P1 |
| WEB-01 | 4-gate article lint pipeline | P1 |
| DATA-01 scraper coverage | 94.7% of store products unmatched (sets not in DB) | P2 |

---

## G. Next session priorities (in order)

1. **Approve some signals at /admin/pending** — filter to `bricknerd.com` or `brothers-brick.com`, approve editorial signals, watch RADAR-04 generate bodies on next cron tick.
2. **Write first 3 reviews** manually using Voice Codex → publish to `reviews` table. Unblocks GEO-01-FU1 and RLFM application.
3. **PARSER-01 parser swap** — install `@extractus/feed-extractor`, swap out `rss-parser` for the handleRss function, re-enable New Elementary.
4. **PRICE-PIPELINE-01** — Brickset MSRP ingestion. Unblocks catalogue-audit ≥50% gate and /compare price filter.

---

## H. Quick reference

- GitHub: `bricksofindia007/bricks-of-india`
- Supabase project: `hqpaiarhmiocmjrzjhtw`
- Local repo: `C:\Users\bharg\Documents\BricksofIndia\website`
- Last commit: `cbb4ac9`
- radar.yml cron: daily 17:30 UTC (23:00 IST)
- scrape-prices.yml cron: every 6h
- lab-03 snapshot cron: daily 08:30 IST
- catalogue-audit.yml: weekly Monday 03:30 UTC
- pending_drafts: 349 rows (all status='draft')
- store_prices: ~1,900 rows, 3 stores

---

**End of Day 9 Ground Truth FINAL.**
Next session: start at /admin/pending, approve editorial signals, let RADAR-04 generate.

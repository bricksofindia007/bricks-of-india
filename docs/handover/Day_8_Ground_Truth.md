# Day 8 Ground Truth — Bricks of India

**Date written:** 2026-05-09, end of session (IST)
**Author:** Claude (strategic layer), in session with Abhinav Bhargav
**Session duration:** ~5 hours
**Purpose:** Canonical state-of-everything for BOI as of 2026-05-09 (Day 8 session). Self-sufficient. A fresh session reading only this document should have complete visibility into what is true, what is broken, what is fixed, what is pending, and what comes next.

This document supersedes Day 7 Ground Truth on all points of conflict.

---

## How to use this document

Read sections A–G to understand current state. Read section H for what to do next. Section I documents today's session.

If you are a fresh Claude session reading this:
- Start by running the verification block at the end of section A.
- Trust this document over `userMemories`, prior handovers, or any other source where they conflict.
- The Day 7 Ground Truth remains valid for historical context but this document supersedes it.

---

## A. Repo state (verified 2026-05-09)

**Branch:** `main`
**Working tree:** clean
**Last commit:** `3a683f9` — fix(scraper): paginate sets load to bypass PostgREST 1000-row cap on knownSets

**Full Day 8 commit trail (newest first):**
```
3a683f9  fix(scraper): paginate sets load to bypass PostgREST 1000-row cap on knownSets
52b6b67  fix(scraper): use .range(0,49999) to bypass Supabase 1000-row default cap (no-op attempt)
bc3f58b  fix(scraper): load full sets table for knownSets (was truncated at 1000 rows, no-op attempt)
547cc29  fix(scraper): use lego.mybrickhouse.com subdomain; pick cheapest in-stock variant
d5dc156  fix(compare): price filter driven from store_prices not lego_mrp_inr
6af2092  chore(trackers): close DATA-01, surface PRICE-PIPELINE-01
3464bbf  docs: log DEFECT-009; close DEFECT-008
9ced905  fix(data): wire store_prices to /sets and /compare (DATA-01)
d79eedc  docs(handover): Day 7 Ground Truth
f553b7a  chore(trackers): Day 7 tracker update
```

**Open PRs:** None.

**Verification block to run at start of next session:**
```bash
cd "C:\Users\bharg\Documents\BricksofIndia\website" && git status && git log --oneline -5 && git branch --show-current
```
Expected: branch `main`, working tree clean, last commit `3a683f9`.

---

## B. Database state (verified 2026-05-09)

**Project ref:** `hqpaiarhmiocmjrzjhtw` — Free tier, PRODUCTION

### B.1 Table inventory

| Table | Row Count | Notes |
|---|---|---|
| `sets` | 24,190 | Rebrickable catalogue |
| `raw_signals` | 163+ | RADAR-01 running live, daily 17:30 UTC |
| `pending_drafts` | 5 | RADAR-04 A/B iteration rows |
| `store_prices` | **1,900** | **1,278 unique sets — up from 404 (3.2× increase)** |
| `price_snapshots` | 3,633+ | Daily snapshot cron running |
| `price_history` | 17,299+ | Queried by /deals |
| `news_articles` | 20 | Frozen since 2026-04-11 — 28+ days |
| `blog_posts` | 19 | Frozen since 2026-04-11 — 28+ days |
| `reviews` | 0 | Critical gap for RLFM application |
| `prices` | 4,848 | Deprecated. No frontend code queries this table (fixed today). |

### B.2 Scraper match rates (post-fix, verified 2026-05-09)

| Store | Products fetched | Matched | Upserted |
|---|---|---|---|
| Toycra | ~580 | 580 | 578 |
| MyBrickHouse | ~216 | 215 | 215 |
| Jaiman | ~1,131 | 1,131 | 1,073 |
| **Total** | | | **1,866** |

Previously: 207 total upserts (knownSets truncated at 1,000 rows). Now: 1,866.

### B.3 Known data gaps

- `lego_mrp_inr` NULL for all 24,190 sets. Fix: PRICE-PIPELINE-01 (unbuilt).
- `store_prices` covers 1,278 of 24,190 sets (5.3% catalogue). Improves automatically each scraper run.
- Report query for store_prices by-store breakdown hits PostgREST 1,000-row cap — cosmetic only, upserts are correct.

---

## C. Live site state (verified 2026-05-09)

**Domain:** bricksofindia.com (Cloudflare-proxied, Mumbai BOM edge)
**Last production deploy:** `3a683f9`, green.

### C.1 What changed today

- `src/app/sets/page.tsx` — prices(*) → store_prices secondary query + priceMap
- `src/app/sets/page/[page]/page.tsx` — same
- `src/app/compare/page.tsx` — same + price filter driven server-side from store_prices
- `src/components/sets/SetCard.tsx` — bestPrice type narrowed
- `scripts/scrape-now.mjs` — MBH domain fixed, variant stock logic fixed, knownSets paginated

### C.2 What is confirmed working

- `/sets` — set cards show live store prices ✅
- `/compare` — price filter returns accurate results from store_prices ✅
- `/sets/[slug]` — detail page (was already correct) ✅
- Price filter on /compare shows "(filtered by live store prices)" label ✅
- Scraper upserts 1,866 products per run across 3 stores ✅

### C.3 What is NOT on main

- `/admin/pending` route — deferred
- RADAR-03 classifier — not built
- RADAR-05 through RADAR-07 — not built
- PRICE-PIPELINE-01 — not built

### C.4 Site walk

**Still not performed.** Required next session — browse: `/`, `/sets`, `/news`, `/blog`, `/reviews`, `/deals`, `/compare`, `/themes`. Has been deferred three sessions in a row. Do this first next session.

---

## D. Workflow state (verified 2026-05-09)

| Workflow | Schedule | Last run | Status |
|---|---|---|---|
| `deploy.yml` | On push to main | 2026-05-09 ✅ | Green |
| `radar.yml` | Daily 17:30 UTC | 2026-05-09 ✅ | Green — 163 signals |
| `scrape-prices.yml` | 4× daily | 2026-05-09 ✅ | Green — 1,866 upserts (up from 207) |
| `snapshot-prices.yml` | Daily 03:00 UTC | 2026-05-09 ✅ | Green |
| `catalogue-audit.yml` | Weekly Monday | 2026-05-04 ❌ | Still failing — lego_mrp_inr NULL (PRICE-PIPELINE-01) |

---

## E. Defects (as of 2026-05-09)

| ID | Title | Severity | Status |
|---|---|---|---|
| DEFECT-001 | LAB-03 secret name wrong | High | ✅ Patched |
| DEFECT-002 | LAB-04 branch name inconsistency | Low | ✅ Patched |
| DEFECT-003 | LAB-04 LabStrip file path wrong | Medium | ✅ Patched |
| DEFECT-004 | LAB-03 marked Done before first run | Low | ✅ Patched |
| DEFECT-005 | RADAR-04 drafter structural violations | P1 | Partial — deferred |
| DEFECT-006 | gh CLI not on PATH in Claude Code Bash | P3 | Workaround documented |
| DEFECT-007 | RLS disabled on price_snapshots + pending_drafts | Critical | ✅ Patched |
| DEFECT-008 | catalogue-audit.yml missing issues:write permission | Low | ✅ Patched |
| DEFECT-009 | Listing pages reading prices(*) instead of store_prices | Medium | ✅ Patched (9ced905, d5dc156) |
| DEFECT-010 | scrape-now.mjs knownSets truncated at 1,000 rows (PostgREST default) | High | ✅ Patched (3a683f9) |

**DEFECT-010 detail:** `knownSets` loaded from Supabase without pagination — PostgREST returns max 1,000 rows by default. Sets table has 24,190 rows. Scraper matched only ~207 products per run instead of 1,866+. Fix: paginate knownSets load in 1,000-row batches covering full catalogue.

**Open:** DEFECT-009 deadline — actions/checkout@v4 + setup-node@v4 deprecated Node 20, fix before 2026-06-02 (23 days).

---

## F. Scraper architecture (confirmed 2026-05-09)

- Script: `scripts/scrape-now.mjs` (349 lines)
- Triggered by: `.github/workflows/scrape-prices.yml` (4× daily)
- Stores: Toycra (`www.toycra.com/collections/lego/products.json`), MyBrickHouse (`lego.mybrickhouse.com/products.json`), Jaiman (`jaimantoys.com/products.json`)
- Pagination: `limit=250&page=N` loop until empty batch
- Matching: `knownSets.has(setNumber)` — now loads full 24,190 sets
- Upsert key: `set_id, store_id` — one row per set per store, cheapest in-stock variant wins
- Stock logic: `variant.available === true` across all variants (fixed today)

---

## G. Content, social, video state

- News: 20 articles, frozen 29 days
- Blog: 19 posts, frozen 29 days
- Reviews: 0 — critical RLFM gap
- Pipeline infrastructure (RADAR-01/02) live but RADAR-03 + /admin/pending not built — no article flow yet

**RLFM math:** 11 weeks to August 2026. Every week without content narrows the window.

---

## H. Priority list — next session

### H.1 Immediate (next session, in order)

| # | Item | Est |
|---|---|---|
| 1 | **Site walk** — browse /, /sets, /news, /blog, /reviews, /deals, /compare, /themes. Do this first. | 5 min |
| 2 | **RADAR-03 classifier** — score/filter raw_signals, write qualifying signals to pending_drafts | 1 evening |
| 3 | **/admin/pending route** — authenticated Next.js route to review and publish pending_drafts | 1 evening |
| 4 | **First 3 reviews** — write manually using Voice Codex, publish to reviews table | 1 session |

### H.2 P1 — Within 7 days

- **PRICE-PIPELINE-01** — Brickset MSRP ingestion. Unblocks /compare full price filter, fixes catalogue-audit.
- **EL-05** — ElevenLabs voice clone test. Decision gate for video pipeline.
- **DEFECT-009** — Bump actions/checkout and setup-node to @v5 before 2026-06-02.

### H.3 What NOT to do next

- Do not start RADAR-05/06/07 before RADAR-03 and /admin/pending are live.
- Do not skip the site walk — four sessions deferred.
- Do not investigate scraper match rate further — 5.3% catalogue coverage is a data gap (PRICE-PIPELINE-01), not a scraper bug.

---

## I. Today's session — what happened

1. Reviewed Day 7 Ground Truth. Ran verification block — clean.
2. Diagnosed price filter returning zero results on /compare and /sets.
3. Discovered `prices(*)` join across sets/page.tsx, sets/page/[page]/page.tsx, compare/page.tsx — all reading deprecated empty table.
4. Fixed all three files to use store_prices secondary query + priceMap pattern (commit `9ced905`).
5. Fixed /compare price filter to drive from store_prices server-side instead of client-side against lego_mrp_inr (commit `d5dc156`).
6. Logged DEFECT-009, closed DEFECT-008 (commit `3464bbf`).
7. Updated BOI_MASTER_TRACKER.md — DATA-01 closed, PRICE-PIPELINE-01 surfaced as top blocker (commit `6af2092`).
8. Investigated 11371 (Shopping Street) showing stale price and wrong stock status.
9. Discovered MBH scraper using wrong domain (mybrickhouse.com vs lego.mybrickhouse.com) and variant.available bug.
10. Fixed MBH domain and variant stock logic (commit `547cc29`).
11. Discovered real root cause: knownSets query truncated at PostgREST 1,000-row default — scraper only matched 207 products from 24,190 sets.
12. Fixed with paginated knownSets load (commits `bc3f58b`, `52b6b67`, `3a683f9` — two failed attempts then working fix).
13. Verified: scraper now upserts 1,866 products per run (up from 207). store_prices: 1,900 rows, 1,278 unique sets.
14. Wrote this document.

---

## J. Quick-reference

- GitHub: `bricksofindia007`, repo `bricks-of-india`
- Supabase ref: `hqpaiarhmiocmjrzjhtw`
- Local repo: `C:\Users\bharg\Documents\BricksofIndia\website`
- store_prices as of session close: 1,900 rows, 1,278 unique sets
- Scraper upserts per run: ~1,866 (up from 207)
- radar.yml cron: daily 17:30 UTC (23:00 IST)
- Last commit: `3a683f9`
- Next tracker update due: end of next session

---

**End of Day 8 Ground Truth.**

Next session: run verification block in section A, do site walk (section C.4 — four sessions overdue), then proceed to H.1 item 2 (RADAR-03).

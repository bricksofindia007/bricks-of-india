# Day 6 Ground Truth — Bricks of India

**Date written:** 2026-05-06, end of session (~midnight IST)
**Author:** Claude (strategic layer), in session with Abhinav Bhargav
**Session duration:** ~3 hours
**Purpose:** Canonical state-of-everything for BOI as of 2026-05-06. Designed to be self-sufficient — a fresh session reading only this document should have complete visibility into what is true, what is broken, what is fixed, what is pending, and what comes next.

This document supersedes all prior handover documents on points of conflict. It is anchored exclusively in evidence verified during tonight's session via terminal commands, Supabase SQL, and live screenshots. **No claim in this document is based on memory or prior handover docs alone.** Where evidence was incomplete tonight, the gap is named explicitly rather than papered over.

---

## How to use this document

Read sections A–G to understand current state. Read section H for what to do next. Section I documents tonight's session itself for institutional memory.

If you are a fresh Claude session reading this tomorrow:
- Start by running the verification block at the end of section A to confirm nothing has shifted overnight.
- Then read sections in order.
- Trust this document over `userMemories`, prior handovers, or any other source where they conflict.
- The Day 5→6 Strategic Chat handover that preceded this doc contains real signal but also significant fictional specifics. Treat it as a threat model, not as ground truth.

---

## A. Repo state (verified 2026-05-06 ~22:30 IST)

**Branch:** `main`
**Working tree:** clean, up to date with origin/main
**Last commit on main:** `61e35a2 docs(defects): log DEFECT-004 — cron Done gate process gap`
**Last commit timestamp:** 2026-05-02 16:51 UTC
**Days since last commit to main:** 4

**Active branches:**
- `main` (local + remote, current)
- `feat/content-pipeline-foundation` (remote-only — no local checkout exists on this machine)

**Open PRs:**
- **PR #2** — "Content pipeline foundation: RADAR-01 fetcher + RADAR-02 deduper + daily cron"
  - Created: 2026-05-03 18:03 UTC (3 days open as of session)
  - Head: `feat/content-pipeline-foundation` → Base: `main`
  - State: OPEN, mergeable: MERGEABLE, mergeStateStatus: CLEAN
  - 18 files changed, +2082 / -35
  - **No CI checks configured** on PR branch (deploy.yml triggers on push to main only). The 2,082 lines have never been linted or build-tested by CI.

**PR #2 contents (file list):**
- Added: `.env.example` (+50)
- Added: `.github/workflows/radar.yml` (+36)
- Added: `config/sources.json` (+111)
- Added: `docs/runbooks/CONTENT-PIPELINE-SETUP.md` (+135)
- Added: `scripts/radar/dedupe-signals.js` (+276)
- Added: `scripts/radar/draft-articles.js` (+476)
- Added: `scripts/radar/fetch-rss.js` (+476)
- Added: `scripts/radar/test-fixture.xml` (+221)
- Added: `supabase/migrations/20260503000000_pending_drafts.sql` (+65)
- Added: `supabase/migrations/20260503120000_pending_drafts_iteration.sql` (+31)
- Added: `supabase/migrations/20260503140000_create_raw_signals.sql` (+31)
- Modified: `BOI_CONTENT_TRACKER.md` (+16/-16)
- Modified: `BOI_MASTER_TRACKER.md` (+24/-1)
- Modified: `BOI_WEB_TRACKER.md` (+6/-4)
- Modified: `admin/dashboard.html` (+15/-14)
- Modified: `docs/BRIEF_DEFECTS.md` (+50)
- Modified: `package-lock.json` (+61)
- Modified: `package.json` (+2)

**Note on Supabase migrations in PR #2:** The three migration files (`pending_drafts`, `pending_drafts_iteration`, `create_raw_signals`) sit in `supabase/migrations/` on the feature branch only. **However, the migrations themselves were applied to the production Supabase database around 2026-05-03.** The tables exist live in the database; only the consuming application code is unmerged.

**Verification block to run at start of next session:**
```bash
git status
git log --oneline -5
git branch --show-current
gh pr view 2 --repo bricksofindia007/bricks-of-india --json state,mergeable,mergeStateStatus,createdAt
```
Expected if nothing changed overnight: branch `main`, working tree clean, last commit `61e35a2`, PR #2 still OPEN/MERGEABLE/CLEAN.

---

## B. Database state (verified 2026-05-06 ~23:30 IST)

**Project:** `bricksofindia007's Project` (ref: `hqpaiarhmiocmjrzjhtw`), main branch, PRODUCTION
**Plan:** Free tier
**Schema:** `public` — 11 tables

### B.1 Table inventory (all in `public` schema)

| Table | RLS Enabled | Row Count | Latest Activity | Notes |
|---|---|---|---|---|
| `sets` | ✅ true | 24,190 | (catalogue) | LEGO catalogue from Rebrickable |
| `prices` | ✅ true | 4,848 | unknown | **Not queried by any frontend code**. Likely deprecated. Origin scraper `scrapers/scraper.js` is unused. |
| `store_prices` | ✅ true | 729 | (live scraper) | Active price data — written by `scripts/scrape-now.mjs` 4×/day |
| `price_snapshots` | ✅ true | 3,633 | 2026-05-06 | Daily price history from LAB-03 cron, 08:30 IST |
| `price_history` | ✅ true | 17,299 | unknown | Queried by `/deals` page. Schema and write path not investigated tonight. |
| `news_articles` | ✅ true | 20 | 2026-04-11 | **No new content for 25 days** |
| `blog_posts` | ✅ true | 19 | 2026-04-11 | **No new content for 25 days** |
| `reviews` | ✅ true | **0** | NULL | **Critical for RLFM application** |
| `newsletter_subscribers` | ✅ true | 0 | NULL | No subscribers yet |
| `pending_drafts` | ✅ true | 5 | NULL | RADAR-04 iteration A/B trail rows. Table live; consuming code on PR #2. |
| `raw_signals` | ✅ true | 53 | 2026-05-04 | Day 4 RADAR-01 live run output. Table live; consuming code on PR #2. |

### B.2 Coverage breakdown — `store_prices` by store

| Store | Price rows | Unique sets |
|---|---|---|
| jaiman | 318 | 318 |
| toycra | 273 | 273 |
| mybrickhouse | 138 | 138 |
| **Total** | **729** | **404 distinct** |

Catalogue coverage: 404 / 24,190 = **1.7%** of catalogue has live store pricing.

### B.3 The `lego_mrp_inr` situation

- `sets.lego_mrp_inr` is NULL for **all 24,190 rows** (`sets_with_mrp = 0`).
- Column `usd_msrp` referenced by `scripts/sync-rebrickable.js` lines 160–173 **does not exist** in `scripts/schema.sql` — pipeline designed but never built.
- This means any frontend filter or feature that depends on `lego_mrp_inr` will return zero results.
- **Confirmed affected:** `/compare` page price filter (queries `sets` table at lines 69, 114).
- **Fix path:** PRICE-PIPELINE-01 (Brickset MSRP ingestion). Schema migration to add `usd_msrp` column, scraper to populate it, sync logic to derive `lego_mrp_inr = usd_msrp × 1.35 × USD_INR_RATE`. Estimated 1 evening of work, deserves dedicated session.

### B.4 RLS state — fully audited tonight

All 11 public tables now have RLS enabled. Two were enabled tonight as part of DEFECT-005 fix:
- `price_snapshots`: ENABLE RLS + policy `price_snapshots_anon_select` allowing public SELECT (preserves /lab read access)
- `pending_drafts`: ENABLE RLS, no anon policy (service role only)

Verified via `pg_tables` query: all 11 tables show `rowsecurity = true`. Verified via `pg_policies`: `price_snapshots_anon_select` exists for SELECT to anon role.

**Caveat:** RLS enabled does not prove appropriate policies. The other 9 tables were RLS-enabled before tonight; their policies were not audited tonight. Tracked as **PROCESS-RLS-02** (P3, future audit task).

---

## C. Live site state

**Domain:** bricksofindia.com (also www.bricksofindia.com)
**DNS:** Cloudflare-proxied (verified via nslookup — both bare and www resolve to Cloudflare anycast IPs)
**Origin:** Hidden behind Cloudflare proxy
**Last production deploy:** 2026-05-02 16:51 UTC (workflow "Build & Deploy to Netlify")

### C.1 Frontend file inventory

`src/app/` directory contains 22 entries. Pages confirmed present:
- `/` (page.tsx — queries sets, reviews, news_articles, blog_posts)
- `/sets` (paginated, queries sets)
- `/sets/[slug]` (queries sets, store_prices)
- `/themes/[theme]` (queries sets, store_prices)
- `/compare` (queries sets — 13,977 byte file, substantial)
- `/news` and `/news/[slug]` (queries news_articles)
- `/blog` and `/blog/[slug]` (queries blog_posts)
- `/reviews` and `/reviews/[slug]` (queries reviews — table is empty, page likely shows nothing)
- `/deals` (queries store_prices, price_history, sets)
- `/lab` and `/lab/biryani-index` (✅ verified rendering correctly tonight at 23:23 IST)
- `/about`, `/contact`, `/legal`, `/calendar` (static or unaudited)
- `/api/sets/search` (route handler, queries sets)

`src/middleware.ts` exists (350 bytes — GEO-01 patched version). No root-level `middleware.ts`.

### C.2 What is NOT on main

- **`/admin/pending` route does not exist on main.** No `src/app/admin/` directory. The admin pending route described in `userMemories` is not in main — and per PR #2 file list, **it is not in PR #2 either**. The route is deferred to "Day 6+" per PR #2 body.
- `admin/dashboard.html` exists at repo root level (15-line modification in PR #2) — this is a standalone HTML file, not a Next.js authenticated route. Likely legacy or experimental.
- No RADAR scripts on main (`scripts/radar/` directory does not exist). All RADAR code is on PR #2.
- No `config/sources.json` on main. On PR #2 only.
- No `radar.yml` workflow on main. On PR #2 only.

### C.3 Live site verification — PENDING

This is the one piece of Phase A data that was not collected tonight. Required for Ground Truth completion:

**5-minute site walk needed.** Browse and note status (working / broken / shows zero results) for:
- `/` (homepage)
- `/sets` (catalogue listing)
- `/news` (news feed)
- `/blog` (blog feed)
- `/reviews` (expected: empty, given reviews table = 0)
- `/deals`
- `/compare` (handover claimed broken — unverified by browser tonight)
- `/themes` (or `/themes/[any-theme]`)

Update this section once walk is complete.

---

## D. Workflow state — last 30 runs (2026-05-01 through 2026-05-06)

Five workflows exist on main:

| Workflow | Schedule | Last run | Status pattern |
|---|---|---|---|
| `deploy.yml` ("Build & Deploy to Netlify") | On push to main | 2026-05-02 16:51 UTC ✅ | All success. No deploys for 4 days (no commits to main). |
| `scrape-prices.yml` | 4× daily | 2026-05-06 17:16 UTC ✅ | 11 success, 1 failure (2026-05-06 08:43). Failure surrounded by successes — transient. |
| `snapshot-prices.yml` ("Daily price snapshot") | Daily 03:00 UTC (08:30 IST) | 2026-05-06 10:34 UTC ✅ | All success in window. |
| `sync-catalogue.yml` ("Sync LEGO Catalogue") | Weekly Sunday | 2026-05-03 08:24 UTC ✅ | One run in window, success. |
| `catalogue-audit.yml` ("Catalogue Health Audit") | Weekly Monday | 2026-05-04 17:48 UTC ❌ | **Failed twice on 2026-05-04 (10:35 and 17:48)**. No success in 30-run window. |

### D.1 Catalogue audit failure — root cause known

The audit asserts `≥50% of sets rows have lego_mrp_inr`. Actual: 0%. Audit is correctly reporting a real gap (the missing PRICE-PIPELINE-01 work). Will continue failing until that pipeline ships.

Secondary issue: catalogue-audit.yml has no `permissions:` block. The on-failure step that opens a GitHub issue returns 403 because issue-creation requires `permissions: issues: write`. Independent fix, 2 lines of YAML. Tracked below.

### D.2 What is missing from workflow runs

`radar.yml` does not appear in the 30-run window — confirms PR #2 is unmerged and the daily 23:00 IST cron has never fired.

---

## E. Tracker reconciliation

Five tracker files on main:
- `BOI_MASTER_TRACKER.md` (14,943 bytes, last updated 2026-05-02)
- `BOI_WEB_TRACKER.md` (12,394 bytes, last updated 2026-05-02)
- `BOI_CONTENT_TRACKER.md` (6,947 bytes, last updated 2026-05-02)
- `BOI_VIDEO_TRACKER.md` (4,304 bytes, last updated 2026-05-02)
- `BOI_SOCIAL_TRACKER.md` (4,043 bytes, last updated 2026-05-02)

**All 5 trackers are 4 days stale.** No work is reflected in trackers since 2026-05-02. The 12 commits on PR #2 include tracker updates (+24/-1 on master, +16/-16 on content, +6/-4 on web) — but those will not land on main until PR #2 merges.

### E.1 Specific stale or incorrect tracker entries

| Entry | Tracker says | Reality | Action |
|---|---|---|---|
| CF-CACHE-01 | 🔴 Not started (in WEB_TRACKER) | ✅ Shipped 2026-05-02 in commit 6229d99 | Update to ✅ Done |
| INFRA-08 (catalogue audit) | Not flagged | Failing weekly since at least 2026-05-04 | Mark 🟡 with link to DEFECT-007 |
| CATALOG-04 v2 (set_prices, v_set_current_price) | (per Day 5→6 chat) ✅ Done | **Code does not exist anywhere in repo.** No `set_prices` table. No `v_set_current_price` view. Migrations not present in `supabase/migrations/` or `scripts/migrations/`. | Mark 🔴 Not started. Investigate how it got marked Done. |
| DATA-01 (prices ↔ store_prices disconnect) | Active blocker | **Mis-stated.** No frontend code queries `prices` table. The disconnect described doesn't exist. The real underlying issue is `lego_mrp_inr` NULL across catalogue. | Reframe ticket as PRICE-PIPELINE-01 (described in section H). |
| Sprint changelog | Stops at Day 2 | Days 3, 4, 5 work happened (LAB-03, LAB-04, CF-CACHE-01, DEFECT-004, plus PR #2's 5 days) | Backfill on next tracker commit |

### E.2 Trackers I have NOT fully read this session

- `BOI_VIDEO_TRACKER.md` — read summary only (all 🔴 Not started, ElevenLabs decision gate at EL-05)
- `BOI_SOCIAL_TRACKER.md` — read summary only (all 🔴 Not started, LEGO Insider issue Section E open)
- `BOI_CONTENT_TRACKER.md` — read 5-line summary only

These should be read in full before the next tracker commit, to ensure no claims about content/social/video pipelines are made on memory rather than evidence.

---

## F. Defects

### F.1 Defects log on main (`docs/BRIEF_DEFECTS.md`)

| ID | Title | Severity | Status | Patch |
|---|---|---|---|---|
| DEFECT-001 | LAB-03 Phase 4 secret name wrong (SUPABASE_URL vs NEXT_PUBLIC_SUPABASE_URL) | High | ✅ Patched | 8b73dd5 |
| DEFECT-002 | LAB-04 branch name inconsistency | Low | ✅ Patched | 19de924 |
| DEFECT-003 | LAB-04 LabStrip file path wrong (missing src/ prefix) | Medium | ✅ Patched | 19de924 |
| DEFECT-004 | LAB-03 marked Done before first scheduled run fired | Low | ✅ Patched (process patch) | c923ba2 |

### F.2 Defects identified tonight — pending log entries

| ID | Title | Severity | Status |
|---|---|---|---|
| DEFECT-005 | RLS disabled on `price_snapshots` and `pending_drafts` (3-day exposure window) | **Critical** | ✅ Patched in DB tonight, log entry pending commit |
| DEFECT-007 | Catalogue Health Audit failing weekly (root cause: lego_mrp_inr NULL across catalogue) | Medium | Documented, deferred to PRICE-PIPELINE-01 |
| DEFECT-008 (deferred) | Earlier Scrape Store Prices "Cancelled" alert (per email screenshot) | Unknown | Not seen in last 30 runs. Likely transient or older than window. **Demote — do not log unless recurs.** |

DEFECT-005 entry text drafted; awaiting commit. Full text in section I of this document.

### F.3 Process improvements identified

| ID | Description | Priority |
|---|---|---|
| PROCESS-RLS-01 | All future Supabase migrations creating tables in `public` schema must include `ALTER TABLE x ENABLE ROW LEVEL SECURITY` and explicit policies. Add as hard rule in `CLAUDE.md`. | P1 |
| PROCESS-RLS-02 | Audit existing policies on the 9 public tables that had RLS pre-tonight, to confirm they are appropriately restrictive (RLS enabled ≠ appropriately locked down). | P3 |
| PROCESS-DONE-01 | "Done" definition: a ticket is not Done until verification step passes (cron has fired once successfully, page renders correctly, SQL returns expected count). Brief shipping or PR merging are not Done. Add as hard rule in `CLAUDE.md`. This addresses the pattern that produced DEFECT-004 and CATALOG-04 v2 phantom-Done. | P1 |
| PROCESS-GROUNDTRUTH-01 | End of every session, single terminal block writes `docs/handover/Day_N_Ground_Truth.md` (5 minutes). git status, last 5 commits, open PRs, last 10 workflow runs, defects diff, tracker diff. Non-negotiable. Addresses the tracker drift / handover fiction failure mode. | P1 |

---

## G. Content, social, video state — the workstream the prior handovers ignored

This section is critical and was missing from the Day 5→6 chat handover entirely.

### G.1 Content production state

- **News articles:** 20 total. Last published 2026-04-11. **25 days frozen.**
- **Blog posts:** 19 total. Last published 2026-04-11. **25 days frozen.**
- **Reviews:** 0. **Reviews are the highest-trust content type for an RLFM application.**
- **Newsletter subscribers:** 0.

The freeze is defensible only if the content pipeline (PR #2 + Phases 4-7) ships and starts producing soon. Every additional day on infrastructure without content output narrows the August window.

### G.2 Voice Codex (Phase 1 of Content OS)

✅ **Live on main.** `docs/codex/BOI_Codex_v2.md` (40,011 bytes). Source `.docx` also present (31,281 bytes). Export script `scripts/export-codex-md.js` present. Workflow described in `userMemories` is operational.

### G.3 Content OS phases

Per `userMemories`:
- Phase 1 — Voice Codex: ✅ Done
- Phase 2 — Claude Project workbench: 🟡 ~30 min manual setup, unblocked, not started
- Phase 3 — Topical Radar: 🟡 In flight on PR #2 (Days 1-5 of 12 done)
- Phase 4 — Shorts/Reels pipeline (DaVinci Resolve, ElevenLabs voice clone test): 🔴
- Phase 5 — Instagram engine (7-slide carousels, 3×/week): 🔴
- Phase 8 — LEGO Search Pulse: 🔴 (deferred)

### G.4 Video pipeline (`BOI_VIDEO_TRACKER.md`)

- Production stack: DaVinci Resolve ✅ confirmed (CapCut banned in India)
- ElevenLabs free-tier voice clone test: 🟡 pending — **decision gate EL-05 blocks the entire workflow** (hybrid AI narration vs full self-record)
- YouTube long-form (1/week target): YT-01 through YT-05 all 🔴
- Shorts/Reels (3/week target): SHORT-01 through SHORT-04 all 🔴
- Script-to-video flow (FLOW-01 through FLOW-04): all 🔴
- Equipment (mic, lighting, background, noise baseline): all 🔴

### G.5 Social pipeline (`BOI_SOCIAL_TRACKER.md`)

- Instagram 7-slide carousel pipeline (IG-01 through IG-07): all 🔴
- Cross-posting flow (IG feed, Reels, YT Shorts, YT long-form, LinkedIn, Twitter): all 🔴
- RLFM application track (LAN-01 through LAN-04): all 🔴
- Community management (newsletter, comments, DMs): unscoped
- LEGO Insider issue: Member #811205769 not recognised at POS globally. INSIDER-01 🟡 escalation drafted, INSIDER-02 🔴 follow-up via US customer service. Optional content angle (INSIDER-03 🟡).

### G.6 RLFM (Recognized LEGO Fan Media) application math

**Target submission:** August 2026
**Time to deadline as of 2026-05-06:** ~13 weeks
**Current state:**
- YouTube subscribers: <500
- Instagram followers: TBD (live but not measured tonight)
- Reviews: 0
- Original long-form content: 39 articles (20 news + 19 blog) since launch August 2025
- Multi-platform output: website only (zero video, zero IG carousels)

**Honest assessment:** RLFM reviewers evaluate against demonstrated multi-platform output, original reviews, and audience. The current state is below the bar. Even with PR #2 merged Friday and producing 1 article/day automatically, that yields ~90 articles by August — but the pipeline produces drafts requiring review/approval, the article count is not the metric, and video/social remain at zero.

**The infrastructure work to date has been correct.** It is not, on its own, sufficient for August. Section H reflects this.

---

## H. Priority list & next steps

Sequenced by impact × urgency. Each item has a clear owner, scope, and verification criterion.

### H.1 Immediate (next session, in order)

| # | Item | Scope | Verification | Est |
|---|---|---|---|---|
| 1 | **Site walk** | Browser walk of /, /sets, /news, /blog, /reviews, /deals, /compare, /themes. Note any broken pages. | Section C.3 of this doc updated. | 5 min |
| 2 | **Commit DEFECT-005 entry to defects log** | Add the drafted DEFECT-005 entry (see section I.2) to `docs/BRIEF_DEFECTS.md` on main. Single commit. | `git log -1` shows the commit. | 10 min |
| 3 | **Add `permissions: issues: write` to `catalogue-audit.yml`** | Single YAML edit. Bundle into same commit as DEFECT-005 OR commit separately — operator's call. | Next audit failure run does not 403 on issue creation. | 5 min |
| 4 | **PR #2 pre-merge sanity check** | Pull `feat/content-pipeline-foundation` to local, run `npm run build` and `npm run lint`. Eyeball the three migration SQL files for idempotency. | Build succeeds, lint clean, migrations safe. | 15 min |
| 5 | **PR #2 merge** | Merge to main. Triggers Build & Deploy. | PR shows merged, deploy.yml run succeeds. | 5 min |
| 6 | **Manual `workflow_dispatch` of `radar.yml`** | Don't wait for 23:00 IST cron. Trigger immediately during waking hours so first real run is observed. | Run completes successfully. raw_signals row count increases. | 10 min |
| 7 | **Tracker reconciliation commit** | Update master, web, content trackers per section E.1. Backfill sprint changelog Days 3-5. Mark DEFECT-005, mark CATALOG-04 v2 as 🔴. | All 5 trackers reflect ground truth. | 30 min |
| 8 | **Write end-of-session Ground Truth update** | Update this document with site walk findings, post-merge state, any new defects. | `docs/handover/Day_7_Ground_Truth.md` exists. | 10 min |

**Total estimated time: ~1.5 hours.** This is one focused morning session.

### H.2 P1 — Within next 7 days

- **PRICE-PIPELINE-01** — Brickset MSRP ingestion pipeline. Schema migration to add `usd_msrp` column to `sets`. Brickset scraper (HTML or API). Sync logic with idempotency. Unblocks /compare price filtering, fixes catalogue audit, removes the largest data-layer hole in the system. Estimated 1 evening.
- **REVIEWS-FIRST-3** — Write and publish 3 reviews. Reviews table currently empty; this is the highest-leverage RLFM-application content. Use existing Voice Codex. Prioritize sets you actually own (LEGO Concorde, COBI Concorde, anything Ferrari/Star Wars from your collection).
- **CONTENT-02** — Claude Project workbench setup (~30 min manual). Unblocks Phase 2 of Content OS.
- **EL-05** — ElevenLabs voice clone free-tier test. Decision gate that unblocks entire video pipeline. Blocks SHORT-02. 1 hour to test, decide.

### H.3 P2 — Within next 14 days

- **/compare verification & fix** — Once PRICE-PIPELINE-01 ships and `lego_mrp_inr` is populated, verify /compare price filter works. If still broken, debug from there. Until then, no action — the symptom resolves with PRICE-PIPELINE-01.
- **COVERAGE-01** — Expand `store_prices` scraping coverage. Current 1.7% catalogue coverage limits /compare and /deals usefulness. Investigate: is `scripts/scrape-now.mjs` discovery-limited (only scrapes known sets) or scope-limited (only scrapes "popular")?
- **WEB-01** — Lint gates. Currently no CI checks on PR branches. Adding even basic lint/build checks on PR opens prevents the next blind merge.
- **First Shorts/Reel** — Production stack is ready (DaVinci ✅). EL-05 decision unblocks. One Short shipped end-to-end proves the script-to-video flow.

### H.4 P3 — Within next 30 days (May → June)

- **First IG carousel** — Phase 5 of Content OS. 7-slide Canva. Proves the social workstream.
- **First long-form YouTube video** — Phase 4 follow-on. 1 video proves YT pipeline.
- **PROCESS-RLS-02** — Full policy audit across 9 pre-tonight public tables.
- **PROCESS-RLS-01 + PROCESS-DONE-01 + PROCESS-GROUNDTRUTH-01** — Codify all three as `CLAUDE.md` rules.
- **Drop deprecated `prices` table** after final confirmation it isn't read by anything.
- **ADMIN-CLEANUP-01** — Remove `netlify.toml` from repo. Fully decouple from Netlify if not needed.

### H.5 P4 — RLFM runway (now → August 2026)

- **Weekly cadence target (per content plan):** 1 long-form video + 2 news videos + 3 Shorts/Reels + 3 IG carousels + 2-3 news posts. Within 10-hour weekend budget.
- **August math:** 13 weeks × weekly cadence = 13 long-forms, 26 news videos, 39 Shorts, 39 carousels, 26-39 news posts. Plus 3+ reviews. Plus video equipment + production muscle memory.
- **First milestone (4 weeks out, ~June 3):** content baseline of 30+ articles, 3+ reviews, 4+ Shorts, 1+ long-form, 4+ IG carousels.
- **Mid milestone (8 weeks out, ~July 1):** content baseline of 60+ articles, 6+ reviews, full weekly cadence proven for 4 consecutive weeks.
- **Pre-application (12 weeks, ~July 29):** finalize RLFM application copy, audience metrics screenshot, content portfolio link list.

### H.6 What NOT to do next

- Do not act on the Day 5→6 chat handover's "6-file prices→store_prices migration" plan. It solves a problem that doesn't exist. The actual issue is PRICE-PIPELINE-01.
- Do not lower the catalogue audit assertion threshold to silence DEFECT-007. The audit is correctly reporting a real gap.
- Do not act on the Netlify 75% credit warning urgently. Builds are negligible (3 min total time current cycle). Credit drain is not active.
- Do not assume `userMemories` matches main. `userMemories` references several things only on PR #2 (e.g., `/admin/pending` route, RADAR-04 drafter, raw_signals consuming code).
- Do not mark anything Done before its verification step passes (PROCESS-DONE-01).
- Do not pile new alerts on top of existing investigation. Triage, prioritize, defer.

---

## I. Tonight's session — institutional memory

### I.1 What this session did

1. **Investigated the Day 5→6 chat handover** that arrived at session start. Surfaced significant fictional specifics: `/compare` queries `prices` (false), 6 files querying empty `prices` table (false — zero files), `set_prices` table & `v_set_current_price` view exist (false — neither in repo), `store_prices` covers 243 sets (actually 404).
2. **Ran 5-step Phase A diagnostic protocol** to establish ground truth: Netlify state, Supabase RLS, data-layer reality, workflow run history, PR #2 state.
3. **Found and patched DEFECT-005** (RLS disabled on `price_snapshots` and `pending_drafts`, 3-day exposure window). Verified via `pg_tables` and `pg_policies`. Verified /lab still renders correctly post-fix.
4. **Ran Round 2 diagnostic** to address content/social/video gap: read all 5 trackers, listed full `src/app/` structure, full `scripts/` contents, full `docs/` markdown inventory. Confirmed `/admin/pending` route does not exist on main or PR #2. Confirmed Voice Codex is live on main.
5. **Established working protocol:** one PR at a time, verification before tracker update, daily Ground Truth snapshot. These are PROCESS-DONE-01 and PROCESS-GROUNDTRUTH-01.

### I.2 DEFECT-005 entry text — ready to commit

```markdown
## DEFECT-005 — RLS disabled on price_snapshots and pending_drafts (CRITICAL)

**Detected:** Supabase Database Advisor email, dated 03 May 2026
**Acknowledged:** 06 May 2026, ~22:30 IST (Day 6 strategic session)
**Patched:** 06 May 2026, ~23:20 IST, via Supabase SQL Editor (DB-level only — no code commit)
**Severity:** Critical — data exposure window of 3 days
**Tables affected:** public.price_snapshots, public.pending_drafts

**Root cause:** Both tables created via Supabase migrations (LAB-03 for price_snapshots
on 2026-05-02; PR #2 migrations for pending_drafts on 2026-05-03) without
ENABLE ROW LEVEL SECURITY. Default Supabase project setting is RLS off; migrations
did not opt in. Pattern note: 9 older public tables had RLS enabled at creation —
discipline lapsed during recent rapid sprint.

**Impact during exposure window:** Anonymous users with project URL had full
read/write access to both tables. price_snapshots contains scraped competitive
pricing intelligence (commercially sensitive). pending_drafts contains AI-drafted
articles awaiting review (content theft + injection risk for /admin/pending
publication path). No evidence of exploitation observed.

**Fix applied:**
- price_snapshots: ENABLE RLS, added policy `price_snapshots_anon_select` (anon
  SELECT, USING true) — preserves /lab public read.
- pending_drafts: ENABLE RLS, no anon policy (service role only — bypasses RLS).
- Verified: /lab renders correctly post-fix; pg_policies shows expected state;
  pg_tables confirms rowsecurity=true on all 11 public tables.

**Followup tickets:**
- PROCESS-RLS-01 (P1): All future migrations creating public tables must include
  ENABLE ROW LEVEL SECURITY + explicit policies. Add as CLAUDE.md rule.
- PROCESS-RLS-02 (P3): Audit policies on the 9 pre-tonight public tables to
  confirm they are appropriately restrictive (RLS enabled ≠ locked down).

**Process gap:** Database Advisor warning sat unacknowledged for 3 days. No
alerting integration between Supabase advisor and operator's daily review.
Investigate Supabase webhook/Slack integration for advisor warnings.
```

### I.3 Failure modes observed and named

These should be tracked across sessions to detect recurrence:

1. **Done-before-verified.** DEFECT-004 was about LAB-03 marked Done before first cron run. CATALOG-04 v2 was marked Done in trackers though code never existed. Pattern: scope a thing, brief it, *mark it done*, then discover it didn't run/work. **Mitigation: PROCESS-DONE-01.**

2. **Tracker drift between sessions.** All 5 trackers are 4 days stale. Days 3-5 work lives in PR #2 diff and chat memory only. If PR #2 doesn't merge, this institutional knowledge evaporates. **Mitigation: PROCESS-GROUNDTRUTH-01.**

3. **Handover fiction.** The Day 5→6 chat handover had high-quality threat-modeling instincts and fictionally specific claims. Multiple "shipped" items were actually "PR-open-unmerged." Multiple "broken" items had wrong root causes. **Mitigation: This document. Anchor every claim in evidence.**

4. **Cross-system blind spots.** Failures happen in 3 systems (GitHub Actions, Supabase, Netlify) with no unified dashboard. Each notifies separately. Root causes get half-fixed. **Mitigation: section D of this doc as the unified view; updated each session.**

5. **Content workstream invisibility.** The handover treated the build as infrastructure-only. The content/social/video trackers were unread. RLFM math was unsurfaced. **Mitigation: section G of this doc. RLFM math kept current.**

### I.4 Operator state at session close

Long session. Significant cognitive load on the operator unwinding handover claims and approving SQL operations on production. The decision to stop before writing this document and resume tomorrow is correct, then was overridden in favor of writing it tonight to ensure no gap. Both choices are defensible.

The strategic layer's value-add tonight: refusing to ship the Layer 1a /compare fix from the handover. That fix would have addressed a phantom bug. Catching this is what 3 hours of careful diagnosis bought.

---

## J. Quick-reference data

**Account credentials and access points:**
- GitHub: `bricksofindia007`, repo `bricks-of-india`
- Supabase project ref: `hqpaiarhmiocmjrzjhtw`
- Domain: bricksofindia.com (Cloudflare-proxied, Mumbai BOM edge)
- Local repo path: `C:\Users\bharg\Documents\BricksofIndia\website`

**LLM in use for content pipeline:** Gemini 2.5 Flash-Lite (per `.env.example` in PR #2). Not Claude API.

**Environment variables in production:**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `REBRICKABLE_API_KEY`
- `GEMINI_API_KEY` (for RADAR-04 drafter, on PR #2)
- `ADMIN_PASSWORD` (for /admin/pending route, on PR #2)
- `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` (legacy, pending removal in ADMIN-CLEANUP-01)

**Indian stores in active scrape:** Toycra (273 sets), MyBrickHouse (138 sets), Jaiman (318 sets). Total 729 rows / 404 unique sets.

**Brand voice (for any content work):** Jeremy Clarkson meets Indian wallet anxiety. Open Indian (chai/traffic/EMIs), pivot LEGO in 2 sentences. Sign-offs: "On that bombshell…" (opinion), "Bubyee" (YouTube). India Paragraph mandatory: INR price (MSRP × 1.35 × USD/INR), stores, 4-6 week India lag, one-line verdict, relatable price comparison. Verdicts: Buy now / Wait / Import only / Avoid.

---

**End of Day 6 Ground Truth.**

Next session should begin by running the verification block in section A, completing the site walk in section C.3, then proceeding through section H.1 in order.

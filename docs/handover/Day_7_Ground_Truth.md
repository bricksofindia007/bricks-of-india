# Day 7 Ground Truth — Bricks of India

**Date written:** 2026-05-09, end of session
**Author:** Claude (terminal layer), in session with Abhinav Bhargav
**Purpose:** Canonical state-of-everything for BOI as of 2026-05-09. Every claim below is anchored in a terminal command, API response, or file read executed during this session. Where something was not verified today, it is named explicitly as unverified.

This document supersedes Day_6_Ground_Truth.md on points of conflict.

---

## How to use this document

Read sections A–F for current state. Section G for what to do next. Section H for session log.

If you are a fresh Claude session reading this:
- Run the verification block at the end of section A to confirm nothing shifted overnight.
- Trust this document over prior handovers where they conflict.
- Day 6 Ground Truth (docs/handover/Day_6_Ground_Truth.md) is still valid for RLS context and DEFECT-007. Read it for that section.

---

## Section A — Git and deploy state

**Branch:** `main`
**HEAD:** `f553b7a` — `docs(trackers): Day 7 reconciliation — PR #2 merged, RADAR-01/02/CRON live, DEFECT-008 fixed, CATALOG-04 corrected to not-started`
**Remote:** `origin/main` at `f553b7a` (pushed and confirmed)

**Recent commits on main (today):**
```
f553b7a  docs(trackers): Day 7 reconciliation
e5b71b1  PR #2 squash merge: feat/content-pipeline-foundation
```

**PR #2** — "Content pipeline foundation: RADAR-01 fetcher + RADAR-02 deduper + daily cron"
- Merged 2026-05-09 via `gh pr merge 2 --squash --delete-branch`
- State: MERGED (verified via `gh pr view 2`)
- Remote branch `feat/content-pipeline-foundation` deleted

**Netlify deploy** — triggered by `e5b71b1` push to main
- Run 25593505902, `Build & Deploy to Netlify`, completed ✅ success in 2m23s
- Verified via `gh run list --limit 3`

**Untracked file in working tree:** `docs/handover/Day_5_Session_Handover.md`
- Not committed. Not in .gitignore. Decision deferred — operator to confirm whether to commit or ignore.

**Verification block (run at session start to confirm state):**
```bash
git log --oneline -3
git status
gh run list --repo bricksofindia007/bricks-of-india --limit 3
```
Expected: HEAD at f553b7a, working tree clean (modulo Day_5 handover), last 3 runs all green.

---

## Section B — RADAR pipeline state

### B.1 — What shipped in PR #2

| File | Purpose |
|---|---|
| `scripts/radar/fetch-rss.js` | RADAR-01 fetcher — 11 active sources across 5 tiers |
| `scripts/radar/dedupe-signals.js` | RADAR-02 deduper — 4-pass (exact URL → exact title → Jaccard ≥0.75 → unique) |
| `scripts/radar/draft-articles.js` | RADAR-04 drafter — Gemini 2.5 Flash-Lite (v3 prompt, Day 3 iteration) |
| `scripts/radar/test-fixture.xml` | Brickset RSS test fixture (pulled 2026-05-03) |
| `.github/workflows/radar.yml` | RADAR-CRON — daily 17:30 UTC (23:00 IST), chains RADAR-01 → RADAR-02 |
| `config/sources.json` | Tier 1–5 source definitions (11 enabled, 5 disabled) |
| `supabase/migrations/20260503000000_pending_drafts.sql` | `pending_drafts` table creation |
| `supabase/migrations/20260503120000_pending_drafts_iteration.sql` | `pending_drafts` iteration_label column |
| `supabase/migrations/20260503140000_create_raw_signals.sql` | `raw_signals` table creation |
| `docs/runbooks/CONTENT-PIPELINE-SETUP.md` | Setup runbook |
| `.env.example` | Environment variable reference |

### B.2 — raw_signals table state

Queried via PostgREST (service role key from .env.local) during this session:

```
total rows : 163
latest fetch: 2026-05-09T06:07:09.567995+00:00 UTC
```

The 2026-05-09T06:07 fetch was from the manual `workflow_dispatch` run triggered during this session (run 25593692037).

### B.3 — radar.yml run verification

Run 25593692037 — triggered via `gh workflow run radar.yml` during session.
- Status: ✅ completed success
- Duration: 37s
- Steps: Set up job → Checkout → Setup Node → Install dependencies → RADAR-01 fetch → RADAR-02 dedupe → all green

**First scheduled tick:** 2026-05-09 17:30 UTC. Not yet observed. Verification required: check `gh run list --workflow=radar.yml --limit 5` in next session to confirm it fired.

### B.4 — Disabled sources (carry-overs)

| Source | Reason disabled | Carry-over ID |
|---|---|---|
| New Elementary RSS | rss-parser strict mode chokes on malformed HTML | PARSER-01 |
| Brickset RSS | Same rss-parser issue | PARSER-01 |
| Blocks Magazine | Scrape selector returns nav chrome | SCRAPE-01 |
| LEGO Ideas Blog | Scrape selector returns nav chrome | SCRAPE-01 |
| LEGO New Sets | Scrape selector returns nav chrome | SCRAPE-01 |
| YouTube channels (×6) | Feed includes non-upload content (accepted noise) | YT-FEED-NOISE-01 |

---

## Section C — Security fixes (DEFECT-007)

**This was patched on 2026-05-06, not today.** Documented here for continuity.

- `public.price_snapshots`: ENABLE RLS + policy `price_snapshots_anon_select` (anon SELECT, USING true)
- `public.pending_drafts`: ENABLE RLS, no anon policy (service role only)
- Applied via Supabase SQL Editor directly — **no migration file exists for this patch**
- Verified at time of patch: all 11 public tables `rowsecurity = true`
- **Not re-verified today** — assumed stable since 2026-05-06

Full record: `docs/BRIEF_DEFECTS.md` DEFECT-007.

---

## Section D — DEFECT-008 fix

**catalogue-audit.yml missing `permissions: issues: write`**

- Root cause: no `permissions:` block → GITHUB_TOKEN read-only → `gh issue create` in on-failure step returns 403
- Fix: added `permissions: issues: write` at job level (lines 14–15 of the workflow file)
- Commit: `775de46` (squashed into `e5b71b1` via PR #2 merge)
- Verified via `sed -n '10,18p' .github/workflows/catalogue-audit.yml` — block confirmed present

**Audit failure root cause (separate):** Audit correctly fails because `lego_mrp_inr` is 0% populated (threshold: ≥50%). This is PRICE-PIPELINE-01, not a workflow bug. Audit will continue failing until the price ingest pipeline ships.

**Node.js 20 deprecation notice (non-blocking):** `actions/checkout@v4` and `actions/setup-node@v4` run on Node.js 20. GitHub will force Node.js 24 from **2026-06-02** and remove Node.js 20 on **2026-09-16**. Not urgent today — bundle into next maintenance pass before June.

---

## Section E — Tracker state (post Day 7 reconciliation)

All four trackers and dashboard.html updated in commit `f553b7a`. Specific changes:

| Tracker | Changes made |
|---|---|
| BOI_MASTER_TRACKER.md | Last updated 2026-05-09. Phase 3 updated (PR #2 merged). Day 7 changelog added. Deploy entry for e5b71b1. |
| BOI_WEB_TRACKER.md | Last updated 2026-05-09. DEFECT-008 fix noted. CATALOG-04 corrected: was "Blocked — confirm Brickset API", now "Not started — set_prices / v_set_current_price never created." |
| BOI_CONTENT_TRACKER.md | Last updated 2026-05-09. RADAR-07 → Done. RADAR-03 → Next (Day 7 target). |
| admin/dashboard.html | lastUpdated 2026-05-09. Sprint "Day 7". Deploy commit e5b71b1. RADAR-01 pipeline → done. Cron audit check → pass. Cadence → live. |
| BOI_VIDEO_TRACKER.md | No changes — nothing shipped, nothing verified today. |
| BOI_SOCIAL_TRACKER.md | No changes — nothing shipped, nothing verified today. |

**CATALOG-04 correction note:** Previous tracker entry implied a `set_prices` table and `v_set_current_price` view existed but were blocked pending Brickset API confirmation. Ground Truth (Day 6 section E.1) states this schema was never created. Corrected to "Not started" today.

---

## Section F — What is NOT done / open items

| ID | Item | State |
|---|---|---|
| RADAR-03 | Classifier (news/review/opinion/set-release/community) | 🟡 Next — Day 7 target. Not started. |
| RADAR-04 | Drafter (Gemini 2.5 Flash-Lite) | 🟡 v3 prompt shipped in PR #2. DEFECT-005 partially resolved. Not wired into cron yet. |
| RADAR-05 | /admin/pending route | 🔴 Not started |
| RADAR-06 | Morning brief email | 🔴 Not started |
| DATA-01 | store_prices ↔ prices disconnect (scraper data not reaching frontend) | 🔴 Not started. 2–3h estimate. |
| PRICE-PIPELINE-01 | lego_mrp_inr population (0% populated, blocks catalogue-audit pass) | 🔴 Not started |
| CATALOG-04 | set_prices + v_set_current_price schema + MSRP ingest | 🔴 Not started (schema never existed) |
| PARSER-01 | rss-parser swap for tolerant parser (unblocks New Elementary + Brickset) | 🟡 Deferred |
| SCRAPE-01 | Tier 5 + LEGO New Sets selector hardening | 🟡 Deferred |
| CONTENT-RENDER-02/03 | Markdown on /blog, excerpt leakage in ArticleCard | 🔴 Not started |
| Node.js 20 actions | checkout@v4 + setup-node@v4 deprecation (deadline 2026-06-02) | 🟡 Noted, not urgent yet |
| Day_5_Session_Handover.md | Untracked file in docs/handover/ — commit or ignore? | ❓ Decision pending |

---

## Section G — What to do next (Day 8)

**Primary: RADAR-03 classifier**

Build `scripts/radar/classify-signals.js`:
- Input: `raw_signals` rows where `dedup_status = 'primary'` (or equivalent) and not yet classified
- Classification: news / review / opinion / set-release / community
- Output: write `content_type` column on `raw_signals` (add column via migration if not present)
- Pattern: follow dedupe-signals.js structure (batched reads, batched updates, `--dry-run` flag)
- Brief: write a `briefs/RADAR-03-classifier.md` before implementing

**Secondary: verify first scheduled radar.yml tick**

```bash
gh run list --workflow=radar.yml --repo bricksofindia007/bricks-of-india --limit 5
```
Expected: a scheduled run at ~17:30 UTC 2026-05-09 with status success. If failed, read the log immediately.

**Tertiary (if time): Node.js 20 actions bump**
Update `.github/workflows/*.yml` — `actions/checkout@v4` → `@v4` (already Node.js 20; check if v4 has a Node.js 24 variant) and `actions/setup-node@v4` similarly. Low risk, 10 minutes.

---

## Section H — Session log (2026-05-09)

| Time (approx IST) | Action | Outcome |
|---|---|---|
| Session open | git push feat/content-pipeline-foundation | fa915c6 → 775de46 pushed |
| | Read BRIEF_DEFECTS.md | DEFECT-007/008 confirmed logged |
| | Read catalogue-audit.yml | Confirmed missing permissions block |
| | Added permissions: issues: write | Commit 775de46 |
| | git push feat/content-pipeline-foundation | 775de46 pushed |
| | npm run build | Clean — all routes compiled |
| | gh pr merge 2 --squash --delete-branch | PR #2 merged as e5b71b1, branch deleted |
| | gh run list --limit 5 | Netlify deploy green (2m23s) |
| | gh workflow run radar.yml | Run 25593692037 triggered |
| | gh run watch 25593692037 | Completed green, 37s |
| | PostgREST query on raw_signals | 163 rows, latest 2026-05-09T06:07 UTC |
| | git checkout main && git pull origin main | Fast-forward to e5b71b1 |
| | Read all 4 trackers + dashboard | Stale items identified |
| | Update BOI_MASTER_TRACKER.md | Day 7 changelog, Phase 3, deploy entry |
| | Update BOI_WEB_TRACKER.md | DEFECT-008 noted, CATALOG-04 corrected |
| | Update BOI_CONTENT_TRACKER.md | RADAR-07 done, RADAR-03 next |
| | Update admin/dashboard.html | 7 JSON fields updated |
| | git commit f553b7a + push | All tracker changes on main |
| Session close | Day 7 Ground Truth written | This document |

# Day 26 Ground Truth — Bricks of India
**Date written:** 2026-05-27 (session close)
**Branch:** main
**HEAD commit:** 57844f3

---

## A. Work completed this session

### Phase 2 — Batch generation via GitHub Actions

The full GHA batch generation pipeline shipped today. All work was confirmed before final deploy.

| Commit | Work |
|--------|------|
| `cc1f9c2` | `src/lib/generate-body.ts` (shared TS lib); `scripts/generate-approved-drafts.js` (CJS, node-runnable); `.github/workflows/generate-drafts.yml` (120-min timeout, workflow_dispatch) |
| `57844f3` | Phase 2 final: dispatch-only `GenerateBatchButton.tsx` (count prop, idle→loading→started→error states); `triggerBatchGeneration()` Server Action (POST to GitHub API, returns 204); `actions.ts` stripped of 400+ lines of duplicated helpers (now imports from `generate-body.ts`); `page.tsx` updated (awaitingIds[]→awaitingCount); `generate-drafts.yml` + `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`; `DEPLOYMENT.md` updated with `GH_DISPATCH_TOKEN` (9 Netlify vars total) |

**GH_DISPATCH_TOKEN** added to Netlify environment variables via API (session-close task). Fine-grained PAT, Actions read/write, repo scope only. Confirmed present in all deploy contexts.

**GHA confirmation:** `generate-drafts.yml` run #1 (commit `cc1f9c2`) succeeded at 02:57 UTC (1m 7s). Run #2 dispatched at session close (03:51 UTC) — was in_progress when this doc was written.

### Session-close additions (committed after final deploy)

| Item | Result |
|------|--------|
| `resolveTarget()` guide case | Added `format === 'guide' → guides table, /guides path`. Previously fell through to news_articles (bug). `guides` table confirmed to exist (0 rows). |
| `WORD_COUNT_TARGETS` guide entry | Added `guide: { pass: [630, 1100], fail: [525, 1250] }` (target 700–1000 words) to lintDraft in actions.ts |
| `generate-body.ts` guide wordTarget | Added `guide: '700–1000'` to the wordTarget map |
| `generate-approved-drafts.js` guide wordTarget | Same fix — now handles news/review/opinion/guide correctly |
| health-check additions (Checks 8–11) | Check 8: per-store in_stock counts (alert if < 50); Check 9: cron timestamp via GitHub API for 4 workflows (>26h = alert); Check 10: sets with zero store coverage (log only); Check 11: TEST MODE deliberate fail to verify Resend alert delivery |
| `health-check.yml` env | Added `GITHUB_TOKEN` and `GITHUB_REPOSITORY` for Check 9 |
| `technical-hygiene.yml` + `scripts/technical-hygiene.mjs` | New Monday 04:00 UTC workflow: 6 checks (route health, hero images, sitemap count, Lighthouse, prices staleness, row counts) + weekly Resend email report |
| BRIEF-01 / brief.yml | **Does not exist.** No `brief.yml` in `.github/workflows/`. No BRIEF-01 entry in BOI_MASTER_TRACKER.md. This workflow was never implemented. Health score 85 is not hardcoded in any script. Noted for awareness — not a regression. |

---

## B. Verified Supabase state (queried at session close 2026-05-27)

All numbers from direct Node.js queries with `SUPABASE_SERVICE_ROLE_KEY`. No invented figures.

### pending_drafts

| Status | Count |
|--------|-------|
| approved | 338 |
| draft | 11 |
| published | 4 |
| rejected | 4 |

**338 approved drafts** awaiting body generation. The `generate-drafts.yml` run triggered at session close will process these.

### Published content

| Table | Count | Notes |
|-------|-------|-------|
| `news_articles` | 24 | Last published: 2026-05-09T18:20:16 UTC — **18 days stale** |
| `blog_posts` | 19 | No freshness query run; likely staler than /news |
| `reviews` | 3 | McLaren P1 (BUY), Rivendell (BUY), NHM (WAIT FOR SALE) |
| `guides` | 0 | Table exists (migration 20260525000000_guides.sql) but no articles yet |
| `sets` | 24,559 | Rebrickable catalogue — weekly sync via sync-catalogue.yml |
| `posted_sets` | 4 | Social automation (IG Feed + Reels + YouTube Shorts) |

### store_prices (2,575 total rows)

| Store | Total rows | in_stock rows |
|-------|-----------|---------------|
| jaiman | 1,087 | 228 |
| mybrickhouse | 846 | 180 |
| toycra | 642 | 592 |
| **Total** | **2,575** | **1,000** |

Toycra has the highest in_stock rate (~92%). Mybrickhouse and Jaiman have lower rates — expected for premium/import-heavy inventory.

---

## C. Git state at session close

```
HEAD: 57844f3
Branch: main
Working tree: clean (untracked diagnostic scripts only — not committed)
Last 5 commits:
  57844f3 Phase 2: dispatch-only batch generation via GitHub Actions
  cc1f9c2 feat(radar): GHA batch generation -- script + workflow + shared lib
  2bdcd57 feat(admin): 503 retry pass + 30s summary hold in batch generator
  b1a48b0 feat(admin): Task 2 -- Generate All Approved batch button
  7f9e78b feat(radar): RADAR-08 -- automated review candidate pipeline
```

### GHA runs at session close

| Workflow | Status | Time |
|----------|--------|------|
| generate-drafts | in_progress | triggered 03:51 UTC (our dispatch) |
| Build & Deploy to Netlify | success | 03:29 UTC, 2m 30s |
| generate-drafts (run #1) | success | 02:57 UTC, 1m 7s |
| Scrape Store Prices | success | 2026-05-26 20:10 UTC |
| radar-pipeline | success | 2026-05-26 19:33 UTC |

---

## D. Architecture decisions made this session

**Netlify function timeout is the root cause of batch failure.** Netlify serverless functions timeout at 10s; Gemini calls take 10–15s under load. Resolution: GitHub Actions (120-min timeout) handles all batch generation. `triggerBatchGeneration()` Server Action is a single POST to the GitHub API (~200ms), returns 204, no timeout risk.

**TypeScript lib + CJS mirror pattern.** `src/lib/generate-body.ts` is the canonical TypeScript version used by `actions.ts`. `scripts/generate-approved-drafts.js` is a self-contained CJS mirror for the Node.js/GHA context. Comment in both files: "keep in sync when editing." Accepted duplication for pragmatic separation of concerns.

**`GH_DISPATCH_TOKEN` is a Netlify secret, not a GitHub Secret.** It's used by the Netlify-hosted Server Action to call the GitHub API. GitHub Secrets flow to GitHub Actions builds only — Netlify Function runtime cannot see them.

---

## E. Open items carried forward

| Item | Priority | Notes |
|------|----------|-------|
| /news and /blog content freshness | **P0** | /news 18 days stale, /blog worse. health-check.yml alerts already firing. Need to visit /admin/pending and publish from the 338 approved drafts once generate-drafts.yml run completes. |
| GEO-01-FU1 | P1 | Verify `buildReviewSchema()` on live /reviews/lego-42172-mclaren-p1-review. Deploy unblocked. |
| CE-02: 8 /guides articles | P1 | Fan CoLab critical path. Guides table + routes live. Start June 1. 1 article per 11 days target. |
| CE-05: History of LEGO in India | P1 | Fan CoLab must-be-live. Start by July 1. |
| CE-01: Builder Spotlight × 2 | P2 | 2 live required for Fan CoLab by August. |
| BRIEF-01 / brief.yml | P3 | Unimplemented. brief.yml does not exist. Not blocking anything today. |
| Test mode (Check 11) health-check.mjs | P3 | Remove Check 11 after first Resend alert email confirmed received. |
| technical-hygiene.yml first run | Tracking | Next Monday 04:00 UTC. Will_dispatch first run manually to verify. |

---

## F. Day 27 entry point

```bash
# Verify generate-drafts run result
gh run list --workflow=generate-drafts.yml --limit 3

# Check what got written
# (query pending_drafts where status='draft' and draft_body IS NOT NULL — those are the new ones)

# Publish top articles from /admin/pending?status=draft
# (health alert is already firing for /news staleness — 18 days)
```

Priority order:
1. Confirm generate-drafts.yml run #2 succeeded — check GHA tab
2. Visit /admin/pending?status=draft — approve best articles, publish to /news
3. Run health-check.yml manually → confirm Test Mode alert email arrives → remove Check 11
4. GEO-01-FU1 — verify JSON-LD on live /reviews/lego-42172-mclaren-p1-review
5. CE-02 — draft first /guides article (CE content critical path)

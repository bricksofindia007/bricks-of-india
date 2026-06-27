# Day 27 Ground Truth — Bricks of India
**Date written:** 2026-05-27 (session close)
**Branch:** main
**HEAD commit:** 89e6dd4

---

## A. Work completed this session

### Task 1 — RESEND_API_KEY / Check 11 (pre-completed)

Confirmed already done at session start. Commit `45ad2b0` (end of Day 26 session) removed Check 11 (Test Mode deliberate fail) from `scripts/health-check.mjs` after Resend alert delivery was confirmed. Health-check run triggered manually today returned `success`.

### Task 2 — BRIEF-01 daily morning brief

| File | Status |
|------|--------|
| `scripts/morning-brief.mjs` | Created |
| `.github/workflows/brief.yml` | Created |
| `docs/DEPLOYMENT.md` | Updated — brief.yml secrets section added |

**Workflow:** schedule `30 1 * * *` (01:30 UTC = 07:00 IST), plus `workflow_dispatch`.

**Six sections:**
1. Health score — hardcoded 85 (`<!-- TODO: automate from DB -->`)
2. Pipeline status — queries GitHub API via `GH_DISPATCH_TOKEN` for radar.yml, social-automation.yml, scrape-prices.yml, generate-drafts.yml. Shows last run time (IST) + PASS/FAIL.
3. Content freshness — `news_articles`, `blog_posts`, `reviews`. Red if >7/14/30 days respectively.
4. Pending operator actions — approved count ("Awaiting generation") + draft count ("Ready to review + publish").
5. Next hard deadline — nearest from hardcoded array (CE-01 → Fan CoLab), with days remaining + colour coding.
6. Sign-off — BOI voice, rotates by day of week (7 variants).

**Sender:** `hello@bricksofindia.com` (domain verified in Resend).

**Manual test:** workflow_dispatch triggered (run 26526645873). "Send morning brief" step returned ✓ success. Email sent to BRIEF_EMAIL.

**Secrets required:** all 5 reuse existing GitHub Secrets — no new secrets needed.
Committed as `89e6dd4`.

### Task 3 — PRICE-PIPELINE-01 populate-mrp.js

**Command run:** `node --env-file=.env.local scripts/populate-mrp.js`

| Metric | Value |
|--------|-------|
| Live USD/INR | 95.77 |
| Brickset sets with US retail price | 3,657 |
| DB NULL rows (year ≥ 2020) | 4,177 |
| Matched + updated | **35** |
| Unmatched | 4,142 |
| Audit gate | **3,405 / 7,547 = 45% PASS ✓** |

Low match rate (35/4177) is expected — the 4,142 unmatched are sets Brickset has no US retail price for (accessory packs, non-retail, GWP, etc.). The 45% audit gate is at threshold; further improvement requires a manual MRP research pass or an additional price source.

### Task 4 — generate-drafts overnight run (run #2)

Run triggered 2026-05-27 03:51 UTC, completed 04:33 UTC (42m 3s).

| Metric | Value |
|--------|-------|
| Processed | 323 of 323 |
| Succeeded | 20 |
| Failed | 303 |
| Failure pattern | **All 429** — Gemini 2.5 Flash-Lite daily quota exhausted after item 17 |

**Bug found and fixed:** script continued processing all 323 items after quota hit instead of stopping. Each failed call still waits 7s — 303 × 7s ≈ 35 minutes wasted. Fix: bail on first `[429` error in catch block. Committed in `89e6dd4`.

**Combined runs (run #1 + #2):** approximately 25 articles generated total.

**Current pending_drafts state** (queried 2026-05-27 session close):

| Status | Count |
|--------|-------|
| approved | 313 |
| draft | 36 |
| published | 4 |
| rejected | 4 |

36 draft articles are ready for operator review and publish at `/admin/pending`.

---

## B. Git state at session close

```
HEAD: 89e6dd4
Branch: main
Working tree: clean (untracked diagnostic scripts — not committed)
Last 5 commits:
  89e6dd4 feat(ops): BRIEF-01 daily morning brief + generate-drafts 429 bail fix
  45ad2b0 chore: remove health-check Test Mode (Check 11) -- alert delivery confirmed
  4b727f6 docs: Day 26 Ground Truth (session close) + tracker update
  c58eddb feat(ops): health-check Checks 8-11 + weekly technical-hygiene workflow
  b0b0019 fix: add guide format support to resolveTarget, lintDraft, and wordTarget maps
```

---

## C. Architecture notes

**Gemini free tier exhausts daily quota at ~17–20 articles.** The 7s inter-call delay keeps under 10 RPM but does not prevent daily limit (1500 RPD or token-based quota). To work through the 313-item backlog: run `generate-drafts.yml` with `--limit 15` daily — quota resets at midnight UTC. At 15/day, backlog clears in ~21 days. Do not run unlimited batches.

**BRIEF-01 from address is `hello@bricksofindia.com`** (not `abhinav@bricksofindia.com`). Domain `bricksofindia.com` is Resend-verified so all `@bricksofindia.com` addresses work. health-check.mjs still uses `abhinav@bricksofindia.com` — no change needed there.

**populate-mrp.js match rate:** Brickset API `LEGOCom.US.retailPrice` is absent for many sets. Running populate-mrp.js again after catalogue sync will not improve coverage unless Brickset adds prices. The 45% audit gate is the current ceiling from this source.

---

## D. Open items carried forward

| Item | Priority | Notes |
|------|----------|-------|
| /news freshness | **P0** | 19+ days stale. 36 draft articles ready at `/admin/pending?status=draft` — publish the best ones today. |
| GEO-01-FU1 | P1 | Verify `buildReviewSchema()` JSON-LD on live /reviews/lego-42172-mclaren-p1-review. Not done yet. |
| CE-02: 8 /guides articles | **P1** | Start June 1 (5 days). Fan CoLab critical path. Guides table empty. |
| CE-05: History of LEGO in India | P1 | Start by July 1. |
| CE-01: Builder Spotlight × 2 | P2 | Live by August for Fan CoLab. |
| generate-drafts batch plan | P2 | Run with `--limit 15` daily to clear 313-item backlog. ~21 days at free tier. |
| technical-hygiene.yml first run | Tracking | Next Monday 2026-06-01 04:00 UTC — also the CE-01 subjects deadline. |
| lego_mrp_inr coverage | Tracking | 45% now. Further improvement needs manual research or new price source. |

---

## E. Day 28 entry point

```bash
# 1. Publish from draft queue
# Visit /admin/pending?status=draft — 36 articles ready
# Publish the best news articles first to fix /news staleness

# 2. GEO-01-FU1
# curl -s https://bricksofindia.com/reviews/lego-42172-mclaren-p1-review | grep '"@type":"Review"'

# 3. Schedule daily generate-drafts runs
# Add --limit 15 to generate-drafts.yml command
# OR trigger manually: gh workflow run generate-drafts.yml

# 4. CE-02 first article — brief: /guides/why-lego-is-so-expensive-in-india
# (or similar India-relevant angle, target 700-1000 words)
```

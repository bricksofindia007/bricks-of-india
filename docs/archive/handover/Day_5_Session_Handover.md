# BOI Day 5 Session Handover
**For:** Next Claude session (Claude Code terminal)
**Date written:** 2026-05-03
**Date valid through:** 2026-05-10 (one week; refresh after that)
**Session:** Content pipeline build — Day 5 of 12

---

## Read this in order
1. **This doc** (5 minutes) — what shipped, what's open, Day 6 scope
2. **BOI_MASTER_TRACKER.md** (skim) — canonical state, Sprint changelog Day 5 added
3. **docs/BRIEF_DEFECTS.md** — DEFECT-005 (🟡 Partial) and DEFECT-006 (tooling) both added today
4. **CLAUDE.md** (1 minute) — 6 operational rules, non-negotiable

---

## Where we are on 2026-05-03

### Shipped today (Day 5)

**RADAR-02 deduper** (`scripts/radar/dedupe-signals.js`, commit `55616bb`)
- 4-pass design: exact url_hash → exact title_hash → cross-source Jaccard ≥0.75 → unique
- Pass 3 uses Union-Find for transitive grouping. Same-source pairs skipped in fuzzy pass (YT-FEED-NOISE-01 design decision: YouTube channel feeds mix uploads + playlist additions from other channels; same-source skip prevents RADAR-02 grouping what is actually channel-level noise).
- Stopwords: generic English + LEGO-domain noise (`lego`, `leak`, `reveal`, `set`, `sets`, etc.)
- Threshold 0.75 validated: ran isolation script on 53 live signals, top pairwise was 0.333 (`star,wars` — genuinely different stories). Zero pairs at ≥0.50. Threshold is correct for current data.
- Batched DB updates (chunks of 100). `--dry-run` and `--verbose` flags.
- First live run: 53 signals, 53 unique, 0 grouped.

**RADAR-CRON** (`.github/workflows/radar.yml`, commit `4900811`)
- Schedule: 17:30 UTC daily = 23:00 IST
- Chains RADAR-01 (fetch-rss.js) → RADAR-02 (dedupe-signals.js) only
- RADAR-03 through RADAR-06 not yet wired into cron (Day 6+)
- workflow_dispatch enabled for manual runs
- **Important operational fact: cron only runs from the `main` branch.** The workflow is committed on `feat/content-pipeline-foundation`. Until PR #2 is merged to main, the scheduled cron will not fire. workflow_dispatch on the feature branch will work for manual tests.
- 15-minute timeout, Node 20, npm ci

**PR #2 open** — https://github.com/bricksofindia007/bricks-of-india/pull/2
- Branch: `feat/content-pipeline-foundation` → `main`
- Contains: Days 1–5 of pipeline build (foundation + RADAR-01 + RADAR-02 + RADAR-CRON)
- Status: open, NOT merged
- **First cron tick at 23:00 IST will only fire after operator merges PR #2 to main.**

### Verified state at session end
- `raw_signals` table: 53 rows, all `dedup_status='unique'`, 0 grouped, 0 pending
- 12 commits on `feat/content-pipeline-foundation` ahead of main
- Working tree: clean

---

## Active deferred tickets (from carry-overs)

| ID | What | Priority | Re-enable condition |
|---|---|---|---|
| PARSER-01 | rss-parser strict mode breaks on New Elementary + Brickset malformed RSS. Fix: swap for feedparser or @extractus/feed-extractor. | P2 | After parser swap |
| SCRAPE-01 | Tier 5 + LEGO New Sets scrape selectors returning nav chrome. Each site needs HTML inspection + custom selector. | P2 | After per-source selector work |
| YT-FEED-NOISE-01 | YouTube channel RSS includes playlist additions (not just uploads). Accepted noise for v1. Future fix: filter by `<author><uri>` or use YouTube Data API v3 uploads playlist. | P3 | Accepted, no action needed for Day 6 |
| DEFECT-005 | RADAR-04 prompt: structural violations fixed (v3-final-postfix), voice ceiling acknowledged. Day 3.5 architectural options deferred. | P1 Partial | Day 3.5 session when operator is ready |

---

## Day 6 scope (recommended)

**Immediate first action:** Review PR #2 → merge to main → watch first cron tick at 23:00 IST.

**After merge, Day 6 build targets in priority order:**

1. **RADAR-03 classifier** — classify each `raw_signals` row as `news` / `review` / `opinion` / `set-release` / `community`. Runs after RADAR-02 in the cron. Output: new column `signal_category` on `raw_signals` or a separate classification pass.

2. **Wire RADAR-04 into cron** — `draft-articles.js` already works standalone (Day 3). The cron needs to call it against `unique` signals from `raw_signals`, not the pinned test fixture. Migration path: change fixture path to pull from DB, add `--live` flag.

3. **DEFECT-005 Day 3.5** — architectural decision: few-shot exemplars (Option A), two-stage drafting (Option B), or stronger model (Option C). Operator decision gates this.

Do NOT start RADAR-05 (`/admin/pending` route), email brief, or lint gates until RADAR-03 and RADAR-04 are wired and producing real drafts.

---

## Operator preferences (from this session)

- **Surface before fix.** Every deviation from spec is surfaced, not silently corrected. Day 2's silent CHECK constraint correction was flagged as a violation of this rule.
- **No interpretation in investigation mode.** When asked for raw output, paste raw output. No analysis, no "this means X."
- **Stop conditions are hard stops.** When a stop condition fires (e.g., Supabase migration not applied), stop and wait. Don't paper over with workarounds.
- **Tracker updates are commits, not side effects.** Every tracker change goes in a named commit. Never mixed into functional commits.
- **Dry-run first, live second, always.** Both RADAR-01 and RADAR-02 ran `--dry-run` before live. This is the pattern.
- **Read the file before editing.** Always. No exceptions.

---

## Known terminal failure modes (carry forward + tonight's additions)

### Carried forward from prior sessions
- **`git add .` or `git add -A` — NEVER USE.** Diagnostic files have drifted into commits twice. Always name files explicitly.
- **Isolation-test rule (Day 4):** When debugging suspected cross-contamination between sources, write an isolated test script that bypasses the application code entirely (direct `fetch()` + raw XML parse). The rss-parser shared-state hypothesis was disproved by isolation test showing YouTube's own feed returns the same "wrong" content. Always test the data source independently before debugging the code.

### Added tonight (Day 5)
- **`! prefix` hallucination:** Earlier in this session, the assistant stated that the `!` prefix in Claude Code runs commands in the user's shell session. This was incorrect. The `!` prefix is a Claude.ai web UI convention, not a Claude Code terminal feature. In Claude Code, the user types directly into the terminal. Do not reference the `! prefix` pattern.
- **gh CLI / PATH conflation:** `gh` installed via winget is not visible in the Claude Code Bash tool because the Bash environment initializes PATH before mid-session Windows installs. Use the PowerShell tool for `gh` commands. Additionally, do not assume a tool is available just because a prior task output file showed successful execution — verify live with `gh --version` or equivalent.

---

## What NOT to do in Day 6

- Don't push the branch or open another PR without operator instruction (PR #2 is already open)
- Don't run `node scripts/radar/fetch-rss.js` without `--limit` during development — unlimited runs will hit Reddit rate limits and consume RPD budget on Gemini
- Don't modify `scripts/radar/test-fixture.xml` — it is the pinned Day 2 baseline for RADAR-04 voice iteration
- Don't mark RADAR-07 Done until at least one scheduled cron tick has fired successfully after merge to main (same lesson as DEFECT-004 / LAB-03)
- Don't start RADAR-05 or the morning email brief until RADAR-03 + RADAR-04 are wired and producing real drafts

---

## Critical lessons accumulated

1. **Cron Done-gate (DEFECT-004):** A cron is not Done until ≥1 scheduled tick has fired. Manual dispatch proves the script compiles; only a scheduled tick proves cron wiring. RADAR-CRON follows the same rule.
2. **Tracker drift accumulates when sessions end without writing session knowledge to disk.** Three sub-trackers went 8 days stale in April because no one wrote the Day-end state to a file. This handover doc exists to prevent that. Always end a session by writing what happened, not just what shipped.
3. **Isolation test before code debug.** (Day 4) When output looks wrong, reproduce with the simplest possible test that bypasses your code. Saved hours on the YouTube "cross-contamination" investigation.
4. **Surface deviation rule (Day 2).** Silent correction of spec errors is not allowed. If a spec says `null` inside `IN(...)` and that's wrong in Postgres, surface it and note the reason. Future sessions can read the reasoning.

---

## Immediate next action for Day 6

1. Run: `git log --oneline -3` and `git status` to confirm clean state
2. Check PR #2 status: `gh pr view 2` (if gh is available) or visit GitHub
3. If PR #2 is merged: run `git checkout main && git pull` then watch for first cron tick tonight at 23:00 IST
4. If PR #2 is not merged: remind operator, then begin Day 6 build on `feat/content-pipeline-foundation` or a new feature branch off main

---

**Document author:** Claude Sonnet 4.6 (terminal session)
**Companion docs:** BOI_MASTER_TRACKER.md (Sprint changelog Day 5), docs/BRIEF_DEFECTS.md (DEFECT-006)
**Next handover refresh:** 2026-05-10 or after next major shipment

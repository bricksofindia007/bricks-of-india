# BRIEF_DEFECTS.md

**Purpose:** Canonical log of defects found in `briefs/*.md` during execution. Every defect found, every patch shipped.

**Convention:**
- Every defect gets a numeric ID: `DEFECT-001`, `DEFECT-002`, etc.
- Defect IDs are permanent and never reused, even if the brief is later deleted.
- Each entry records: what was wrong, where, how it was found, what was patched, and the patch commit SHA.
- This file is updated in the same commit that patches the brief.
- This file is read-only history. Existing entries are never edited or removed. Corrections to a previous entry get a new entry referencing the old one.

**Why this exists:**
Briefs are written ahead of execution. Some assumptions in them turn out to be wrong when the executor (Claude Code or human) hits the actual repo state. Without a log, the same defect can be re-introduced if the brief is copied or re-used. With a log, anyone reading a brief can check whether it's been patched and what was learned.

**File location of brief patches:**
Patch instructions are written as one-off `ARTEFACT_*_Brief_Patch.md` files during the strategic chat session, then executed by terminal. The artefact files themselves are not committed long-term — they're scratch. The defect log entry and the patched brief are the durable record.

---

## DEFECT-001 — LAB-03 Phase 4 secret name

| Field | Value |
|---|---|
| Brief | `briefs/LAB-03-price-snapshot-cron.md` |
| Found during | LAB-03 execution, 2026-05-02 |
| Found by | Claude Code (terminal), surfaced as "Gap 2" before writing any code |
| Phase | Phase 4 (GitHub Actions workflow template) |
| Severity | High — silent failure if shipped verbatim |
| Patch commit | `8b73dd5f879b11f130784c0f0b3f53a0a946c23b` |

**What was wrong:**
Phase 4 workflow template specified:
```yaml
SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
```

The secret `SUPABASE_URL` does not exist in the repo. Every existing workflow uses `NEXT_PUBLIC_SUPABASE_URL`, and `sync-rebrickable.js` reads `process.env.NEXT_PUBLIC_SUPABASE_URL` at runtime.

**Failure mode if unpatched:**
Workflow runs, reads empty `SUPABASE_URL` env var, env validation check fails, script exits 1. No data written. Failure visible only in the Actions log, not in any application metric.

**What was patched:**
- Phase 4 env block changed to `NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}`
- Any script-level env reads aligned to `process.env.NEXT_PUBLIC_SUPABASE_URL`
- Patch note added at top of brief documenting the change for anyone reading older copies

**Lesson:**
Briefs that include workflow YAML templates should reference one of the existing workflows (e.g. `catalogue-audit.yml`) rather than inventing env var names. Future brief authors should do `grep -r "secrets\." .github/workflows/` before writing a new template, to ensure consistency.

---

## DEFECT-002 — LAB-04 branch name inconsistency

| Field | Value |
|---|---|
| Brief | `briefs/LAB-04-homepage-strip.md` |
| Found during | LAB-04 execution, 2026-05-02 |
| Found by | Claude Code (terminal), pre-flight audit before writing any code |
| Phase | Phase 5 (commit/push block) and summary block |
| Severity | Low — wrong branch name in brief's git commands and summary template; implementation unaffected |
| Patch commit | `19de92427cb3173f64059c81c1379475a49e6ba0` |

**What was wrong:**
Phase 5 git commands and the "When done" summary block both said:
```
git push origin feat/lab-homepage-strip
Branch: feat/lab-homepage-strip
```
The correct branch name per operator instruction and LAB-ID convention is `feat/lab-04-homepage-strip`.

**Failure mode if unpatched:**
Anyone using the brief's `git push` command verbatim would push to the wrong remote branch name.

**What was patched:**
- Phase 5 git block updated to `feat/lab-04-homepage-strip`
- Summary block `Branch:` line updated to match
- Git add paths in Phase 5 also corrected (see DEFECT-003)

---

## DEFECT-003 — LAB-04 LabStrip file path wrong

| Field | Value |
|---|---|
| Brief | `briefs/LAB-04-homepage-strip.md` |
| Found during | LAB-04 execution, 2026-05-02 |
| Found by | Claude Code (terminal), pre-flight audit of project structure |
| Phase | Phase 2 (strip component location) and Phase 5 (git add command) |
| Severity | Medium — following the brief literally would create a component in a non-existent directory |
| Patch commit | `19de92427cb3173f64059c81c1379475a49e6ba0` |

**What was wrong:**
Phase 2 specified the strip component path as:
```
app/components/LabStrip.tsx
```
Phase 5 git add used `app/components/LabStrip.tsx` and `app/lab/page.tsx` (missing `src/` prefix throughout).

In this project all source lives under `src/`. The `app/components/` directory does not exist — the project convention is `src/components/{ui,layout,sets,content}/`. Following the brief literally would create `src/app/components/LabStrip.tsx`, an anomalous location not matching any existing pattern.

Additionally, the brief did not account for the `LAB_TOOLS` constant needing its own shared module (the brief showed it inline in the component). Since both the strip, the lab page, and the nav dropdown all consume it, a `src/lib/lab-tools.ts` module was created as the single source of truth (consistent with the brief's hard rule: "Do not duplicate the list in two places").

**Failure mode if unpatched:**
File created at wrong path; TypeScript path alias `@/` would not resolve it correctly; build fails or component is inaccessible.

**What was patched:**
- Phase 2 path changed to `src/components/ui/LabStrip.tsx`
- Phase 5 git add corrected to full `src/`-prefixed paths, with `src/lib/lab-tools.ts` added
- Summary block component path updated
- `LAB_TOOLS` extracted to `src/lib/lab-tools.ts`; both phase descriptions implicitly updated

---

## DEFECT-004 — LAB-03 marked Done before first scheduled run

| Field | Value |
|---|---|
| Brief | `briefs/LAB-03-price-snapshot-cron.md`, `docs/runbooks/LAB-03-price-snapshot.md` |
| Found during | Post-LAB-03 operations, 2026-05-02 |
| Found by | Operator, via GitHub Actions UI (0 scheduled runs shown) |
| Phase | Post-deployment operations |
| Severity | Low — process gap only; no data loss, no code defect |
| Patch commit | `c923ba205039aef8411bc18a95f5f47dabc9df6b` |

**What was wrong:**
The 2026-05-02 session marked LAB-03 ✅ Done in `BOI_MASTER_TRACKER.md` after Phase 5 verification confirmed:
- Manual `workflow_dispatch` run wrote 724 snapshots
- UPSERT idempotency held
- Empty-source guard read-verified
- YAML `schedule:` block present

But: the workflow file landed on main at 2026-05-02 11:34 UTC, 8.5 hours after the day's 03:00 UTC scheduled tick. The first *scheduled* run could not fire until 2026-05-03 03:00 UTC. Tracker was marked Done while no scheduled execution had ever occurred — only the manual dispatch test had run.

**Failure mode:**
"Marked done" implies the recurring behaviour is verified live. For cron work, "live" requires at least one *scheduled* run to fire successfully. A manual dispatch proves the script and the workflow YAML compile; only a scheduled tick proves GitHub's cron parser, the runner queue, and the `schedule:` block are jointly wired.

**What was patched:**
Nothing in code. Process patch only.

**Lesson:**
For any cron-based ✅ Done flip, the verification checklist must include "≥1 scheduled run completed green" as a distinct gate, separate from "manual dispatch proved script works." When a workflow file lands on main after the day's scheduled tick, ✅ Done waits until the next tick fires.

---

## DEFECT-005 — RADAR-04 drafter: format/structure violations despite correct voice register

**Logged:** 2026-05-03
**Severity:** P1 — blocks RADAR-04 production use; does not block Day 2 commit
**Status:** 🟡 Partial — structural findings resolved, voice ceiling acknowledged, Day 3.5 deferred

**Context:**
Day 2 smoke test of scripts/radar/draft-articles.js produced one draft from the pinned Brickset RSS fixture (test row id 39dd6b67-ee8b-42e7-b4c0-b0e14275aa73 in pending_drafts, kept as known-bad reference for Day 3 before/after comparison). Gemini 2.5 Flash-Lite call succeeded (5876ms). Voice register (Clarkson + wallet anxiety) came through correctly — proving the model is capable. But the output is a YouTube script, not a news article, with seven specific structural violations.

**Diagnosis:** Codex prompt structure is the problem, not the model. The Codex contains both YouTube script and article formats and Flash-Lite is not disambiguating. Fix is in the prompt scaffolding (system prompt construction in draft-articles.js + format-aware Codex sections), not in the model.

**Findings:**

1. **Output is a YouTube script, not a news article.** Opens with "Hello Brickfans, I'm Abhinav and I once again warmly welcome you all to Bricks of India, the only channel where LEGO meets jugaad" — that's a video opener. News articles open on something Indian and pivot to LEGO in 2 sentences, no host introduction. Gemini is bleeding YouTube conventions into article format because the Codex contains both and Flash-Lite isn't disambiguating between them.

2. **"Bubyee" sign-off is YouTube-only.** Per locked voice spec: "On that bombshell…" for opinion, "Bubyee" for YouTube. Draft uses both, which is wrong. News articles end on "On that bombshell" or similar — never "Bubyee" or "I'll see you on the next one."

3. **India Paragraph is malformed.** Spec calls for INR price + stores + 4-6 week India lag + relatable comparison + EMI references for expensive sets, all consolidated as one block. Draft has "₹100,000 in India. Available only via import from BrickLink or eBay – and good luck with customs" — components scattered across paragraphs (the wedding comparison appears two paragraphs later), no Indian retailer check, no lag note. WEB-02 lint gate as currently spec'd will likely FAIL this — it looks for the marker <!-- INDIA_PARAGRAPH --> and 4 components in proximity.

4. **"Today's random set" reveals prompt scaffolding leaking source framing.** The Brickset RSS item was the daily "Random Set of the Day" feature, and the draft says "today's random set" — preserving Brickset's framing instead of writing native BOI content. BOI doesn't have a "random set of the day" segment. Flash-Lite copied source framing instead of repurposing the topic.

5. **"This was part of the legendary Adventurers line" — unverified factual claim.** Could be true, could be hallucinated. Gemini Flash-Lite has no grounding. RADAR-04 needs to either pull facts from Rebrickable API (set lookup by set_num) and inject them into the user prompt as ground truth, OR instruct the prompt to avoid factual claims about set lineage / theme / piece counts when not supplied.

6. **Title format wrong.** Spec: news titles always include set number + "India". Draft title: "Amazon Ancient Ruins: A 1999 Relic That Costs More Than Your Rent" — no set number, no India, no INR. Correct would be something like "LEGO 5986 Amazon Ancient Ruins in India: Worth ₹100,000 in 2026?"

7. **No format classification before drafting.** This article is closer to opinion than news (commenting on aftermarket pricing, not reporting a release). Drafter wrote a generic enthusiast post instead of picking a format. Spec: news 300-400 words, reviews 500-700, opinion 400-500 — each with different title formula and structure. RADAR-04 needs to classify the source signal as news/review/opinion *before* drafting, and apply format-specific prompts.

**Day 3 action plan (not in scope for Day 2):**
- Restructure draft-articles.js prompt: classify format first (news/review/opinion), then use format-specific system prompt section
- Add explicit anti-pattern list to system prompt (no YouTube openers, no "Bubyee," no host introduction, no preserving source framing)
- Add Rebrickable API lookup in script before Gemini call — inject set facts as ground truth in user prompt
- Tighten India Paragraph format: explicit template with all 4 components in one block, marker comment included
- Re-run smoke test against same fixture (39dd6b67-ee8b-42e7-b4c0-b0e14275aa73) — keep both rows in pending_drafts as before/after reference
- Iterate until output passes manual voice check before any RADAR-01 plumbing work begins

**Day 3 conclusion (2026-05-03):**
- Canonical Day 3 output: pending_drafts row `bbffd48c-fc7e-4d40-b44e-2ae04a2c7a3b`, iteration_label=`day3-v3-final-postfix`
- All 7 findings addressed structurally; voice register is acceptable for ship-and-iterate
- Code-level verdict-in-body backstop added — every future draft will have verdict in body, either Gemini-native (reported `gemini-native`) or template-injected (reported `template-injected`)
- Source-framing leak (Finding 4) is probabilistic, not deterministic — will leak occasionally despite the anti-pattern list. Manual editor pass at /admin/pending will catch it; not worth a further prompt iteration at this stage
- Day 3.5 deferred — three architectural options on the table: (A) few-shot exemplars from existing BOI articles loaded into system prompt, (B) two-stage drafting (classify then draft as separate Gemini calls), (C) test a stronger model. Decision pending operator's call after first batch of real RADAR-01 drafts in production
- Iteration history: `baseline-v1-day2` → `day3-v2-attempt-1` → `day3-v2-attempt-2` → `day3-v3-final` → `day3-v3-final-postfix`
- Day 4 (RADAR-01 + RADAR-02 plumbing) is now UNBLOCKED

**Test fixture:** scripts/radar/test-fixture.xml (Brickset RSS pulled 2026-05-03)
**Reference draft (known-bad):** pending_drafts row 39dd6b67-ee8b-42e7-b4c0-b0e14275aa73, status='draft' (intentionally not rejected — kept as Day 3 baseline)

---

## DEFECT-006 — gh CLI not on PATH in Claude Code Bash session despite winget install

| Field | Value |
|---|---|
| Context | Day 5 close-out — opening PR via `gh pr create` |
| Found during | `gh pr create` invocation in terminal session, 2026-05-03 |
| Found by | Claude Code (Bash tool returned `gh: command not found`) |
| Severity | P3 — tooling friction only; no data loss, no code defect |
| Patch commit | n/a — workaround documented, no code change needed |

**What was wrong:**
`gh` CLI appeared installed (operator ran `winget install GitHub.cli` and confirmed auth), but the Claude Code Bash shell (`/usr/bin/bash`) does not inherit the Windows PATH additions made by winget after the session started. The Bash environment in Claude Code runs via a POSIX subsystem that resolves its PATH at session init, before any new Windows PATH entries are visible.

**Failure mode:**
`gh auth status` and `gh pr create` both throw `gh: command not found` in the Bash tool. The same commands work in a separately launched PowerShell or CMD terminal where `gh` is on PATH.

**Workaround:**
Use the PowerShell tool for `gh` commands, which inherits the Windows PATH correctly:
```powershell
gh pr create --base main --head <branch> --title "..." --body "..."
```
Alternatively, use `gh` directly from a new PowerShell terminal outside the Claude Code session.

**Related false assumption this session:**
Earlier in the same session, the Bash tool printed "gh auth status" output successfully — that output was from a prior run cached in the task output file, not a live invocation. This caused the assumption that `gh` was available. Rule going forward: test `gh --version` live before assuming availability.

**Lesson:**
Claude Code's Bash environment does not inherit Windows PATH changes made after session start. Any CLI installed mid-session (winget, scoop, choco, npm -g) will not be visible to the Bash tool until the session is restarted. Use the PowerShell tool as the fallback for Windows-native CLI tools.

---

## How to add a new entry

When a defect is found:

1. Increment the ID (next entry is `DEFECT-002`).
2. Add a new section in this file with the same field structure as DEFECT-001.
3. Write the patch instructions as a separate scratch artefact (`ARTEFACT_*_Brief_Patch.md`).
4. Execute the patch — single commit that touches both the brief and this defect log.
5. Fill in the patch commit SHA in the defect entry.

Defects found but **not** yet patched should still be logged immediately, with the patch commit field marked `_(pending)_`. This way no defect is ever forgotten because the patch wasn't done the same day.

---

## Index

| ID | Brief | Severity | Status |
|---|---|---|---|
| DEFECT-001 | LAB-03 Phase 4 secret name | High | Patched |
| DEFECT-002 | LAB-04 branch name inconsistency | Low | Patched |
| DEFECT-003 | LAB-04 LabStrip file path wrong | Medium | Patched |
| DEFECT-004 | LAB-03 marked Done before first scheduled run | Low | Patched |
| DEFECT-005 | RADAR-04 drafter: format/structure violations despite correct voice register | P1 | 🟡 Partial |
| DEFECT-006 | gh CLI not on PATH in Claude Code Bash session despite winget install | P3 | Workaround documented |
| DEFECT-007 | RLS disabled on price_snapshots and pending_drafts | Critical | Patched (DB-level) |
| DEFECT-008 | catalogue-audit.yml missing permissions block (403 on issue creation) | Low | Patched (commit e5b71b1, 2026-05-09) |
| DEFECT-009 | /sets and /compare listing pages reading prices table instead of store_prices (DATA-01) | Medium | Patched (commit 9ced905, 2026-05-09) |
| DEFECT-010 | GitHub Actions using Node.js 20 (deprecated) — actions/checkout@v4 + setup-node@v4 | Medium | Open — deadline 2026-06-02 |
| DEFECT-011 | fetchFullBody overly broad CSS selector `[class*="sidebar"]` removed JBB article content | Medium | Patched (commit 68aa474, 2026-05-09) |
| DEFECT-012 | RADAR-04 auto-ran on all approved drafts via cron — Gemini quota burned without operator intent | P1 | Patched (commit 57cd130, 2026-05-09) |

---

## DEFECT-010 — GitHub Actions deprecated Node.js 20

| Field | Value |
|---|---|
| Found during | Day 9, 2026-05-09 — annotation on every GitHub Actions run |
| Found by | GitHub Actions runner deprecation warning in run logs |
| Severity | Medium — Node.js 20 forced to Node.js 24 from 2026-06-02; removed 2026-09-16 |
| Status | Open — bump actions/checkout and actions/setup-node to versions that support Node.js 24 |

**What was wrong:**
All workflow files use `actions/checkout@v4` and `actions/setup-node@v4` which run on Node.js 20. GitHub is deprecating Node.js 20 runners: forced switch to Node.js 24 on 2026-06-02, Node.js 20 removed on 2026-09-16. Every run currently logs: `Node.js 20 actions are deprecated`.

**Failure mode if unpatched:**
After 2026-06-02, actions will be forced to Node.js 24. If the action versions used are incompatible with Node.js 24, workflows may break. In practice, v4 of both actions likely still works in forced Node.js 24 mode — but the warning will escalate to a hard error.

**Fix:**
Check if `actions/checkout@v4` and `actions/setup-node@v4` have Node.js 24-compatible releases, or set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` in workflow env to opt in early. Affects: deploy.yml, scrape-prices.yml, radar.yml, catalogue-audit.yml, sync-catalogue.yml.

---

## DEFECT-011 — fetchFullBody overly broad CSS selector zeroed JBB content

| Field | Value |
|---|---|
| Brief | `scripts/radar/generate-drafts.js` |
| Found during | Day 9 dry-run, 2026-05-09 — JBB returned fetched_full_body=false with body_length=0 |
| Found by | Claude Code (terminal) — inspecting JBB HTML structure revealed culprit selector |
| Severity | Medium — Tier 1 editorial source (Jay's Brick Blog) was always falling back to 500-char excerpt |
| Patch commit | `68aa474` |

**What was wrong:**
`fetchFullBody()` noise-stripping used `[class*="sidebar"]` — a CSS substring selector that matched any element whose class attribute contains "sidebar". Jay's Brick Blog's layout uses `layout-grid-**sidebar**` as the outer wrapper containing **both** the content column and the actual sidebar. Removing `[class*="sidebar"]` removed the wrapper and all 3,549 chars of article content with it. `[class*="ad-"]` had a similar ancestor-match problem.

**Result:** All JBB articles reported `fetched_full_body=false`, Gemini received only the 500-char stored excerpt.

**What was patched:**
Replaced broad substring selectors with targeted class/id selectors:
- `[class*="sidebar"]` → `.sidebar, .widget-area, #sidebar`
- `[class*="ad-"]` → `.advertisement, .ads`  
- `[class*="comment"]` → `[class*="comment-"], [class*="-comments"], .commentlist`
- `[class*="share"]` → `[class*="share-"], [class*="-share"]`
Added `.layout-grid-content` to selector chain for JBB specifically.

**Verified post-fix:** JBB 1607 chars ✅, Brothers Brick 986 chars ✅, Brickset 4000 chars ✅.

---

## DEFECT-012 — RADAR-04 auto-generation consumed Gemini quota without operator intent

| Field | Value |
|---|---|
| Brief | `scripts/radar/generate-drafts.js`, `.github/workflows/radar.yml` |
| Found during | Day 9 session, 2026-05-09 — operator observed Gemini running on all approved drafts automatically |
| Found by | Operator — "Signal arrives → you review title+excerpt → Approve signal → Gemini runs only on those" |
| Severity | P1 — design defect: Gemini burned quota on every approved signal regardless of editorial merit |
| Patch commit | `57cd130` |

**What was wrong:**
RADAR-04 (`generate-drafts.js`) was wired into `radar.yml` with `--limit 10`, running nightly. It processed all `status='approved' AND draft_body IS NULL` rows automatically — meaning every signal the operator approved would get a Gemini article generated on the next cron tick, whether or not the operator had decided they wanted an article from that signal.

This wastes Gemini quota on Rebrickable set-listing signals, community round-ups, and other low-signal items that were approved just to keep the queue clean.

**What was patched:**
- RADAR-04 step removed from `radar.yml` entirely
- `generateArticle()` Server Action added to `/admin/pending` — single-draft Gemini call, triggered by operator clicking amber "Generate Article" button
- Operator workflow: Approve signal → decides to generate → clicks button → Gemini runs for that one draft only
- `generate-drafts.js` kept for manual bulk use only (not in cron)

**Lesson:**
Any action that consumes external API quota (Gemini, OpenAI, etc.) should be operator-initiated unless there is an explicit business reason to run automatically. "Auto-process all approved items" is a footgun when the approval step is a lightweight signal filter, not an explicit "generate this" decision.

## DEFECT-007 — RLS disabled on price_snapshots and pending_drafts

| Field | Value |
|---|---|
| Found during | Day 6 strategic session, 2026-05-06 ~22:30 IST |
| Found by | Supabase Database Advisor email (dated 2026-05-03), acknowledged in session |
| Severity | Critical — 3-day data exposure window |
| Patched | 2026-05-06 ~23:20 IST via Supabase SQL Editor (DB-level only, no code commit) |

**What was wrong:**
`public.price_snapshots` and `public.pending_drafts` were created via migrations without `ENABLE ROW LEVEL SECURITY`. Default Supabase project setting is RLS off. Anonymous users with the project URL had full read/write access to both tables for ~3 days.

**Impact:**
- `price_snapshots`: scraped competitive pricing intelligence exposed publicly
- `pending_drafts`: AI-drafted articles exposed (content theft + injection risk for future /admin/pending publication path)
- No evidence of exploitation observed

**Fix applied:**
- `price_snapshots`: ENABLE RLS + policy `price_snapshots_anon_select` (anon SELECT, USING true) — preserves /lab public read
- `pending_drafts`: ENABLE RLS, no anon policy (service role only)
- Verified: /lab renders correctly post-fix; all 11 public tables now show `rowsecurity = true`

**Followup:**
- PROCESS-RLS-01 (P1): All future migrations must include ENABLE RLS + explicit policies. Add as CLAUDE.md rule.
- PROCESS-RLS-02 (P3): Audit policies on the 9 pre-existing public tables for appropriate restrictiveness.

---

## DEFECT-008 — catalogue-audit.yml missing permissions block (403 on issue creation)

| Field | Value |
|---|---|
| Found during | Day 6 strategic session, 2026-05-06 |
| Found by | Workflow run analysis — audit failure step that opens a GitHub issue returns 403 |
| Severity | Low — audit correctly detects and reports the gap; only the auto-issue-creation fails |
| Status | Open — fix is 2 lines of YAML |

**What was wrong:**
`catalogue-audit.yml` has no `permissions:` block. The on-failure step that calls `gh issue create` requires `permissions: issues: write`. Without it, the GitHub Actions token is read-only and the step returns 403.

**Root cause of audit failure itself:** Separate issue. Audit asserts ≥50% of sets have `lego_mrp_inr` populated. Actual: 0%. Correctly reporting a real data gap (PRICE-PIPELINE-01). Will continue failing until that pipeline ships.

**Fix:**
Add to `catalogue-audit.yml`:
```yaml
permissions:
  issues: write
```

**Status:** Patched 2026-05-09 — `permissions: issues: write` added at job level (commit `775de46`, squashed into `e5b71b1` via PR #2 merge).

---

## DEFECT-009 — /sets and /compare listing pages reading old prices table instead of store_prices

| Field | Value |
|---|---|
| Found during | Day 7 code audit, 2026-05-09 |
| Found by | grep across src/ — store_prices referenced in sets/[slug] and deals but not in listing pages |
| Severity | Medium — live scraper prices invisible on /sets, /sets/page/[page], /compare |
| Patch commit | `9ced905` |

**What was wrong:**
`src/app/sets/page.tsx`, `src/app/sets/page/[page]/page.tsx`, and `src/app/compare/page.tsx` all fetched prices via `prices(*)` — a PostgREST join on the old `prices` table (schema: `store_name`, `availability`, `is_active`, `buy_url`). The scraper pipeline writes to `store_prices` (schema: `store_id`, `in_stock`, `product_url`). These are different tables with different schemas. The scraper has been running since INFRA-03 (2026-04-24) but its output was never visible on any listing page.

The only pages reading `store_prices` correctly were `sets/[slug]/page.tsx` (detail page) and `deals/page.tsx` (with a fallback to `prices`).

**Impact:**
- All set cards on /sets and /compare showed no live price ("Price TBD" or MRP fallback)
- Price filter on /compare queried `lego_mrp_inr` (0% populated) — filter was effectively a no-op

**Fix applied:**
- `sets/page.tsx` + `sets/page/[page]/page.tsx`: removed `prices(*)` join; added secondary `store_prices` query scoped to the page's set numbers; built `priceMap` (set_number → cheapest row); passed to `SetCard`
- `compare/page.tsx`: same `store_prices` wiring; price filter moved to client-side against `priceMap` so it operates on live store prices rather than `lego_mrp_inr`
- `SetCard.tsx`: narrowed `bestPrice` prop type from `Price` (8 required fields) to `{ price_inr: number | null }` — the only field the component reads

**Lesson:**
When adding a new scraper table, audit all listing pages that display prices — not just detail pages. The `prices(*)` join pattern was copy-pasted across 3 pages without being updated when `store_prices` was introduced.

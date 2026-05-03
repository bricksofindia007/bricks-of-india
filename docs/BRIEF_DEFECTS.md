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

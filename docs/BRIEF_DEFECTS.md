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

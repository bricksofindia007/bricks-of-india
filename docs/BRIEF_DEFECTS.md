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

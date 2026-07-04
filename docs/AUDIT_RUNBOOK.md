# BOI 360° Audit Runbook

Monthly standing procedure. First run: `docs/audits/BOI_360_AUDIT_2026-07-04.md` — read it once as a worked example before running this for the first time.

## The permanent rule this runbook exists to enforce

**Operator-action items are reported only from run logs, account checks, or Abhinav's explicit confirmation — never from tracker status text.** `BOI_MASTER_TRACKER.md` prose is a set of claims to test, not evidence. This rule was born from the 2026-07-04 audit finding multiple tracker entries that were stale, self-contradictory, or simply untrue against fresh evidence (HIGH-53 claimed 71 pending rows that had already dropped to zero; MEDIUM-50 was marked "Open" in its own entry while a *different* entry, MEDIUM-67, documented it closed with a verified before/after log comparison). Trusting tracker text as ground truth would have reported both of those as still-open.

## Cadence

Runs monthly, triggered by `.github/workflows/monthly-audit-reminder.yml` (cron `0 3 1 * *` — 1st of the month, 03:00 UTC). The workflow only sends a reminder email — it does not run the audit itself. The audit is read-only diagnostic work requiring judgment (log reading, cross-referencing, drift adjudication) and should be run by whoever (human or Claude session) is doing the monthly review, using this runbook as the checklist.

## Non-negotiable rules (apply every run, not just this one)

- Every finding carries an evidence tag: **[RUN-LOG]**, **[GH-API]**, **[DB-QUERY]**, **[LIVE-FETCH]**, **[REPO-GREP]** — with the raw line/number/output that proves it.
- Tracker prose is never evidence. It is a set of claims this audit tests.
- Anything not machine-verifiable is written as **OPERATOR-CONFIRM** with the exact question for Abhinav. Never report an operator-action item's status from tracker text.
- If a check fails or a tool errors, record **UNVERIFIED + reason**. Never substitute inference — "probably 429" is not evidence when the log is truncated before the status code.
- No fixes, no tracker status changes during the audit itself. The audit produces a report and an open-item register; closures happen in a separate pass after Abhinav has answered the OPERATOR-CONFIRM list.

## Part A — Cron truth table

1. `gh run list --limit 100 --json name,workflowName,conclusion,startedAt,event` for a broad recent snapshot.
2. For every workflow file in `.github/workflows/` (re-count each run — the number changes month to month): `gh run list --workflow=<file>.yml --limit 3 --json conclusion,startedAt,event`. Don't rely on the top-100 window alone — weekly/monthly crons fall out of it.
3. Parse each file's own `cron:` line ([REPO-GREP]) and flag any scheduled workflow whose last run is older than 1.5× its interval, or whose last 2+ runs are failures regardless of recency.
4. Any workflow with secrets as prerequisites (e.g. `ig-token-refresh.yml`): `gh secret list`, confirm by name only (never print values).
5. Special case worth repeating every run: a workflow whose only runs are `workflow_dispatch` (manual) has never proven its actual cron fires. Note this explicitly — "successful run exists" and "automation works unattended" are different claims.

## Part B — Generation/content pipeline health

1. `SELECT * FROM generator_runs ORDER BY started_at DESC LIMIT 10` — compare `drafts_succeeded` across recent runs. A trend toward zero is the signal, not any single run's "success" conclusion at the GH Actions level (the job can exit 0 while producing nothing).
2. Read the actual run logs (`gh run view <id> --log`, redirected through **`Out-File -Encoding utf8`** in PowerShell — plain `>` redirection produces UTF-16 and silently breaks every grep downstream) for the deferral/rejection reason text, verbatim.
3. Check whether the logged error message is truncated before the diagnostic detail (status code, model name). If so, say so — don't fill in the gap with the historically-known failure mode as if it were re-confirmed.
4. Cross-check against `pending_drafts` — approved rows with `draft_body IS NULL` is the leading indicator of a stall in progress, independent of any single run's outcome.
5. **State can change mid-audit.** Re-query at the point you write up Part B, not just once at the start — this pipeline runs on its own schedule regardless of when you happen to be looking. Timestamp every reading.

## Part C — Social posting cadence

1. `posted_sets` per day, last 35 days — the actual posting record, independent of what the workflow reports.
2. For any gap day, read the actual `social-automation.yml` log — look for the pipeline's own stated reason (`No candidates met the gallery image requirement` was 2026-07's answer) vs. an actual crash/traceback.
3. Contrast at least one "posted" day's log against a "gap" day's log side by side — this is what turns "the log says no candidates" into a confirmed, non-bug finding rather than an assumption.

## Part D — Database heartbeat

Run fresh every time, in-session — don't reuse numbers from a previous audit or from tracker prose. Minimum set: row counts + max timestamp on every content/pricing table that has one; `pending_drafts` by status; `posted_sets` per day; `generator_runs` last 10; `news_articles` per day, last 14 days. Add tables as the schema grows.

## Part E — Live site sweep

1. Build fresh (`npm run build`) to get a current `.next/app-path-routes-manifest.json`.
2. Curl every static route directly; for dynamic `[slug]`/`[theme]`/`[page]` routes, pull one real, current sample per type from the DB — don't guess a slug or reuse a stale one from a previous audit.
3. Hit **live production** (`https://bricksofindia.com`), not localhost — this part exists to verify what's actually deployed, not what builds locally.
4. Title-tag duplication check: grep every fetched page's `<title>` for the site name appearing twice. If found, check both possible root causes before concluding: (a) a page hardcoding the suffix in its own `metadata.title` [REPO-GREP], and (b) a stored DB column (`seo_title` or similar) that already has the suffix baked in [DB-QUERY]. They can co-exist and need different fixes.
5. SSL: `echo | openssl s_client -connect bricksofindia.com:443 -servername bricksofindia.com 2>/dev/null | openssl x509 -noout -enddate`.
6. Raw email sweep: grep every fetched route for `[A-Za-z0-9._%+-]+@bricksofindia\.com` — the widened pattern, not the old literal-address-only one.

## Part F — Tracker drift audit

1. List every item under `## Pending — Next Up`. For each: is it MACHINE-CHECKABLE (a file, a DB row, a git branch, a log) or OPERATOR-ONLY (a decision, an external account, a human action)?
2. For machine-checkable items, check against fresh Parts A–E evidence or a targeted new query — never against the tracker's own "Status:" line.
3. Watch for tracker self-contradiction, not just staleness: two entries about the same underlying issue (e.g. a root-cause entry and the original symptom entry it closes) can disagree with each other even without any external evidence — that's still drift, and it's often faster to catch than an external check.
4. Output three lists every time: CONFIRMED-OPEN (with evidence), DRIFTED (tracker says one thing, evidence says another), OPERATOR-CONFIRM (precise yes/no questions, never inferred).

## Part G — Repo hygiene

`npm audit --json` (summarize severity counts + package names, don't just paste the whole JSON); TODO/FIXME count in `src/`; `git branch -a` on every checkout you have access to (there have historically been 2–3 relevant checkouts — check MEDIUM-52/MEDIUM-55-style tracker entries for the current list of known checkouts before assuming there's only one).

## Deliverables, every run

1. `docs/audits/BOI_360_AUDIT_<date>.md` — same section structure as this runbook's parts, every line evidence-tagged.
2. One tracker changelog entry linking the new report. Do not change any `§Pending` item's status in this same pass — closures happen only after Abhinav has answered that run's OPERATOR-CONFIRM list.
3. Commit, push, confirm CI green (`gh run watch`, via PowerShell per this project's standing `gh`-through-PowerShell rule).

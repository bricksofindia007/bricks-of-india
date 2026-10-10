# BOI Agent Instructions

**Canonical reference:** `boi-ops/BOI_MASTER_TRACKER.md` (private repo `bricksofindia007/boi-ops`, cloned next to this one) — read this at the start of every session. Plans, reports, reconciliation notes, evidence, the tracker and the dashboard live in that private repo (C2, P14 round 6), not in this public one.

---

## Session discipline

SESSION START: Read `boi-ops/BOI_MASTER_TRACKER.md` — header block (metadata, current blockers, carry-overs, lab status, deadlines). Confirm the HEAD commit field matches `git log -1 --format="%H"`. Paste summary to strategic layer. Do not use `docs/SESSION_START_CHECKLIST.md` — that file's handover-doc protocol was abandoned after Day 35 and is queued for archival.

**Dashboard sync:** see `boi-ops/BOI_MASTER_TRACKER.md` § Auto-update protocol — every state change updates `boi-ops/admin/dashboard.html` in the same commit. The sync lint moved to boi-ops with the files.

**Dashboard validation:** at session start, confirm `boi-ops/admin/dashboard.html` JSON parses cleanly before doing anything else. If it doesn't, fix first.

**Issue-filing is binding, not optional.** Any future action item, pending decision, or "revisit later" note surfaced during a session — a deferred fix, an accepted risk, an operator-owned follow-up, a "not done this session, flagged not hidden" note — must be filed as a real GitHub issue before the session or PR is considered complete. A mention in chat, a commit message, or a tracker paragraph does not satisfy this — none of those are visible to anyone (including a future session) who isn't specifically reading git history end-to-end. Added 2026-08-23 after a 30-day audit found multiple real, still-open items (a confirmed-reachable, unpatched CVE deferred with a documented rationale; an operator-owned credential/OAuth follow-up; a documented internal-tooling reconciliation gap) living only in commit bodies and tracker prose, with zero corresponding issue, invisible to anything but a targeted grep. The tracker entry may still carry the full reasoning/context — the issue is the pointer that makes the item discoverable at all, not a replacement for that detail.

**Brief files:** task briefs live in `briefs/`. Read the relevant brief before executing any scoped task.

**Data sources runbook:** `DATA_SOURCES.md` — consult before touching any ingest script or Supabase schema.

**Defect log:** `docs/BRIEF_DEFECTS.md` — log every defect found during execution. Never reuse a defect ID.

**Handover docs:** Pattern retired after Day 35. Write a changelog entry in `boi-ops/BOI_MASTER_TRACKER.md` §Sprint changelog instead. No new Day_N_Ground_Truth files — `docs/handover/` is frozen.

**Cycle 2 plan:** `boi-ops/docs/plans/BOI_Cycle2_Master_Plan.md` (v2.4, approved 27 Sep 2026) is the scope, gate and open-item register for Cycle 2. Every plan ID has a GitHub issue (label `cycle-2` plus `stage-0` / `foundation` / `build` / `trust`, title prefixed with the plan ID). No closing keywords (`Closes #`, `Fixes #`) in commits or PRs; issues close only through an evidence comment. Email addresses and DNS: `docs/email/ADDRESSES.md`.

---

## Cycle 2 guardrails (binding, plan §13)

These are rules, not guidance. Where an older rule further down this file conflicts with one of them (e.g. the Resend `from` address or Netlify-era notes), the guardrail wins, and the older rule is updated when the work that changes it lands.

- **G1 — Public pages stay cached.** No cookies, headers or session reads on public routes. Auth UI is client-only. Middleware only on `/account` and `/auth`. Enforced by the FP3.4 CI check.
- **G2 — Every new request path goes in the budget:** Supabase calls, Worker routes, KV/R2 operations, emails, Actions jobs. Volume stated in the PR; plan §10 updated.
- **G3 — Pages get price data only through the snapshot reader.** The Supabase RPC is a fallback, never the primary path.
- **G4 — Retailers are data.** The registry plus runtime display flags. No retailer-specific branches in display code.
- **G5 — Every scraper uses the contract** (FP5): identity ladder, breaker, batched writes, change-only history, heartbeat, robots snapshot, bot identity.
- **G6 — Nothing is guessed.** Unmatched listings go to the queue. Remaps purge history, with a backup first.
- **G7 — Migrations only from repo files,** rehearsed on staging, rollback SQL, backup first. Never through MCP.
- **G8 — RLS everywhere;** explicit grants per role; the negative-test suite must pass.
- **G9 — Flags before launches.**
- **G10 — Jobs are safe to re-run** (dedupe keys; write only after validation).
- **G11 — Honest wording comes from data** (store lists, counts, "tracking since").
- **G12 — Every email goes through the gateway,** with a stream, an idempotency key and a suppression check. No direct provider calls anywhere else.
- **G13 — Every scheduled job writes a heartbeat.** A job without one isn't allowed in production.
- **G14 — Fail honest, not wrong.** Any new code path must state its failure behaviour, and that behaviour must degrade to older-but-labelled data or to no output, never to incorrect output.
- **G15 — The `extensions` schema is never added to PostgREST's exposed-schema list without a security review and a chat sign-off; this is what keeps the http extension (and anything else moved there) unreachable via the Data API.** (Added 27 Sep 2026, FP3.0 #361: the http functions there still carry PUBLIC EXECUTE granted by `supabase_admin`, which `postgres` can't revoke.) Enforced by the `G15 extensions-schema exposure probe` step in `.github/workflows/ci.yml` (one live request per CI run: the `extensions` profile must return 406 PGRST106).
- **G16 — Published content is corrected, never removed.** Reviews, articles, news, guides and every public page are fixed in place: back up the prior text, correct only what's wrong, and add a visible dated correction note. No published row is deleted or unpublished, and no public URL is retired, without chat's explicit sign-off. The only accepted exception is merging a true duplicate, and then the old URL must 308 to the surviving page. Drafts that fail quality gates before publication are not covered. (Added 27 Sep 2026 by Abhinav, binding.)
- **G17 — No command may print a secret's value.** Secret searches list names and locations only (`grep -l`, key names, masked values). Never grep or cat `.env*` files, secret files or connection strings for content. If a value is ever printed, stop, report it, and treat it as compromised (rotate). (Added 28 Sep 2026 by Abhinav, binding, after a search printed three growth-role passwords into a session.)
- **G18 — Dates are never deadlines.** Sequence all work by dependencies and evidence gates. Reports state what each item is waiting on (a dependency, a proof count, or a decision), never a target date. (Added 28 Sep 2026 by Abhinav, binding. It replaced the 5–11 Oct deploy freeze and every dated deploy in the snapshot plan.)
- **G19 — Nothing public reveals how Bricks of India works.** No public page, meta tag, JSON-LD, alt text, HTML comment, public text file (robots.txt, llms.txt, manifests), email, video description, caption or article may mention: scraping or scrapers, bot behaviour, feeds, APIs, Shopify or products.json, schedules or update frequency ("every 6 hours"), automation, cron, AI/LLM generation, model or provider names, pipelines, gates, pricing formulas or anchor rules, which store is the MRP reference, security posture (rate limits, infrastructure), internal paths or tool names. No price timestamps on public pages (Abhinav, 4 Oct 2026). "We check prices daily" is the only cadence statement; a price past the 48 h limit is never shown as current. Kept on purpose: the /bot page's two sentences (who the bot belongs to, how to reach us). Every content-generation prompt and quality gate carries this rule. Factual content is still corrected per G16, with wording approved by chat. (Added 1 Oct 2026 by Abhinav, binding, non-negotiable.)

Transitional: G3, G12 and G13 describe systems not yet built. Existing paths are grandfathered only until their migration item lands (G3 → FP1.1, G12 → FP4.9, G13 → FP6.1). No NEW path may add a direct price read, a direct provider email call or an un-heartbeated scheduled job unless chat approves it in writing and an issue tracks it.

---

## Git rules

**Git staging:** never `git add -A` or `git add .`. Always name files explicitly. Diagnostic files in the working tree have drifted into commits twice.

**Always push after commit.** Do not leave commits un-pushed at session end.

**Branching:** use a feature branch + PR for anything touching deployable code (src/, scripts/, or anything that could break the build). The email-guard checks (snapshot-tests, verify-no-email-in-client-bundle) run identically on push-to-main and on PRs — but a direct push to main deploys to prod in parallel with those checks, not gated on them, so a failure is discovered after the code is already live. A PR gives a checkpoint to see check results before merging. This gate is enforced by branch protection on the two email-guard checks — merging a PR is blocked until they pass. Direct pushes by repo admins remain unblocked (enforce_admins is off) to preserve the docs-only fast path above. Direct commits to main remain fine for docs-only or tracker-only changes (e.g. BOI_MASTER_TRACKER.md, docs/) where nothing can break.

**Use PowerShell for `gh` commands** — the Bash tool does not inherit Windows PATH additions, so `gh` is not visible there. `gh run list`, `gh pr create`, `gh pr merge`, `gh workflow run`, `gh run watch` all go through the PowerShell tool.

**Never amend** unless the user explicitly asks. Create new commits instead.

---

## Staged/experimental code rules

**Gate activation with `config/feature_flags.py`, not comments or commit messages.** A comment like `# SHADOW MODE (2026-08-16)... hold for 08-22` or a commit message titled `"Staged: ... (hold for 08-22)"` is not enforced by CI and goes live the moment it's merged, regardless of the wording's intent. Incident: commit `7fc986d` (merged 2026-08-16) added a shadow-mode diagnostic to `generate_quiet_panic_video.py`'s `run_all_gates()` gated only by such a comment; it crashed the very next scheduled VID-QP run (2026-08-17) with `TypeError: 'bool' object is not subscriptable` because the "non-blocking, purely logged" code was, in fact, live and unconditionally executed. Fixed 2026-08-18.

Any code merged to main but not yet meant to be active must check an explicit flag from `config/feature_flags.py` (a plain dict, flags default `False`) at the call site:
```python
from config.feature_flags import FEATURE_FLAGS
if FEATURE_FLAGS.get("some_flag", False):
    ...
```
Flipping a flag to `True` is then a deliberate, reviewable, one-line diff — not a side effect of an unrelated merge landing on its intended date.

**Existing precedent for a different (also-acceptable) pattern:** `src/lib/lab-tools.ts`'s `coming_soon: true` / `href: null` fields, checked by `src/components/ui/LabStrip.tsx`, gate LAB-02's tile the same way — a real, checked field, not a comment. Either pattern (a `config/feature_flags.py` entry, or an explicit checked field local to the feature) is fine; an unenforced comment alone is not.

---

## GitHub Actions workflow rules

**Every job requires `timeout-minutes`.** Without one, a hung step falls back to GitHub Actions' 6-hour default job ceiling — `video-generate-daily.yml`'s `generate` job did exactly this on 2026-08-18 (stalled `apt-get update`, cancelled after the full 6h, that day's VID-P4 run silently lost). Size it to ~2-2.5x the job's observed normal runtime (`gh run list --workflow=<file> --limit 10` to measure). If fewer than ~3 completed runs exist to measure from, don't guess — leave it unset and flag it for a human to size once there's real data (see `video-feasibility-test.yml` / `video-script-gen-test-quiet-panic.yml`, both deliberately left unset as of 2026-08-18 for this reason).

**Enforced by `.github/workflows/lint-workflows.yml`** on any PR touching `.github/workflows/**` — fails if a changed workflow's job lacks `timeout-minutes`. Scoped to only the files the PR actually changes (via `git diff` against the PR base), not the whole directory, specifically so the two pre-existing unset files above don't permanently block unrelated PRs.

---

## Next.js / Netlify rules

**Next.js middleware:** to expose request data to Server Components via `headers()`, use `NextResponse.next({ request: { headers } })`. `response.headers.set()` is browser-only and invisible to `headers()` — silent failure, no error thrown.

**Server Actions on Netlify:** use `redirect()` not `revalidatePath()`. Netlify does not support on-demand ISR revalidation the same way as Vercel — `revalidatePath` silently no-ops and the page stays stale. All mutating Server Actions must call `redirect(url)` to produce a visible page refresh.

**Netlify plugin:** `@netlify/plugin-nextjs: ^5.0.0` must be pinned in `package.json` devDependencies. Without it, Netlify may resolve to v4 which does not support Server Actions. The plugin is also declared in `netlify.toml [[plugins]]` — both are needed.

**Netlify env vars:** `NEXT_PUBLIC_*` vars must be set in Netlify's Environment Variables UI — they are NOT automatically inherited from GitHub Secrets. GitHub Secrets only flow into GitHub Actions jobs, not Netlify builds.

**`createClient` guard:** `@supabase/supabase-js` `createClient('', key)` throws synchronously at module load. Guard `createServerClient()` with an explicit URL check:
```ts
if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set — check Netlify environment variables');
```

---

## Known Netlify Gotchas

**`toLocaleString('en-IN')` is not ICU-safe on Netlify serverless.** Netlify's Node.js runtime uses a minimal ICU build that does not include the `en-IN` locale. Calling `.toLocaleString('en-IN')` in any Server Action or server component throws `RangeError: Incorrect locale information provided` (error digest `1117754790`). Always use the `fmtInr()` helper (defined in `src/app/admin/pending/actions.ts`) or an equivalent regex-based Indian number formatter.

**BOM characters silently corrupt env vars from GitHub Secrets.** GitHub Secrets copied from BOM-encoded source files include a leading U+FEFF byte — invisible in the UI but breaks `Authorization: Bearer <key>` headers with `TypeError: Cannot convert argument to a ByteString`. Always read secrets via `getSecret(name)` from `src/lib/get-secret.ts`, not `process.env` directly. Applies to all Bearer-bound keys (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `CEREBRAS_API_KEY`). Two incidents in 14 days before centralization (commits `1dfef88`, `ceb130b`).

**Live page verification is mandatory before closing any content fix.** TypeScript compilation and CI green verify code correctness, not that content renders correctly on the deployed page. After any fix touching rendered content (HTML comment stripping, markdown processing, price display), fetch the live URL and confirm the symptom is absent in the response body before marking the issue closed.

**Netlify is deploy-only, reserved for final site changes.** All testing/verification happens via GitHub Actions CI, local builds, or Supabase — never by pushing to trigger a Netlify build. The `paths:` guard on `.github/workflows/deploy.yml` enforces this at the infrastructure level; do not bypass or remove it without explicit operator approval.

---

## Supabase rules

**Service role key:** always use `createServerClient()` (service role key) for server-side writes and admin queries. The anon client (`supabase`) is for public reads only.

**PostgREST 1000-row cap:** Supabase hosted PostgREST returns at most 1000 rows per request regardless of `.limit()` or `.range()` overrides — these are silently capped server-side. For queries that must return full tables (e.g. loading all set numbers for matching), paginate in a loop with `.range(offset, offset + PAGE - 1)` until a page returns fewer than PAGE rows.

**RLS rule (PROCESS-RLS-01):** every new migration that creates a table MUST include `ENABLE ROW LEVEL SECURITY` and explicit policies. Default Supabase project setting is RLS off — omitting it means anonymous users have full read/write access. Verified: price_snapshots and pending_drafts were exposed for 3 days before fix (DEFECT-007).

**`pending_drafts` — source_url is NOT unique.** Migration `20260503120000_pending_drafts_iteration.sql` dropped the unique index to allow multiple iteration rows per source. Use plain `.insert()`, not `.upsert(onConflict: 'source_url')` — that throws `42P10` because the constraint no longer exists.

**`store_prices` conflict key:** `onConflict: 'set_id,store_id'` — one row per set per store.

---

## Price data rules

**One price table: `store_prices`** — schema `set_id`, `store_id` (FK to `stores`, the FP5.1 retailer registry), `price_inr`, `in_stock`, `product_url`, `scraped_at`. Written by `scripts/scrape-now.mjs` every 6h; `price_history` is written change-only by the `trg_price_history_on_change` trigger on it (FP5.7, ADR 0002). Deals, badges and best price come from the `set_price_summary` view. The legacy `prices` table was dead since 2026-05-10 (every price NULL) and was dropped on 2026-09-27 (FP5.1, backup in `boi-db-backups6-09-27-fp5.1\`); /deals does not read it.

---

## Model canary rules

**Every model integration used by production code (primary or fallback, any of the 3 content pipelines) must have a check in `scripts/canary/model_canary.py`, run daily by `.github/workflows/model-canary.yml`.** Added 2026-08-22 after `gate_coherence_llm_judge` (both video pipelines) was found to have been silently fail-open for an unknown period — it targeted a Groq model (`llama-3.3-70b-versatile`) that had been decommissioned, and the gate's own correct fail-open-on-transient-error design meant the permanent failure never surfaced anywhere. This canary exists to fail loudly instead.

When adding a new model (a new fallback provider, a primary-model swap, a new pipeline entirely): add a corresponding `check_*()` call in `model_canary.py`'s `main()`. A missing/empty API key must be reported as its own distinct "SECRET NOT CONFIGURED" failure, not silently skipped — a model integration whose secret was never provisioned is exactly the same class of invisible gap as a dead model (confirmed real 2026-08-22: `GROQ_API_KEY` was never added as a repo secret at all, meaning every Groq call site — including the coherence-gate fix itself — has been fail-open in production regardless of which model it's configured to use).

A known, already-accepted failure condition (e.g. Cerebras's payment-block, 402, tracked via `cerebras_fallback_enabled`) should be classified as such explicitly in the check function, not left to trip the canary red every day for a condition that's already flagged off and understood.

**Route every secret through `secrets_util.get_secret()`, not a bare `os.environ.get()`** — even in this canary itself. Confirmed real, 2026-08-23: the canary's own first live GitHub Actions run failed both `GEMINI_SOCIAL_API_KEY` and `CEREBRAS_API_KEY` checks with `'ascii' codec can't encode character '﻿'` — a BOM byte in those secrets, an already-documented gotcha (see "Known Netlify Gotchas" below) that every real pipeline script already routes around, but this canary bypassed by reading the key directly. Fixed same day. The irony is the point: a tool built to catch silent failures needs the same care as the code it's watching, or it becomes a second source of exactly the false-negative/false-positive noise it exists to eliminate.

---

## RADAR pipeline rules

**RADAR-04 does NOT run inside `radar.yml`.** Never add generation to `radar.yml` — that workflow is RADAR-01/02/03 only (fetch → dedupe → classify). Mixing generation into the ingestion cron burns Gemini quota on unreviewed signals indiscriminately (DEFECT-012).

**Generation runs in `generate-drafts.yml`** — a separate workflow on a daily schedule (08:30 UTC, 90 min after Gemini quota reset at 07:00 UTC). Script: `scripts/generate-approved-drafts.ts` (TypeScript, Gemini 2.5 Flash-Lite primary → Cerebras gpt-oss-120b failover, 6 lint gates, auto-publish on full gate pass). Also triggerable via `workflow_dispatch` or the `/admin/pending` "Generate Article" button (one draft at a time). `generate-drafts.js` (older Node script) is deprecated — do not use for new work.

**`radar.yml` cron = RADAR-01 → RADAR-02 → RADAR-03 only.** Signals are fetched, deduped, and classified automatically. Generation and publishing run on separate schedules.

**Pipeline order:** RADAR-01 (fetch) → RADAR-02 (dedupe) → RADAR-03 (classify → pending_drafts) → RADAR-04/generate-drafts.yml (generate bodies for approved rows, auto-publish on full lint pass) or `/admin/pending` (manual approve/reject for `status='draft'` rows still awaiting operator review pre-generation).

**Publishing policy (superseded 2026-06-28, re-confirmed 2026-09-22 during a write-job audit — issue #170):** `generate-approved-drafts.ts` generates a draft's body and, on full pass of all lint/factuality/voice gates, auto-publishes it directly — no separate publish cron. A draft that fails any gate is **rejected**: since 4 Oct 2026 (#525, Abhinav's decision of 2 Oct) it is kept for 30 days as `status='rejected'` with its reason (`discard_reason` starting `rejected_by_gates:` or `both_providers_failed:`) and its generated text, then deleted by `scripts/retention-cleanup.mjs`. It is never republished from there. Rejected rows from before 4 Oct are not touched by that purge. Exception: a review or news draft whose only failing gate is Gate 14 is held for review (`status='draft'`, back in `/admin/pending`), never discarded. The older `publish-drafts.yml` cron + `status='failed_lint'` parking/manual-approve-then-republish model this section used to describe is retired (workflow deleted, `scripts/publish-drafts.mjs` kept only as a deprecated reference) — it queried a status value that stopped receiving real input the same day this policy took effect, and ran 3×/day reporting `success` while publishing nothing for roughly 3 months before being found. `/admin/pending`'s reject action sets `status='rejected'`, not a delete — nothing currently reads that status, so it's an inert dead end, not literal deletion.

**RADAR-03 qualifying threshold:** score ≥ 4 (Tier 1=5pts, Tier 2=4pts, Tier 3=3pts; has body +2pts; freshness +2/+1pts). Tier 4/5 almost never qualify unless they have body content.

**Gemini rate limit:** Gemini 2.5 Flash-Lite free tier = 10 RPM. Add 7s delay between calls in `generate-drafts.js`. On 429, stop immediately and do NOT retry.

**`sanitizeXml(xml)`** in `fetch-rss.js` strips bare HTML boolean attributes (`crossorigin`, `async`, etc.) and escapes unescaped `&` before rss-parser sees the XML. New Elementary's feed has a third cascading violation (mismatched tags) that requires a full parser swap to `@extractus/feed-extractor` — New Elementary stays `enabled: false` until that ships (PARSER-01).

---

## Admin UI rules

**`/admin/pending` auth:** cookie `boi_admin` set to the value of `ADMIN_PASSWORD` env var. 8-hour session, `httpOnly`, `sameSite: strict`, `/admin` path scope. `ADMIN_PASSWORD` must be set both in `.env.local` (local) and Netlify Environment Variables (production).

**`/admin/pending` filters:** status/format/source-domain chips are URL-driven (`searchParams`). `redirectTo` hidden input in every form preserves the current filter state after approve/reject/approveAll actions.

---

## Email rules

**Transactional email provider: Resend SDK** — `resend@6.12.3` installed. Server Action at `src/app/actions/newsletter.ts`. Do NOT use nodemailer for newsletter confirmation; use `new Resend(process.env.RESEND_API_KEY)`.

**Resend from address:** always `'Bricks of India <abhinav@bricksofindia.com>'` — domain verified in Resend dashboard.

**RESEND_API_KEY** is set in all three env stores: `.env.local`, Netlify Environment Variables (runtime scope), GitHub Secrets. Do not add it to any committed file.

**ImprovMX is receive-only.** `bricksofindia.com` MX records point to ImprovMX for email forwarding. ImprovMX free plan has no SMTP sending capability — confirmed 2026-05-10. Do not attempt to use ImprovMX SMTP credentials for outbound mail.

**`newsletter_subscribers` RLS:** table has `ENABLE ROW LEVEL SECURITY` with a single `anon INSERT` policy (migration `20260510000000`). No SELECT/UPDATE/DELETE for anon. Service role can read all rows. The insert from the Server Action uses `createServerClient()` (service role), which bypasses RLS — this is correct.

**`scripts/test-email.js`** — diagnostic script that sends a test email to `abhinav@bricksofindia.com` via Resend. Loads `RESEND_API_KEY` from `.env.local`. Run with `node scripts/test-email.js`.

---

## Sources config

**Active sources as of Day 9 (session 3):** 15 sources across 5 tiers. Tier 1: Brothers Brick, Jay's Brick Blog, BrickNerd (New Elementary disabled — PARSER-01). Tier 2: Brickset (`/feed`, not `/article/rss`), Rebrickable API (LEGO New Sets disabled — SPA). Tier 3: r/lego. Tier 4: **7 YouTube channels** — BrickClicker, JANGBRiCKS, Brick Vault, Tiago Catarino, Brick Finds & Flips, JB Spielwaren, **Bricks of India** (channel_id: `UC1CCrLlp4XnOoxVzAftFwfQ`, added 2026-05-10). Tier 5: Blocks Magazine (`blocksmag.com/news/`, no www), Brick Fanatics (others disabled — SCRAPE-01).

**YoutubeStrip homepage component** (`src/components/content/YoutubeStrip.tsx`) filters to `source_name = 'Bricks of India'` only — shows BOI's own channel. Returns `null` (hidden) if no rows match. Heading: "LATEST VIDEOS".

**Brickset correct URL:** `https://brickset.com/feed` — the old `/article/rss` endpoint returns an HTML page, not RSS.

**Blocks Magazine correct URL:** `https://blocksmag.com/news/` (no www, trailing slash) — the www version 301-redirects and the hostname mismatch filtered all links.

---

## Scraper rules

**`scrape-now.mjs` knownSets pagination:** loads `sets` table via paginated `.range()` loop (PAGE=1000) to bypass PostgREST 1000-row cap. Without this, only the first 1000 sets are matched and ~95% of store products are logged as "no DB match" (bug fixed 2026-05-09, commit `3a683f9`).

**MBH domain:** `lego.mybrickhouse.com` — the general `mybrickhouse.com` domain returns mixed inventory with low LEGO match rates.

**Variant selection:** use cheapest in-stock variant (filter `v.available === true`, sort by price asc). Fall back to cheapest overall if none in stock.

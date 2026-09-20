# Deployment Guide — Bricks of India

Production deploys run entirely on **Netlify's native git integration** —
Netlify detects a push to `main`, builds, and publishes on its own
infrastructure. There is no GitHub-Actions-driven build or CLI/API call in
the deploy path anymore.

---

## How deploys work

| Trigger | What happens |
|---------|-------------|
| Push to `main` | Netlify's native git integration builds (`npm run build`) and publishes directly — no GitHub Actions involvement. |
| `.github/workflows/deploy.yml` | Kept inert as a record of which paths count as "site-relevant" (its own `paths:` filter) and a home for a manual no-op `workflow_dispatch`. It runs no build and calls Netlify in no way. |

### Why this changed (history, so this isn't rediscovered from scratch)

This repo originally (2026-04-23, commit `8992aef`, INFRA-03) moved
production builds *off* Netlify and onto GitHub Actions on purpose:
`deploy.yml` ran `npm run build` + `netlify-cli deploy --build --prod`,
and `netlify.toml` carried `ignore = "exit 0"` to unconditionally skip
Netlify's own native git-integration build — at the time, Netlify's
pricing metered build minutes separately from the deploy itself, so
building on GHA's free minutes and only publishing the pre-built artifact
to Netlify genuinely saved cost.

That architecture was retired 2026-08-23, for two independent reasons:

1. **Netlify's "Enforce deployment methods" dashboard setting was later
   set to Git-only production deploys.** This rejects any CLI/API-token-
   authenticated deploy outright — confirmed live, `deploy.yml`'s CLI step
   had been failing every single run since at least 2026-08-14 with
   `JSONHTTPError: Forbidden`, not because of exhausted build credits (the
   original suspicion), but because the deploy *method itself* was no
   longer permitted.
2. **Netlify's current credit-based pricing bills a production deploy at
   a flat 15 credits regardless of where the build runs** — the build
   itself is already covered; build minutes are not metered separately
   the way they were under the pricing model INFRA-03 was designed
   against. The original cost-saving rationale for keeping builds off
   Netlify no longer applies.

Both `deploy.yml`'s CLI deploy step and `netlify.toml`'s `ignore = "exit
0"` have been removed accordingly. Netlify's native git integration is
now the sole real deploy mechanism.

---

## One-time setup: add GitHub secrets

Go to: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

Add each secret below exactly as named (case-sensitive).

### Netlify deploy secrets — NO LONGER NEEDED (2026-08-23)

`NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` were only required for
`deploy.yml`'s `netlify-cli deploy` call, which has been removed (see
"Why this changed" above). Deploys no longer use these secrets at all —
left here as a historical note in case either secret still exists in
GitHub Secrets and someone wonders what it was for. Safe to leave in
place (unused) or remove; not consumed by any current workflow.

### Required for the Next.js build (7 secrets)

These must match what is in your `.env.local`. Add them all so the build
succeeds in GitHub Actions (where `.env.local` does not exist).

| Secret name | Notes |
|-------------|-------|
| `REBRICKABLE_API_KEY` | Server-only. Used at build time for theme pages. |
| `BRICKSET_API_KEY` | Server-only. Used for image fallback chain. |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret. Never expose client-side. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics measurement ID. |
| `NEXT_PUBLIC_SITE_URL` | `https://bricksofindia.com` |

### Required for health-check.yml (2 secrets)

| Secret name | Notes |
|-------------|-------|
| `RESEND_API_KEY` | Resend API key — same as newsletter. Already in GitHub Secrets if newsletter email is working. |
| `BRIEF_EMAIL` | Email address to receive health alerts. Set to `abhinav@bricksofindia.com` or any address you monitor. |

### Required for batch article generation (2 secrets)

| Secret name | Notes |
|-------------|-------|
| `GEMINI_API_KEY` | Primary generator — `scripts/generate-approved-drafts.ts` reads this via `getSecret('GEMINI_API_KEY')` in the GHA daily cron (08:30 UTC). **Also add to Netlify** (see below) — `generateArticle()` Server Action uses it at runtime for on-demand single-draft generation. |
| `CEREBRAS_API_KEY` | Cerebras failover (gpt-oss-120b) — used by `generate-approved-drafts.ts` when Gemini returns 429 or 5xx. GHA secret only — the failover path runs inside the scheduled cron, not at Netlify request time. |

### Required for content-quality.yml — daily content quality pipeline (5 secrets)

| Secret name | Notes |
|-------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Already present. |
| `SUPABASE_SERVICE_ROLE_KEY` | Already present. |
| `RESEND_API_KEY` | Already present. |
| `BRIEF_EMAIL` | Already present. |
| `NEXT_PUBLIC_SITE_URL` | Already present (needed by visual renderer + report links). |

All 5 secrets already in GitHub Secrets. **New Supabase tables required** — run migration `supabase/migrations/20260529000000_content_quality_system_v2.sql` in Supabase dashboard before first workflow run:
- `content_quality_issues` — adds `auto_fixable` + `fix_detail` columns
- `content_image_registry` — image URL registry with HTTP status + duplicate tracking
- `content_fix_log` — before/after log of every auto-fix applied

Schedule: daily `03:00 UTC` (08:30 IST). 5-step pipeline: linter → auto-fixer → visual renderer → verify → email report. Steps 1–4 have `continue-on-error: true` so the report always sends.

---

### Required for brief.yml — daily morning brief (5 secrets)

| Secret name | Notes |
|-------------|-------|
| `RESEND_API_KEY` | Already present if health-check email is working. |
| `BRIEF_EMAIL` | Already present from health-check setup. |
| `SUPABASE_SERVICE_ROLE_KEY` | Already present from build secrets. |
| `NEXT_PUBLIC_SUPABASE_URL` | Already present from build secrets. |
| `GH_DISPATCH_TOKEN` | Fine-grained PAT (Actions read/write, repo scope) — already in Netlify. Reuse same secret here for GitHub API queries (pipeline status section). |

All 5 secrets are already in GitHub Secrets from prior setup. No new secrets required.

**Total: 13 secrets to add (brief.yml reuses existing secrets; GEMINI_API_KEY and CEREBRAS_API_KEY added for generation workflow — 2 new since original setup).**

---

## One-time setup: add Netlify environment variables

**GitHub Secrets ≠ Netlify environment variables.** GitHub Secrets only flow into
GitHub Actions jobs (the build step). They are not visible to Netlify Functions at
runtime. Server Actions, API routes, and server components that read `process.env`
at request time need their vars set separately in the Netlify UI.

Go to: **Netlify → bricksofindia.com → Site configuration → Environment variables → Add a variable**

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same value as the GitHub Secret. Needed at runtime by server components. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same value as the GitHub Secret. Needed at runtime by server components. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Actions and API routes use this at runtime — never expose client-side. |
| `REBRICKABLE_API_KEY` | `src/lib/rebrickable.ts` is called at request time by set/review pages. |
| `RESEND_API_KEY` | Newsletter subscribe (Server Action) and lint-failure alerts (`publishDraft`) run at runtime. |
| `ADMIN_PASSWORD` | `/admin/pending` login and session auth check run at runtime. |
| `GEMINI_API_KEY` | `generateArticle()` Server Action calls Gemini at runtime. **Missing from Netlify = generation fails.** |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Rendered server-side into the `<head>` — must be present at runtime. |
| `GH_DISPATCH_TOKEN` | Fine-grained PAT with Actions read/write scope, repo scope only. Used by the "Generate All" button to trigger `generate-drafts.yml` on GitHub Actions. Regenerate annually. |

**Total: 9 variables to add in Netlify UI.**

Note: `BRICKSET_API_KEY` and `NEXT_PUBLIC_SITE_URL` are only used in local scripts
or are not referenced in `src/` — they do not need to be added to Netlify.

---

## Testing a deploy

1. Push a site-relevant change to `main` (`src/**`, `public/**`,
   `package.json`, `next.config.mjs`, etc.).
2. Check **Netlify → bricksofindia.com → Deploys**. A new deploy should
   appear automatically, triggered by Netlify's own git integration —
   no GitHub Actions run is involved in building or publishing it.
3. Watch it reach **"Published"**. If it shows **"Skipped"** or never
   appears at all, something is still telling Netlify's native
   integration not to build — check `netlify.toml` for a re-added
   `ignore` field and the Netlify dashboard's own build-trigger settings
   first.
4. Once published, visit **bricksofindia.com** to confirm the live site
   is serving the new build.

---

## Finding your Netlify Site ID (screenshot path)

1. Log in at **app.netlify.com**
2. Click the **bricksofindia.com** site card
3. Click **Site configuration** (left sidebar)
4. Under **Site information**, the Site ID is the UUID shown below the site name

Example format: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

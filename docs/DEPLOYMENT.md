# Deployment Guide — Bricks of India

Builds run on **GitHub Actions** (free minutes). Netlify receives only the
pre-built artifact. This protects the 50 Netlify build-credit limit.

---

## How deploys work

| Trigger | What happens |
|---------|-------------|
| Push to `main` | GHA runs `npm run build`, then `netlify-cli deploy --prod` |
| `workflow_dispatch` | Same as above, manually triggered from GitHub Actions tab |
| Netlify detects a push | `ignore = "exit 0"` in `netlify.toml` tells Netlify to skip — 0 credits consumed |

---

## One-time setup: add GitHub secrets

Go to: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

Add each secret below exactly as named (case-sensitive).

### Required for Netlify deploy (2 secrets)

| Secret name | Where to get it |
|-------------|-----------------|
| `NETLIFY_AUTH_TOKEN` | Netlify → User settings (avatar top-right) → Applications → Personal access tokens → **New access token**. Scope: full access. |
| `NETLIFY_SITE_ID` | Netlify dashboard → select the **bricksofindia.com** site → **Site configuration** → scroll to **Site information** → copy the **Site ID** (looks like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). |

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

### Required for batch article generation (1 secret)

This secret is NOT used by GitHub Actions — it lives only in Netlify. Add it in the Netlify UI (see below), not here.

### Required for brief.yml — daily morning brief (5 secrets)

| Secret name | Notes |
|-------------|-------|
| `RESEND_API_KEY` | Already present if health-check email is working. |
| `BRIEF_EMAIL` | Already present from health-check setup. |
| `SUPABASE_SERVICE_ROLE_KEY` | Already present from build secrets. |
| `NEXT_PUBLIC_SUPABASE_URL` | Already present from build secrets. |
| `GH_DISPATCH_TOKEN` | Fine-grained PAT (Actions read/write, repo scope) — already in Netlify. Reuse same secret here for GitHub API queries (pipeline status section). |

All 5 secrets are already in GitHub Secrets from prior setup. No new secrets required.

**Total: 11 secrets to add (unchanged — brief.yml reuses existing secrets).**

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

## Testing the workflow

After adding all 9 secrets:

1. Go to: **GitHub repo → Actions → Build & Deploy to Netlify**
2. Click **Run workflow** → **Run workflow** (uses `main` branch)
3. Watch the run. It should:
   - Install deps (~60 s)
   - Build Next.js (~2–4 min)
   - Deploy to Netlify (~30 s)
4. After the run is green, visit **bricksofindia.com** to confirm the live site
   is serving the new build.

---

## Verifying Netlify credits are no longer being consumed

After INFRA-03 is live:

1. Push a trivial change to `main` (e.g., add a blank line to `README.md`).
2. Check **Netlify → bricksofindia.com → Deploys**.
3. The deploy status should show **"Skipped"** or **"Build cancelled"** — NOT
   a new build. If a build still runs, verify that `ignore = "exit 0"` is
   present in `netlify.toml` and that the file was deployed correctly.

---

## Finding your Netlify Site ID (screenshot path)

1. Log in at **app.netlify.com**
2. Click the **bricksofindia.com** site card
3. Click **Site configuration** (left sidebar)
4. Under **Site information**, the Site ID is the UUID shown below the site name

Example format: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

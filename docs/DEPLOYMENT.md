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

**Total: 9 secrets to add.**

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

# Secrets manifest (FP3.6)

**Names, locations, users and rotation only. Never values.** Created 28 Sep 2026 (P6 addendum item 10). Update it in the same commit as any secret that is added, moved, rotated or removed. The source of truth for GitHub is `gh secret list` / `gh variable list`; this file adds *who uses it* and *how it rotates*.

## Local files on Abhinav's machine (never committed, never printed by the terminal)
| File | Holds (key names only) | Used by | Rotation / notes |
|---|---|---|---|
| `C:\Users\bharg\.boi-secrets\staging.env.txt` (the real name ends in **`.txt`**) | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT` for the **staging** project | the terminal's `~/boi-stg.sh` (reads it without printing), staging rehearsals, FP3.3 probes | Replaced wholesale when staging is rebuilt in Sydney (P5 decision 5). The current (Singapore) project's values die with that project |
| `%APPDATA%\postgresql\pgpass.conf` | production DB password | *(was the terminal's production psql)* | **Deleted 28 Sep 2026** after the FP2.3 repair. Production DB changes now go only through `db-migrate.yml` (#403/#404) |

## GitHub Actions: environment secrets
| Environment | Secret | Holds | Used by | Rotation |
|---|---|---|---|---|
| `staging-migrations` *(to create, #404)* | `MIGRATE_DB_URL` | staging session-pooler URI as `postgres` | `db-migrate.yml` job 1 | set again after the Sydney rebuild; rotate with the staging DB password |
| `production-migrations` *(to create, #404; required reviewer bricksofindia007)* | `MIGRATE_DB_URL` | production session-pooler URI as `postgres` (a dedicated migration role isn't possible on Supabase: `postgres` can't grant its own membership) | `db-migrate.yml` job 2 | rotate with the production DB password (Supabase → Database → Reset password), then update this secret only |

## GitHub Actions: repository secrets (33, as of 28 Sep 2026)
| Secret | Used by | Rotation / notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | most pipelines and checks; site build | service key: rotate via Supabase API keys (JWT secret roll changes all). Read through `getSecret()` / `get_secret()` (BOM) |
| `CI_READONLY_DB_URL` | `migration-parity.yml` | role `ci_readonly` (SELECT on `schema_migrations` only). Rotate with a new locally computed SCRAM verifier plus `gh secret set` (the procedure is in #400) |
| `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_PUBLISHABLE_KEY` | `staging-keepalive.yml` | replace after the Sydney rebuild |
| `CLOUDFLARE_API_TOKEN` (+ variable `CLOUDFLARE_ACCOUNT_ID`) | `deploy-cloudflare.yml`, `set-render-census.yml` | deploy token. It has **no** Zone Analytics Read (census, 28 Sep). Rotate in Cloudflare → My Profile → API Tokens |
| `GROQ_API_KEY` | VID-P4/VID-QP coherence judges (fail closed), article judge audit (budgeted), model canary | shared quota: the article judge must stop first (P6 Step 4) |
| `GEMINI_API_KEY`, `GEMINI_SOCIAL_API_KEY`, `CEREBRAS_API_KEY` | drafts generator, social captions, fallbacks, canary | BOM-prone: always via `getSecret`/`get_secret` |
| `RESEND_API_KEY` | all legacy senders (to move behind the FP4.6 gateway) | send-only key; pay-as-you-go OFF (R30) |
| `BRIEF_EMAIL`, `CONTACT_EMAIL` | morning brief / alerts recipient; contact form | addresses, not credentials |
| `REBRICKABLE_API_KEY`, `BRICKSET_API_KEY` | catalogue sync, Gate 14 facts | rotate on the provider sites |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_API_KEY_ASMR`, `ELEVENLABS_VOICE_ID` | video pipelines (TTS) | |
| `IG_ACCESS_TOKEN`, `IG_USER_ID`, `FB_APP_ID`, `FB_APP_SECRET` | Instagram posting | `IG_ACCESS_TOKEN` is refreshed automatically by `ig-token-refresh.yml` (60-day long-lived token) |
| `ADMIN_PAT` | `ig-token-refresh.yml` (writes `IG_ACCESS_TOKEN`) | fine-grained PAT, this repo, Secrets read/write. **Record its expiry date here when next rotated** |
| `GH_DISPATCH_TOKEN` (GitHub secret, set 27 May 2026) | `brief.yml` (morning brief reads Actions state) | ⚠️ **Same name as the FP5.9 Worker secret, but a different token and a different store.** Proposal: rename this one to `BRIEF_GH_TOKEN` when next touched, to avoid confusion |
| `YOUTUBE_CLIENT_SECRETS` | YouTube upload | OAuth client JSON |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_SITE_URL` | site build | not secret, stored as secrets |
| `ADMIN_PASSWORD`, `GMAIL_APP_PASSWORD`, `GMAIL_USER`, `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` | **no workflow references them (28 Sep grep)** | candidates for removal. GMAIL_* have been dead since the move to Resend; Netlify is on the free tier and unused by the Cloudflare deploy. `ADMIN_PASSWORD` is used by the site runtime (Cloudflare env), not Actions. **Abhinav decides** before any deletion |

## Cloudflare Worker secrets (FP1.1 / FP5.9, PR 1; set by Abhinav, see #263)
| Worker | Secret | Also in GitHub as | Rotation |
|---|---|---|---|
| `boi-scheduler` | `SNAPSHOT_HMAC_KEY` | `SNAPSHOT_HMAC_KEY` (same value) | generate a new one, set both in one step (commands in #263); old signatures stop verifying at once |
| `boi-scheduler` | `GH_DISPATCH_TOKEN` (fine-grained PAT, this repo, Actions read/write; created 27 Sep with a 90-day expiry, **~26 Dec 2026**; recommend 366 days, plus a calendar reminder) | none | regenerate on GitHub → `wrangler secret put GH_DISPATCH_TOKEN --name boi-scheduler` |
| `boi-scheduler-staging` | `SNAPSHOT_HMAC_KEY` (a different value) | `SNAPSHOT_HMAC_KEY_STAGING` | as above. **Held** until the Sydney staging project exists (P5 decision 5) |

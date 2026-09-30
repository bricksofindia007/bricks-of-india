# Secrets manifest (FP3.6)

**Names, locations, users and rotation only. Never values.** Created 28 Sep 2026 (P6 addendum item 10).

**Machine-checked source of truth for GitHub Actions secrets:** `.github/secrets-manifest.json`. `scripts/audit-secrets-manifest.mjs` (in `code-audit.yml`) fails on any workflow/secret drift. It was resynced on 28 Sep (it had drifted on 20+ workflows). This file is the human companion: it covers what the JSON can't (local files, environment secrets, Cloudflare Worker secrets) plus rotation notes. Update both in the same commit when a secret is added, moved, rotated or removed.

## Local files on Abhinav's machine (never committed, never printed by the terminal)
| File | Holds (key names only) | Used by | Rotation / notes |
|---|---|---|---|
| `C:\Users\bharg\.boi-secrets\staging.env.txt` (the real name ends in **`.txt`**) | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT` for the **staging** project | the terminal's `~/boi-stg.sh` (reads it without printing), staging rehearsals, FP3.3 probes | Replaced wholesale when staging is rebuilt in Sydney (P5 decision 5). The current (Singapore) project's values die with that project |
| `%APPDATA%\postgresql\pgpass.conf` | production DB password | *(was the terminal's production psql)* | **Deleted 28 Sep 2026** after the FP2.3 repair. Production DB changes now go only through `db-migrate.yml` (#403/#404) |
| `C:\Users\bharg\.boi-secrets\prod_db_pw.txt` (single dot) | the production `postgres` password, **transient** | the terminal's one-off local connection test, then `gh secret set` for `production-migrations` | Exists only during a rotation. Delete it once the terminal confirms the secret is set (procedure below) |

## GitHub Actions: environment secrets
| Environment | Secret | Holds | Used by | Rotation |
|---|---|---|---|---|
| `staging-migrations` *(created 29 Sep 2026; main only)* | `MIGRATE_DB_URL` | staging session-pooler URI as `postgres` | `db-migrate.yml` job 1 | set again after the Sydney rebuild; rotate with the staging DB password |
| `staging-seed` *(created 29 Sep 2026; main only; required reviewer bricksofindia007)* | `STAGING_DB_URL` | staging session-pooler URI as `postgres` | `seed-staging.yml` (writes the staging content seed, #443) | set again after each staging rebuild; rotate with the staging DB password |
| `production-migrations` *(created 29 Sep 2026; main only; required reviewer bricksofindia007, self-review allowed)* | `MIGRATE_DB_URL` | production session-pooler URI as `postgres` (a dedicated migration role isn't possible on Supabase: `postgres` can't grant its own membership) | `db-migrate.yml` job 2 | rotate with the production DB password, **dashboard reset only** (procedure below), then update this secret only. Set 29 Sep 2026 18:27 UTC |

## Rotating the `postgres` password (production or staging), P12, 29 Sep 2026
**The only way is the Supabase dashboard reset:** Project Settings → Database → Reset database password.
- `ALTER ROLE postgres ... PASSWORD` is refused on Supabase: `only superusers can alter privileged roles`. `postgres` isn't a superuser there.
- `scripts/tools/scram_alter_role.py` (#419) works only for roles `postgres` can alter (e.g. `growth_service`, `ci_readonly`), never for `postgres` itself. Note: #419 is still an open PR, so the helper isn't on `main`.

Procedure:
1. Generate the password locally: `python -c "import secrets; print(secrets.token_urlsafe(32))"`, which gives 43 URL-safe characters. Save it to `~/.boi-secrets/prod_db_pw.txt` (single dot).
2. Paste the same value into the dashboard reset and save.
3. The terminal tests it locally with psql, printing nothing, against the session pooler `aws-1-ap-southeast-2.pooler.supabase.com:5432`, user `postgres.<ref>`, `sslmode=require`. **The pooler takes minutes to accept a reset password:** on 29 Sep it was ~11 min between the file write and the first successful connection. Retry every 30 s. Don't conclude the password is wrong before ~15 min.
4. Only after a successful test: `gh secret set MIGRATE_DB_URL --env production-migrations`, with the URI built in-process and the password **percent-encoded** (`urllib.parse.quote(pw, safe='')`). A raw password with URI-special characters breaks the URI.
5. Dispatch a db-migrate **plan** run (Abhinav approves production). Once it connects, delete `prod_db_pw.txt`.

Failure signatures: `password authentication failed for user "postgres"` means the pooler found the project but the password is wrong or not propagated yet. `Tenant or user not found` means the wrong pooler host or region; production is only on `aws-1-ap-southeast-2`.

## GitHub Actions: repository secrets (28, as of 28 Sep 2026, after 5 unused ones were deleted)
| Secret | Used by | Rotation / notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | most pipelines and checks; site build | service key: rotate via Supabase API keys (JWT secret roll changes all). Read through `getSecret()` / `get_secret()` (BOM) |
| `CI_READONLY_DB_URL` | `migration-parity.yml`, `seed-staging.yml` | role `ci_readonly`, read-only: SELECT on `schema_migrations` and, from P12 (#443, migration `20260929200000`), on the 4 public-content tables `sets`, `news_articles`, `reviews`, `guides` (the same rows anon reads; the migration fails if it can read anything else). Rotate with a new locally computed SCRAM verifier plus `gh secret set` (the procedure is in #400) |
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
| `GH_DISPATCH_TOKEN` (GitHub secret, set 27 May 2026) | `brief.yml` (morning brief reads Actions state) | Unrelated to FP5.9: the Worker's dispatcher secret is named `BOI_SCHEDULER_DISPATCH_TOKEN` (P7 item 8) |
| `YOUTUBE_CLIENT_SECRETS` | YouTube upload | OAuth client JSON |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_SITE_URL` | site build | not secret, stored as secrets |
| ~~`ADMIN_PASSWORD`, `GMAIL_APP_PASSWORD`, `GMAIL_USER`, `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`~~ | none | **Deleted 28 Sep 2026** (P8 item 8, `gh secret delete`). They were referenced by no workflow or code. `ADMIN_PASSWORD`'s runtime value still lives in the Cloudflare Worker env, which is unaffected |

## Cloudflare Worker secrets (FP1.1 / FP5.9, PR 1; set by Abhinav, see #263)
| Worker | Secret | Also in GitHub as | Rotation |
|---|---|---|---|
| `boi-scheduler` | `SNAPSHOT_HMAC_KEY` | `SNAPSHOT_HMAC_KEY` (same value) | generate a new one, set both in one step (commands in #263); old signatures stop verifying at once |
| `boi-scheduler` | **`BOI_SCHEDULER_DISPATCH_TOKEN`** (renamed 28 Sep, P7 item 8, so it can't be confused with the old `GH_DISPATCH_TOKEN` repo secret. Fine-grained PAT, this repo, Actions read/write; created 27 Sep with a 90-day expiry, **~26 Dec 2026**; recommend 366 days, plus a calendar reminder) | none | regenerate on GitHub → `npx wrangler secret put BOI_SCHEDULER_DISPATCH_TOKEN --name boi-scheduler` |
| `boi-scheduler-staging` | `SNAPSHOT_HMAC_KEY` (a different value) | `SNAPSHOT_HMAC_KEY_STAGING` | as above. **Held** until the Sydney staging project exists (P5 decision 5) |

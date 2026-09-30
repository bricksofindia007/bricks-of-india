# Approved data fixes (P6 Step 1, #403)

Content and catalogue corrections that were approved in an issue (e.g. #246 review batches). They're applied **only** by `.github/workflows/db-migrate.yml`: staging first, then production behind the `production-migrations` reviewer. Never by hand, never through MCP.

File name: `<issue>-<short-name>.sql`, e.g. `246-batch1.sql`. Header (leading comment lines):

```sql
-- boi:issue 246
-- boi:backup-tables public.reviews
-- boi:expect-before select count(*) from public.reviews where slug in ('a','b') and content not like '%Corrected 28 Sep 2026%' = 2
-- boi:expect-after  select count(*) from public.reviews where slug in ('a','b') and content like '%Corrected 28 Sep 2026%' = 2
update public.reviews set ... where slug = 'a' and content = '...exact old text...';
```

Rules:
- **No BEGIN/COMMIT.** The job runs, in ONE transaction: the before-assert, the file, the after-assert, and the ledger row (`supabase_migrations.data_fix_log`). Any mismatch or error rolls everything back and stops the run.
- **Both assertions are required.** Each is a single-number `select` and the exact expected value.
- Every table the file changes is listed in `boi:backup-tables`. It's copied into the private `boi_backups` schema first (never a workflow artifact: this repo is public). Backups are kept 30 days.
- G16: corrections are made in place with a dated note. Never delete or unpublish published rows.
- **A data fix is rehearsed on seeded staging** (P12, #443). Before an apply run, run **Seed staging** (`seed-staging.yml`). It copies production's `sets`, `news_articles`, `reviews` and `guides` into staging (read as `ci_readonly`), so a fix's `expect-before` counts on staging **must match production**. A before-count that differs on staging means the seed is stale or the fix is wrong. Re-seed, don't edit the count. A fix that names another table needs that table added to the seed allowlist (`scripts/ci/seed-staging.mjs` `TABLES`) first.
- Order when a fix depends on a new migration that production doesn't have yet: apply with `scope=migrations`, seed, then apply with `scope=all`.
- Data-fix files are named `<issue>-<name>.sql`. Any other `.sql` here fails the job's lint (the job used to skip it silently: `is-gwp-fill.sql`, renamed `433-is-gwp-fill.sql`: #433 is where it was approved and is tracked; the evidence comment goes there).
- **Widening a constraint is allowed:** a migration may drop and re-add a constraint (e.g. adding a value to a CHECK) in its single transaction. The rule is that no data or columns are lost, not "additive only" (P12, `20260929060000`).
- **A backup of a table created in the same run is skipped, correctly:** backups run before anything is applied, so a table a pending migration creates (e.g. `set_name_aliases` for fix 287) doesn't exist yet and is logged `backup skipped: … does not exist yet`. There is nothing to lose. The fix's `expect-before` (typically `= 0`) is the guard.

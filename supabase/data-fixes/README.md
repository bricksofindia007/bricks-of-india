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
- Staging must hold the rows a fix touches, or its before-count fails there and production never runs. Content tables are part of the staging seed. **Not true yet (P12, 30 Sep 2026):** staging has 0 `news_articles` rows and no seed tool exists, so #422's before-count failed on staging (apply run 36613512262). Open decision: seed staging's public content tables, or add a staging no-rows mode.
- **Widening a constraint is allowed:** a migration may drop and re-add a constraint (e.g. adding a value to a CHECK) in its single transaction. The rule is that no data or columns are lost, not "additive only" (P12, `20260929060000`).
- **A backup of a table created in the same run is skipped, correctly:** backups run before anything is applied, so a table a pending migration creates (e.g. `set_name_aliases` for fix 287) doesn't exist yet and is logged `backup skipped: … does not exist yet`. There is nothing to lose. The fix's `expect-before` (typically `= 0`) is the guard.

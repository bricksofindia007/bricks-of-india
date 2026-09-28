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
- Staging must hold the rows a fix touches, or its before-count fails there and production never runs. Content tables are part of the staging seed.

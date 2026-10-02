-- boi:issue 403
-- P6 Step 1 (28 Sep 2026): ledger of approved DATA fixes applied by .github/workflows/db-migrate.yml
-- (supabase/data-fixes/<issue>-<name>.sql). Schema migrations stay in schema_migrations; data fixes
-- are recorded here so the job never re-applies one, and every row carries the asserted before/after
-- counts and the file's sha256.
-- Not exposed through the Data API (supabase_migrations is not an exposed schema); ci_readonly can read it.
-- Rollback: DROP TABLE supabase_migrations.data_fix_log;

CREATE TABLE IF NOT EXISTS supabase_migrations.data_fix_log (
  name          text PRIMARY KEY,           -- file name, e.g. 246-batch1.sql
  issue         integer NOT NULL,
  sha256        text NOT NULL,
  before_count  bigint NOT NULL,
  after_count   bigint NOT NULL,
  applied_at    timestamptz NOT NULL DEFAULT now(),
  applied_by    text NOT NULL DEFAULT current_user,
  run_url       text
);
GRANT SELECT ON supabase_migrations.data_fix_log TO ci_readonly;

-- Pre-change backups (P6 Step 1). The repo is PUBLIC, so workflow artifacts are downloadable by
-- any logged-in GitHub user: table backups must never be artifacts. The job copies each table named
-- in a file's `-- boi:backup-tables` header (plus schema_migrations / data_fix_log) into this schema
-- before applying anything. Not exposed by the Data API; no grants to anon/authenticated/service_role.
-- The job prunes tables older than 30 days (listed in the manifest).
CREATE SCHEMA IF NOT EXISTS boi_backups;
REVOKE ALL ON SCHEMA boi_backups FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS boi_backups.manifest (
  backup_table  text PRIMARY KEY,           -- boi_backups."<schema>__<table>__<yyyymmddThhmmss>"
  source_table  text NOT NULL,
  row_count     bigint NOT NULL,
  target        text NOT NULL,              -- staging | production
  reason        text NOT NULL,              -- the migration/data-fix file that asked for it
  created_at    timestamptz NOT NULL DEFAULT now(),
  run_url       text
);
REVOKE ALL ON boi_backups.manifest FROM PUBLIC, anon, authenticated, service_role;

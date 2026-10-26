-- boi:issue 820
-- The backup login (backup_reader) cannot read the boi_backups schema, so the before-fix snapshots are not in the nightly
-- backup. This gives backup_reader usage on the schema, SELECT on its tables (existing and future), and the same read policy
-- where row level security is on. Security tables are not granted (login_attempts and admin_sessions copies, if any).
-- NOT APPLIED: staging rehearsal first; production only in the bundle window.
-- Rollback: supabase/rollbacks/20261026140000_backup_reader_boi_backups.down.sql

GRANT USAGE ON SCHEMA boi_backups TO backup_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA boi_backups TO backup_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA boi_backups GRANT SELECT ON TABLES TO backup_reader;

-- Security tables stay unreadable: take back any SELECT on a copy of them.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
           WHERE schemaname = 'boi_backups'
             AND (tablename LIKE 'login_attempts%' OR tablename LIKE 'admin_sessions%') LOOP
    EXECUTE format('REVOKE ALL ON boi_backups.%I FROM backup_reader', t.tablename);
  END LOOP;
END $$;

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT schemaname, tablename FROM pg_tables
           WHERE schemaname = 'boi_backups' AND rowsecurity LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = t.schemaname AND tablename = t.tablename AND policyname = 'backup_reader read') THEN
      EXECUTE format('CREATE POLICY "backup_reader read" ON %I.%I FOR SELECT TO backup_reader USING (true)', t.schemaname, t.tablename);
    END IF;
  END LOOP;
END $$;

-- Self-check: the backup login holds only SELECT, and only on public, growth and boi_backups tables, none of them security
-- copies. Any extra rolls the whole migration back.
DO $$
DECLARE extra text;
BEGIN
  SELECT string_agg(DISTINCT table_schema || '.' || table_name || ':' || privilege_type, ', ') INTO extra
  FROM information_schema.role_table_grants
  WHERE grantee = 'backup_reader'
    AND (privilege_type <> 'SELECT'
         OR table_schema NOT IN ('public', 'growth', 'boi_backups')
         OR table_name LIKE 'login_attempts%' OR table_name LIKE 'admin_sessions%');
  IF extra IS NOT NULL THEN
    RAISE EXCEPTION 'backup_reader holds more than the intended read access: % -- rolling back', extra;
  END IF;
END $$;

-- Rollback for 20261026140000_backup_reader_boi_backups. Run by hand, in one transaction. Removes only what the migration added.
-- The default privilege is removed first, so tables created later get no grant.
ALTER DEFAULT PRIVILEGES IN SCHEMA boi_backups REVOKE SELECT ON TABLES FROM backup_reader;
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT schemaname, tablename FROM pg_policies
           WHERE schemaname = 'boi_backups' AND policyname = 'backup_reader read' LOOP
    EXECUTE format('DROP POLICY IF EXISTS "backup_reader read" ON %I.%I', t.schemaname, t.tablename);
  END LOOP;
END $$;
REVOKE SELECT ON ALL TABLES IN SCHEMA boi_backups FROM backup_reader;
REVOKE USAGE ON SCHEMA boi_backups FROM backup_reader;

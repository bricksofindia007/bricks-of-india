-- Read access for the backup login to the migration ledger, so the nightly backup can carry it.
-- The backup login (backup_reader) has no USAGE on schema supabase_migrations and no SELECT on its two ledger tables.
-- This adds exactly that: USAGE on the schema and SELECT on schema_migrations and data_fix_log. Nothing else, no other role.
-- NOT APPLIED: staging rehearsal first, then its own only_version run. Not part of the 20261026100000 bundle.
--
-- Rollback: REVOKE SELECT ON supabase_migrations.schema_migrations, supabase_migrations.data_fix_log FROM backup_reader;
--           REVOKE USAGE ON SCHEMA supabase_migrations FROM backup_reader;

GRANT USAGE ON SCHEMA supabase_migrations TO backup_reader;
GRANT SELECT ON supabase_migrations.schema_migrations, supabase_migrations.data_fix_log TO backup_reader;

-- Self-check: the backup login holds nothing new beyond these three grants. Any extra rolls the whole migration back.
DO $$
DECLARE extra text;
BEGIN
  SELECT string_agg(DISTINCT table_schema || '.' || table_name || ':' || privilege_type, ', ') INTO extra
  FROM information_schema.role_table_grants
  WHERE grantee = 'backup_reader'
    AND table_schema = 'supabase_migrations'
    AND NOT (table_name IN ('schema_migrations', 'data_fix_log') AND privilege_type = 'SELECT');
  IF extra IS NOT NULL THEN
    RAISE EXCEPTION 'backup_reader holds more than the intended ledger read: % -- rolling back', extra;
  END IF;
END $$;

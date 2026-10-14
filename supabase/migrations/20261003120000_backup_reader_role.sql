-- boi:issue 272
-- #272: a read-only login for the nightly backup. Needs the owner's approval before it is applied.
--
-- backup_reader can read every table in the public and growth schemas and nothing else: no writes, no
-- auth or storage schemas. Created NOLOGIN with no password. LOGIN and the password are set out of band
-- as a SCRAM-SHA-256 verifier (the plaintext never reaches the server or its DDL log), the same way as
-- ci_readonly. Row-level security stays on for it (NOBYPASSRLS); each table that has RLS gets one
-- SELECT-only policy for this role, so the copy is complete without bypassing RLS.
--
-- Rollback: run the DROP POLICY lines this migration printed (NOTICE), then
--           REVOKE ALL ON ALL TABLES IN SCHEMA public, growth FROM backup_reader;
--           REVOKE ALL ON ALL SEQUENCES IN SCHEMA public, growth FROM backup_reader;
--           REVOKE USAGE ON SCHEMA public, growth FROM backup_reader; DROP ROLE backup_reader;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'backup_reader') THEN
    CREATE ROLE backup_reader NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
  END IF;
END $$;
ALTER ROLE backup_reader SET default_transaction_read_only = on;
ALTER ROLE backup_reader SET statement_timeout = '15min';

GRANT USAGE ON SCHEMA public, growth TO backup_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public, growth TO backup_reader;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public, growth TO backup_reader;

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('public', 'growth') AND rowsecurity LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = t.schemaname AND tablename = t.tablename AND policyname = 'backup_reader read') THEN
      EXECUTE format('CREATE POLICY "backup_reader read" ON %I.%I FOR SELECT TO backup_reader USING (true)', t.schemaname, t.tablename);
      RAISE NOTICE 'rollback: DROP POLICY "backup_reader read" ON %.%;', t.schemaname, t.tablename;
    END IF;
  END LOOP;
END $$;

-- Self-check: nothing but SELECT, only in public and growth. Any extra rolls the whole migration back.
DO $$
DECLARE extra text;
BEGIN
  SELECT string_agg(DISTINCT table_schema || '.' || table_name || ':' || privilege_type, ', ') INTO extra
  FROM information_schema.role_table_grants
  WHERE grantee = 'backup_reader' AND (privilege_type <> 'SELECT' OR table_schema NOT IN ('public', 'growth'));
  IF extra IS NOT NULL THEN
    RAISE EXCEPTION 'backup_reader holds more than SELECT on public/growth: % -- rolling back', extra;
  END IF;
END $$;

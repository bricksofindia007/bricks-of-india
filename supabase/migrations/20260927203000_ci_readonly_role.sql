-- FP2.3 step 6 (P5 Step 4c, 27 Sep 2026): ci_readonly, the role the CI migration-parity
-- check logs in as. It can read supabase_migrations.schema_migrations and nothing else.
--
-- Created NOLOGIN with no password. LOGIN and the password are set out of band, never in
-- a repo file: the password is set as a SCRAM-SHA-256 verifier computed locally, so the
-- plaintext never reaches the server or its DDL statement log (log_statement = ddl). The
-- connection string lives only in the GitHub secret CI_READONLY_DB_URL.
--
-- Applied: staging first, then production (G7 exception #197: psql in one transaction,
-- then recorded in schema_migrations).
-- Rollback: REVOKE ALL ON supabase_migrations.schema_migrations FROM ci_readonly;
--           REVOKE USAGE ON SCHEMA supabase_migrations FROM ci_readonly; DROP ROLE ci_readonly;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ci_readonly') THEN
    CREATE ROLE ci_readonly NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
  END IF;
END $$;

-- Nothing in public/growth/storage: a leaked CI credential reads version numbers only.
REVOKE ALL ON SCHEMA public FROM ci_readonly;
GRANT USAGE ON SCHEMA supabase_migrations TO ci_readonly;
DO $$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON supabase_migrations.schema_migrations TO ci_readonly';
  END IF;
END $$;
ALTER ROLE ci_readonly SET statement_timeout = '10s';
ALTER ROLE ci_readonly SET default_transaction_read_only = on;

DO $$
BEGIN
  IF has_table_privilege('ci_readonly', 'public.sets', 'SELECT')
     OR has_table_privilege('ci_readonly', 'public.newsletter_subscribers', 'SELECT') THEN
    RAISE EXCEPTION 'ci_readonly can read public tables -- rolling back';
  END IF;
END $$;

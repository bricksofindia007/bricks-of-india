-- FP2.3 roles script (draft, P1 Step 7, 27 Sep 2026). Runs BEFORE the baseline.
-- The four growth-engine LOGIN roles as they exist in production (pg_roles, 27 Sep).
-- NO PASSWORDS: set each one out-of-band on the target project
-- (ALTER ROLE <name> PASSWORD '...'), store it in boi-growth-engine's secrets, and
-- never commit it. Staging gets its own passwords, never production's.
-- Object and schema grants to these roles are in the baseline (pg_dump output).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['growth_dashboard','growth_service','growth_subscriber_sync','growth_webhook'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I LOGIN NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOREPLICATION NOBYPASSRLS', r);
    END IF;
  END LOOP;
END $$;

-- growth_service bypasses RLS in production (enable_rls_growth_schema_bypass_for_growth_service).
ALTER ROLE growth_service BYPASSRLS;

-- Production: all four are granted to postgres (so postgres can manage their objects).
GRANT growth_dashboard, growth_service, growth_subscriber_sync, growth_webhook TO postgres;

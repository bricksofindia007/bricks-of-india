-- boi:issue 810
-- The backup login (backup_reader, created 20261003120000) can read every table that existed then. These two were created
-- after that grant (18 Oct) and are not covered: ai_model_usage and usd_inr_rate. This adds SELECT on those two only, with
-- the same read policy the earlier grant uses for row level security. NOT APPLIED: staging rehearsal first; production only
-- in the bundle window.
-- Not granted: login_attempts and admin_sessions. They stay unreadable to the backup login.
--
-- Rollback: supabase/rollbacks/20261026110000_backup_reader_two_tables.down.sql

GRANT SELECT ON public.ai_model_usage, public.usd_inr_rate TO backup_reader;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_model_usage', 'usd_inr_rate'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'backup_reader read') THEN
      EXECUTE format('CREATE POLICY "backup_reader read" ON public.%I FOR SELECT TO backup_reader USING (true)', t);
    END IF;
  END LOOP;
END $$;

-- Self-check: the backup login holds nothing but SELECT on public tables, and none of the two security tables.
-- Any extra rolls the whole migration back.
DO $$
DECLARE extra text;
BEGIN
  SELECT string_agg(DISTINCT table_schema || '.' || table_name || ':' || privilege_type, ', ') INTO extra
  FROM information_schema.role_table_grants
  WHERE grantee = 'backup_reader'
    AND (privilege_type <> 'SELECT' OR table_schema NOT IN ('public', 'growth')
         OR table_name IN ('login_attempts', 'admin_sessions'));
  IF extra IS NOT NULL THEN
    RAISE EXCEPTION 'backup_reader holds more than the intended read access: % -- rolling back', extra;
  END IF;
END $$;

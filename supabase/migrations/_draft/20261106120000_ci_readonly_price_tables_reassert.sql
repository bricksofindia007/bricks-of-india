-- DRAFT, NOT APPLIED (order 0780). Stays in supabase/migrations/_draft/ until Chat and the owner approve it: the
-- migration checks read only the top level of supabase/migrations, so this file is invisible to them until it moves.
-- boi:issue 443
--
-- Re-asserts the read-only seed role's SELECT on public.store_prices and public.price_history, so a rebuilt database
-- gets the same grants the seed (scripts/ci/seed-staging.mjs) needs. The same grants already exist in production through
-- 20261001010000 (price_history) and 20261001200000 (store_prices); this file changes nothing there. It is idempotent:
-- running it on a database that has the grants changes nothing.
--
-- Nothing else is granted. The self-check at the end rolls the whole migration back if ci_readonly holds any public
-- privilege outside SELECT on the six seed tables, or if the read policies are missing.
--
-- Rollback (only if this file was applied and must be undone):
--   DROP POLICY IF EXISTS "ci_readonly seed read" ON public.store_prices;
--   DROP POLICY IF EXISTS "ci_readonly seed read" ON public.price_history;
--   REVOKE SELECT ON public.store_prices, public.price_history FROM ci_readonly;
-- Note: rolling back removes the seed's ability to copy these two tables; the seed then fails loudly, staging keeps its rows.

GRANT USAGE ON SCHEMA public TO ci_readonly;
GRANT SELECT ON public.store_prices, public.price_history TO ci_readonly;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'store_prices' AND policyname = 'ci_readonly seed read') THEN
    CREATE POLICY "ci_readonly seed read" ON public.store_prices FOR SELECT TO ci_readonly USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'price_history' AND policyname = 'ci_readonly seed read') THEN
    CREATE POLICY "ci_readonly seed read" ON public.price_history FOR SELECT TO ci_readonly USING (true);
  END IF;
END $$;

-- Self-check: ci_readonly holds no public privilege beyond SELECT on the six seed tables, and both read policies exist.
DO $$
DECLARE extra text;
BEGIN
  SELECT string_agg(DISTINCT table_name || ':' || privilege_type, ', ') INTO extra
  FROM information_schema.role_table_grants
  WHERE grantee = 'ci_readonly' AND table_schema = 'public'
    AND NOT (table_name IN ('news_articles', 'reviews', 'guides', 'sets', 'price_history', 'store_prices') AND privilege_type = 'SELECT');
  IF extra IS NOT NULL THEN
    RAISE EXCEPTION 'ci_readonly holds public privileges outside SELECT on the seed tables: % -- rolling back', extra;
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname = 'ci_readonly seed read'
        AND tablename IN ('store_prices', 'price_history')) <> 2 THEN
    RAISE EXCEPTION 'ci_readonly seed read policies missing on store_prices or price_history -- rolling back';
  END IF;
END $$;

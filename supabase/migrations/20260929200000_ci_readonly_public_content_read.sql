-- boi:issue 443
-- P12 (29 Sep 2026, Abhinav, option A): the staging content seed (seed-staging.yml) reads production
-- as ci_readonly -- never as postgres / MIGRATE_DB_URL -- so data fixes rehearse on staging rows that
-- match production.
--
-- This deliberately widens ci_readonly (FP2.3, 20260927203000, which asserted it could read no public
-- table) to SELECT on exactly the four public-content tables the seed copies. Nothing wider than
-- anon has: all four are already readable by anon with USING (true) policies, and the site renders
-- their rows. The role stays default_transaction_read_only = on, CONNECTION LIMIT 2, and keeps
-- statement_timeout 10s as its default.
--   news_articles, reviews, guides : truncated and reloaded on staging
--   sets                           : upserted on staging (store_prices / prices / reviews reference it)
-- None of the four has an email, IP address or user-id column (checked against the baseline, P12).
--
-- RLS: the anon policies on news_articles / reviews / sets are TO anon only, so ci_readonly needs its
-- own read policy (guides already has one for every role).
-- The final block fails (and rolls back) if ci_readonly holds SELECT on any other public table.
--
-- Rollback:
--   DROP POLICY "ci_readonly seed read" ON public.news_articles;  (same for reviews, guides, sets)
--   REVOKE SELECT ON public.news_articles, public.reviews, public.guides, public.sets FROM ci_readonly;
--   REVOKE USAGE ON SCHEMA public FROM ci_readonly;

GRANT USAGE ON SCHEMA public TO ci_readonly;
GRANT SELECT ON public.news_articles, public.reviews, public.guides, public.sets TO ci_readonly;

CREATE POLICY "ci_readonly seed read" ON public.news_articles FOR SELECT TO ci_readonly USING (true);
CREATE POLICY "ci_readonly seed read" ON public.reviews FOR SELECT TO ci_readonly USING (true);
CREATE POLICY "ci_readonly seed read" ON public.guides FOR SELECT TO ci_readonly USING (true);
CREATE POLICY "ci_readonly seed read" ON public.sets FOR SELECT TO ci_readonly USING (true);

DO $$
DECLARE extra text;
BEGIN
  SELECT string_agg(DISTINCT table_name, ', ') INTO extra
  FROM information_schema.role_table_grants
  WHERE grantee = 'ci_readonly' AND table_schema = 'public'
    AND table_name NOT IN ('news_articles', 'reviews', 'guides', 'sets');
  IF extra IS NOT NULL THEN
    RAISE EXCEPTION 'ci_readonly holds privileges on public tables outside the seed allowlist: % -- rolling back', extra;
  END IF;
END $$;

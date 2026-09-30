-- boi:issue 451
-- P13 item 5 (30 Sep 2026, Tier 2, approved by Abhinav): ci_readonly may read growth.platform_metrics_daily,
-- and nothing else in the growth schema, so GA4 traffic can be reported without the growth_service
-- credential (#416). The table holds one row per platform per day (GA4: platform='website',
-- views = sessions, reach = activeUsers; ingestion/ga4.py in boi-growth-engine). No personal data:
-- aggregate counts only, plus a raw jsonb of the same API response.
--
-- RLS is on with no policies (growth_service reads it via BYPASSRLS), so ci_readonly needs its own
-- read policy. The role stays read-only (default_transaction_read_only = on), limited to 2
-- connections, with a 10s default timeout.
--
-- The final block fails (and rolls back) if:
--   * ci_readonly holds any privilege in schema growth other than SELECT on platform_metrics_daily;
--   * ci_readonly's public-schema grants reach beyond the 4 seed tables (20260929200000);
--   * anon, authenticated or PUBLIC can use schema growth or read this table.
--
-- Rollback:
--   DROP POLICY "ci_readonly metrics read" ON growth.platform_metrics_daily;
--   REVOKE SELECT ON growth.platform_metrics_daily FROM ci_readonly;
--   REVOKE USAGE ON SCHEMA growth FROM ci_readonly;

GRANT USAGE ON SCHEMA growth TO ci_readonly;
GRANT SELECT ON growth.platform_metrics_daily TO ci_readonly;
CREATE POLICY "ci_readonly metrics read" ON growth.platform_metrics_daily FOR SELECT TO ci_readonly USING (true);

DO $$
DECLARE extra text;
BEGIN
  SELECT string_agg(DISTINCT table_name || ':' || privilege_type, ', ') INTO extra
  FROM information_schema.role_table_grants
  WHERE grantee = 'ci_readonly' AND table_schema = 'growth'
    AND NOT (table_name = 'platform_metrics_daily' AND privilege_type = 'SELECT');
  IF extra IS NOT NULL THEN
    RAISE EXCEPTION 'ci_readonly holds growth privileges beyond SELECT on platform_metrics_daily: % -- rolling back', extra;
  END IF;

  SELECT string_agg(DISTINCT table_name, ', ') INTO extra
  FROM information_schema.role_table_grants
  WHERE grantee = 'ci_readonly' AND table_schema = 'public'
    AND table_name NOT IN ('news_articles', 'reviews', 'guides', 'sets');
  IF extra IS NOT NULL THEN
    RAISE EXCEPTION 'ci_readonly holds public privileges outside the seed allowlist: % -- rolling back', extra;
  END IF;

  IF has_schema_privilege('anon', 'growth', 'USAGE') OR has_schema_privilege('authenticated', 'growth', 'USAGE')
     OR has_table_privilege('anon', 'growth.platform_metrics_daily', 'SELECT')
     OR has_table_privilege('authenticated', 'growth.platform_metrics_daily', 'SELECT') THEN
    RAISE EXCEPTION 'anon/authenticated/PUBLIC can reach growth.platform_metrics_daily -- rolling back';
  END IF;
END $$;

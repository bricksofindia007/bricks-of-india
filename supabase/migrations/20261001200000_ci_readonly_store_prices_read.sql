-- boi:issue 17
-- Catalogue check: read access for the read-only role. Needs the owner's approval before it is applied.
-- The staging seed may READ production store_prices, so the wrong-match purge (17-wrong-store-matches.sql)
-- can be rehearsed on staging against a faithful copy. Same pattern as 20261001010000 (price_history).
--
-- ci_readonly stays read-only (default_transaction_read_only = on, statement_timeout, NOBYPASSRLS).
-- It gains SELECT on public.store_prices only. The table holds set ids, store ids, prices, stock flags,
-- product URLs and timestamps: no email, IP address or user id.
--
-- Rollback: DROP POLICY "ci_readonly seed read" ON public.store_prices;
--           REVOKE SELECT ON public.store_prices FROM ci_readonly;

GRANT SELECT ON public.store_prices TO ci_readonly;
CREATE POLICY "ci_readonly seed read" ON public.store_prices FOR SELECT TO ci_readonly USING (true);

DO $$
DECLARE extra text;
BEGIN
  SELECT string_agg(DISTINCT table_name || ':' || privilege_type, ', ') INTO extra
  FROM information_schema.role_table_grants
  WHERE grantee = 'ci_readonly' AND table_schema = 'public'
    AND NOT (table_name IN ('news_articles', 'reviews', 'guides', 'sets', 'price_history', 'store_prices') AND privilege_type = 'SELECT');
  IF extra IS NOT NULL THEN
    RAISE EXCEPTION 'ci_readonly holds public privileges outside SELECT on the seed allowlist: % -- rolling back', extra;
  END IF;
END $$;

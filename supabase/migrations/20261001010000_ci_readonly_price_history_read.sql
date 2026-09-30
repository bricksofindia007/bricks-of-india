-- boi:issue 450
-- #450 (P14 round 4 item 6, Tier 2 APPROVED by Abhinav, 1 Oct 2026): the staging seed may READ
-- production price_history, so the lego.in false-out-of-stock history fix (816 + 775 rows) can be
-- rehearsed on staging against a faithful copy.
--
-- ci_readonly stays read-only (default_transaction_read_only = on, statement_timeout, NOBYPASSRLS).
-- It gains SELECT on public.price_history only; nothing else. price_history already has permissive
-- read policies for every role ("allow_public_read_price_history" USING (true)); the explicit
-- "ci_readonly seed read" policy below matches the pattern of 20260929200000, so the grant does not
-- depend on the public policy staying.
--
-- The table holds set ids, store ids, prices, stock flags and timestamps only: no email, IP address or
-- user id (checked against the baseline, 20260927140000:1837-1844).
--
-- Rollback: DROP POLICY "ci_readonly seed read" ON public.price_history;
--           REVOKE SELECT ON public.price_history FROM ci_readonly;

GRANT SELECT ON public.price_history TO ci_readonly;
CREATE POLICY "ci_readonly seed read" ON public.price_history FOR SELECT TO ci_readonly USING (true);

-- Self-check: ci_readonly holds no public privilege beyond the seed allowlist, and on price_history
-- nothing but SELECT. Any extra rolls the whole migration back.
DO $$
DECLARE extra text;
BEGIN
  SELECT string_agg(DISTINCT table_name || ':' || privilege_type, ', ') INTO extra
  FROM information_schema.role_table_grants
  WHERE grantee = 'ci_readonly' AND table_schema = 'public'
    AND NOT (table_name IN ('news_articles', 'reviews', 'guides', 'sets', 'price_history') AND privilege_type = 'SELECT');
  IF extra IS NOT NULL THEN
    RAISE EXCEPTION 'ci_readonly holds public privileges outside SELECT on the seed allowlist: % -- rolling back', extra;
  END IF;
END $$;

-- Batch write of the US price column, one call per batch. Used by scripts/populate-mrp.js.
-- Narrow on purpose: only us_price_usd, keyed by set_number. A row with no set_number is skipped.
-- sets_bulk_patch (lego_mrp_inr and retirement_date) is unchanged. SECURITY INVOKER, service_role only.
--
--   select public.sets_bulk_us_price('[{"set_number":"10332","us_price_usd":199.99}]');

CREATE OR REPLACE FUNCTION public.sets_bulk_us_price(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.sets s SET
    us_price_usd = (x.r->>'us_price_usd')::numeric
  FROM (SELECT r FROM jsonb_array_elements(p_rows) AS r WHERE r ? 'set_number' AND r ? 'us_price_usd') AS x
  WHERE s.set_number = x.r->>'set_number';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

COMMENT ON FUNCTION public.sets_bulk_us_price(jsonb) IS
  'Batch us_price_usd updates keyed by set_number. Used by scripts/populate-mrp.js. See migration 20261018120100.';

REVOKE ALL ON FUNCTION public.sets_bulk_us_price(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sets_bulk_us_price(jsonb) TO service_role;

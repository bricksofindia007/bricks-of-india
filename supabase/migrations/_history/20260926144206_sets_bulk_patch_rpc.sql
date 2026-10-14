-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260926144206, name sets_bulk_patch_rpc, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

CREATE OR REPLACE FUNCTION public.sets_bulk_patch(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  n_id integer;
  n_num integer;
BEGIN
  UPDATE public.sets s SET
    lego_mrp_inr    = CASE WHEN x.r ? 'lego_mrp_inr'    THEN (x.r->>'lego_mrp_inr')::integer ELSE s.lego_mrp_inr END,
    retirement_date = CASE WHEN x.r ? 'retirement_date' THEN (x.r->>'retirement_date')::date   ELSE s.retirement_date END
  FROM (SELECT r FROM jsonb_array_elements(p_rows) AS r WHERE r ? 'id') AS x
  WHERE s.id = (x.r->>'id')::uuid;
  GET DIAGNOSTICS n_id = ROW_COUNT;

  UPDATE public.sets s SET
    lego_mrp_inr    = CASE WHEN x.r ? 'lego_mrp_inr'    THEN (x.r->>'lego_mrp_inr')::integer ELSE s.lego_mrp_inr END,
    retirement_date = CASE WHEN x.r ? 'retirement_date' THEN (x.r->>'retirement_date')::date   ELSE s.retirement_date END
  FROM (SELECT r FROM jsonb_array_elements(p_rows) AS r WHERE NOT (r ? 'id') AND r ? 'set_number') AS x
  WHERE s.set_number = x.r->>'set_number';
  GET DIAGNOSTICS n_num = ROW_COUNT;

  RETURN n_id + n_num;
END;
$$;

COMMENT ON FUNCTION public.sets_bulk_patch(jsonb) IS
  'Batch lego_mrp_inr (by id) / retirement_date (by set_number) updates in one call. Used by scripts/populate-mrp.js. See migration 20260926040000.';

REVOKE ALL ON FUNCTION public.sets_bulk_patch(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sets_bulk_patch(jsonb) TO service_role;

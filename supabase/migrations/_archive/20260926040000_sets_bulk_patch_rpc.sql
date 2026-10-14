-- Fix B (2026-09-26): batch per-row catalogue writes.
--
-- populate-mrp.yml (weekly, Monday 02:00 UTC) updated sets one row per API
-- request: lego_mrp_inr by id, then retirement_date by set_number -- ~6,700
-- PATCH requests in one run (seen 2026-09-20). Each request writes a ~2.5 KB
-- Supabase gateway log line and log ingest is over the Free quota. PostgREST
-- cannot send per-row values in one PATCH, and an upsert would trip sets'
-- NOT NULL columns, so this function applies a JSON array of updates in one
-- statement per key type.
--
-- Deliberately narrow: only lego_mrp_inr (rows keyed by "id") and
-- retirement_date (rows keyed by "set_number") can be written. A key absent
-- from a row leaves that column unchanged. SECURITY INVOKER, EXECUTE for
-- service_role only. Projected DB size impact: 0 bytes (catalog entry only).
--
--   select public.sets_bulk_patch('[{"id":"…","lego_mrp_inr":12999},
--                                   {"set_number":"10332","retirement_date":"2026-12-31"}]');

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

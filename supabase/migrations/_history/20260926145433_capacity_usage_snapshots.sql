-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260926145433, name capacity_usage_snapshots, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

CREATE TABLE IF NOT EXISTS public.capacity_usage_snapshots (
  taken_at    timestamptz PRIMARY KEY DEFAULT now(),
  api_calls   bigint      NOT NULL,
  stats_reset timestamptz
);

ALTER TABLE public.capacity_usage_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.capacity_usage_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.capacity_usage_snapshots TO service_role;

CREATE OR REPLACE FUNCTION public.capacity_snapshot(p_days integer DEFAULT 40)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_calls bigint;
  v_reset timestamptz;
BEGIN
  SELECT coalesce(sum(s.calls), 0) INTO v_calls
  FROM extensions.pg_stat_statements s
  JOIN pg_roles r ON r.oid = s.userid
  WHERE r.rolname IN ('anon', 'authenticated', 'service_role');

  SELECT stats_reset INTO v_reset FROM extensions.pg_stat_statements_info;

  INSERT INTO public.capacity_usage_snapshots (taken_at, api_calls, stats_reset)
  VALUES (now(), v_calls, v_reset)
  ON CONFLICT (taken_at) DO NOTHING;

  DELETE FROM public.capacity_usage_snapshots WHERE taken_at < now() - interval '100 days';

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('taken_at', taken_at, 'api_calls', api_calls, 'stats_reset', stats_reset) ORDER BY taken_at)
    FROM public.capacity_usage_snapshots
    WHERE taken_at >= now() - make_interval(days => p_days)
  ), '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.capacity_snapshot(integer) IS
  'Snapshot API-role pg_stat_statements calls for the capacity guard (health-check.mjs Check 11). See migration 20260926050000.';

REVOKE ALL ON FUNCTION public.capacity_snapshot(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capacity_snapshot(integer) TO service_role;

INSERT INTO public.capacity_usage_snapshots (taken_at, api_calls, stats_reset)
SELECT timestamptz '2026-09-11 00:00:00+00',
       greatest(0, (SELECT coalesce(sum(s.calls), 0)
                    FROM extensions.pg_stat_statements s JOIN pg_roles r ON r.oid = s.userid
                    WHERE r.rolname IN ('anon', 'authenticated', 'service_role')) - round(740379 * 2.25)::bigint),
       NULL
WHERE now() < timestamptz '2026-10-11 00:00:00+00'
ON CONFLICT (taken_at) DO NOTHING;

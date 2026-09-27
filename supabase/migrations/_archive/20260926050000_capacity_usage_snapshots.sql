-- Capacity guard (2026-09-26): month-to-date estimates of Supabase egress and
-- log ingest, with zero cost and no new tokens.
--
-- The Free plan's binding quotas are now egress (5 GB) and log ingest (1 GB
-- on the dashboard). Both scale with API request count: calibrated against
-- the 2026-09-11..26 cycle (~740k API-gateway requests vs the dashboard's
-- 2.05 GB egress / 1.73 GB log ingest) at ~2,770 B egress and ~2,340 B log
-- per request. Usage APIs need a Management API token, which this project
-- deliberately does not have, so the request count comes from inside the
-- database instead: pg_stat_statements calls by the API roles (anon,
-- authenticated, service_role), ~2.25 calls per gateway request (measured
-- 2026-09-26 against edge logs). The nightly health check snapshots that
-- counter; scripts/health-check.mjs Check 11 turns the deltas since the
-- billing-cycle start into estimates and alerts at 70% / 85% of quota.
--
-- Size: one row per health-check run (~30 per cycle, pruned after 100 days),
-- well under 1 KB a month.

CREATE TABLE IF NOT EXISTS public.capacity_usage_snapshots (
  taken_at    timestamptz PRIMARY KEY DEFAULT now(),
  api_calls   bigint      NOT NULL,
  stats_reset timestamptz
);

ALTER TABLE public.capacity_usage_snapshots ENABLE ROW LEVEL SECURITY;
-- No policies: service_role (which bypasses RLS) is the only reader/writer.
REVOKE ALL ON public.capacity_usage_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.capacity_usage_snapshots TO service_role;

-- Takes a snapshot of the API-role call counter and returns every snapshot
-- from the last p_days days (oldest first) for Check 11 to difference.
-- SECURITY DEFINER because reading pg_stat_statements needs pg_read_all_stats,
-- which service_role does not have; the function exposes only one summed
-- counter, never statement text.
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

-- One-time seed for the 2026-09-11 cycle: a baseline at the cycle start,
-- back-computed from the measured 740,379 API-gateway requests between
-- 2026-09-11 00:00 and 2026-09-26 ~15:00 UTC (edge logs) x 2.25 calls per
-- request. Without it the first estimates would extrapolate the post-fix
-- request rate over the heavier early-cycle days and read low. Only applied
-- while that cycle is running; a later replay of this migration skips it.
INSERT INTO public.capacity_usage_snapshots (taken_at, api_calls, stats_reset)
SELECT timestamptz '2026-09-11 00:00:00+00',
       greatest(0, (SELECT coalesce(sum(s.calls), 0)
                    FROM extensions.pg_stat_statements s JOIN pg_roles r ON r.oid = s.userid
                    WHERE r.rolname IN ('anon', 'authenticated', 'service_role')) - round(740379 * 2.25)::bigint),
       NULL
WHERE now() < timestamptz '2026-10-11 00:00:00+00'
ON CONFLICT (taken_at) DO NOTHING;

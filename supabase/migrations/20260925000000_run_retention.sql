-- Weekly data retention (DB-size issue, 2026-09-25). Keeps the Free-plan
-- database flat (500 MB read-only limit) by applying, every week, the same
-- rules the one-time 2026-09-25 trim applied. Called by
-- scripts/retention-cleanup.mjs (.github/workflows/retention-cleanup.yml)
-- via supabase.rpc('run_retention'). Plain DELETE/UPDATE only -- autovacuum
-- reclaims the space for reuse; no VACUUM FULL here.
--
-- Rules (each verified against every reader of the table -- see
-- BOI_MASTER_TRACKER.md 2026-09-25 entry):
--   price_history   rows older than p_days kept only if first/last in their
--                   (set_id, store_id) series or the price differs from the
--                   previous or next row (exact chart/lookup shape preserved)
--   raw_signals     body/raw_payload NULLed on rows older than p_days; rows,
--                   url_hash and title_hash kept (dedup intact)
--   content_image_registry  only the latest checked_at row per
--                   (article_slug, section, image_url) kept
--   content_quality_issues_archive  rows resolved more than p_archive_days ago
--                   deleted (no reader)
-- content_quality_issues itself stays in retention-cleanup.mjs (archive,
-- then delete, skipping rows content_fix_log references).
--
-- No table schema changes. Execute: service_role only.

CREATE OR REPLACE FUNCTION public.run_retention(
  p_days integer DEFAULT 30,
  p_archive_days integer DEFAULT 90,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cutoff  timestamptz := now() - make_interval(days => p_days);
  acutoff timestamptz := now() - make_interval(days => p_archive_days);
  n_ph  bigint;
  n_rs  bigint;
  n_cir bigint;
  n_arc bigint;
BEGIN
  IF p_days < 30 OR p_archive_days < 90 THEN
    RAISE EXCEPTION 'run_retention: refusing p_days=% p_archive_days=% (minimums 30/90)', p_days, p_archive_days;
  END IF;

  IF p_dry_run THEN
    SELECT count(*) INTO n_ph FROM (
      SELECT recorded_at, price_inr,
             lag(price_inr)  OVER w AS prev_p, lead(price_inr) OVER w AS next_p,
             row_number() OVER w AS rn, count(*) OVER (PARTITION BY set_id, store_id) AS cnt
      FROM price_history
      WINDOW w AS (PARTITION BY set_id, store_id ORDER BY recorded_at, id)
    ) o
    WHERE o.recorded_at < cutoff AND o.rn > 1 AND o.rn < o.cnt
      AND o.prev_p IS NOT DISTINCT FROM o.price_inr AND o.next_p IS NOT DISTINCT FROM o.price_inr;
    SELECT count(*) INTO n_rs FROM raw_signals
      WHERE created_at < cutoff AND (body IS NOT NULL OR raw_payload IS NOT NULL);
    SELECT count(*) INTO n_cir FROM (
      SELECT row_number() OVER (PARTITION BY article_slug, section, image_url ORDER BY checked_at DESC, id DESC) AS rn
      FROM content_image_registry
    ) r WHERE r.rn > 1;
    SELECT count(*) INTO n_arc FROM content_quality_issues_archive WHERE resolved_at < acutoff;
  ELSE
    WITH o AS (
      SELECT id, recorded_at, price_inr,
             lag(price_inr)  OVER w AS prev_p, lead(price_inr) OVER w AS next_p,
             row_number() OVER w AS rn, count(*) OVER (PARTITION BY set_id, store_id) AS cnt
      FROM price_history
      WINDOW w AS (PARTITION BY set_id, store_id ORDER BY recorded_at, id)
    )
    DELETE FROM price_history ph USING o
    WHERE ph.id = o.id AND o.recorded_at < cutoff AND o.rn > 1 AND o.rn < o.cnt
      AND o.prev_p IS NOT DISTINCT FROM o.price_inr AND o.next_p IS NOT DISTINCT FROM o.price_inr;
    GET DIAGNOSTICS n_ph = ROW_COUNT;

    UPDATE raw_signals SET body = NULL, raw_payload = NULL
    WHERE created_at < cutoff AND (body IS NOT NULL OR raw_payload IS NOT NULL);
    GET DIAGNOSTICS n_rs = ROW_COUNT;

    WITH r AS (
      SELECT id, row_number() OVER (PARTITION BY article_slug, section, image_url
                                    ORDER BY checked_at DESC, id DESC) AS rn
      FROM content_image_registry
    )
    DELETE FROM content_image_registry c USING r WHERE c.id = r.id AND r.rn > 1;
    GET DIAGNOSTICS n_cir = ROW_COUNT;

    DELETE FROM content_quality_issues_archive WHERE resolved_at < acutoff;
    GET DIAGNOSTICS n_arc = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run, 'cutoff', cutoff, 'archive_cutoff', acutoff,
    'price_history_deleted', n_ph, 'raw_signals_nulled', n_rs,
    'content_image_registry_deleted', n_cir, 'content_quality_issues_archive_deleted', n_arc,
    'db_size_mb', round(pg_database_size(current_database()) / 1048576.0, 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_retention(integer, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_retention(integer, integer, boolean) TO service_role;

-- Health-check helper: database size and Storage bucket totals, read by
-- scripts/health-check.mjs (warn/critical thresholds live there).
CREATE OR REPLACE FUNCTION public.db_usage_report()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT jsonb_build_object(
    'db_size_mb', round(pg_database_size(current_database()) / 1048576.0, 1),
    'storage_mb', (SELECT round(coalesce(sum((metadata->>'size')::bigint), 0) / 1048576.0, 1) FROM storage.objects),
    'storage_by_bucket', (SELECT coalesce(jsonb_object_agg(bucket_id, mb), '{}'::jsonb) FROM (
        SELECT bucket_id, round(sum((metadata->>'size')::bigint) / 1048576.0, 1) AS mb
        FROM storage.objects GROUP BY bucket_id) b)
  );
$$;

REVOKE ALL ON FUNCTION public.db_usage_report() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.db_usage_report() TO service_role;

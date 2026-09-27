-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260925053215, name run_retention, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Repo file: supabase/migrations/20260925000000_run_retention.sql (DB-size issue, 2026-09-25)
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

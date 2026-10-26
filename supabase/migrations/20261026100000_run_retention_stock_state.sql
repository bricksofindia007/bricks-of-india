-- boi:issue 808
-- Keeps a price row when its stock state differs from a neighbour's. Before this change, a row was removed when its price
-- matched both neighbours, whatever its stock state. NOT APPLIED: staging rehearsal first; production only in the bundle window.
-- Rollback: supabase/rollbacks/20261026100000_run_retention_stock_state.down.sql (restores the earlier function body).
-- Signature, owner, grants and settings are unchanged: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.run_retention(p_days integer DEFAULT 30, p_archive_days integer DEFAULT 90, p_dry_run boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    SET statement_timeout TO '55s'
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
      SELECT recorded_at, price_inr, in_stock,
             lag(price_inr)  OVER w AS prev_p, lead(price_inr) OVER w AS next_p,
             lag(in_stock)   OVER w AS prev_s, lead(in_stock)  OVER w AS next_s,
             row_number() OVER w AS rn, count(*) OVER (PARTITION BY set_id, store_id) AS cnt
      FROM price_history
      WINDOW w AS (PARTITION BY set_id, store_id ORDER BY recorded_at, id)
    ) o
    WHERE o.recorded_at < cutoff AND o.rn > 1 AND o.rn < o.cnt
      AND o.prev_p IS NOT DISTINCT FROM o.price_inr AND o.next_p IS NOT DISTINCT FROM o.price_inr
      AND o.prev_s IS NOT DISTINCT FROM o.in_stock  AND o.next_s IS NOT DISTINCT FROM o.in_stock;
    SELECT count(*) INTO n_rs FROM raw_signals
      WHERE created_at < cutoff AND (body IS NOT NULL OR raw_payload IS NOT NULL);
    SELECT count(*) INTO n_cir FROM (
      SELECT row_number() OVER (PARTITION BY article_slug, section, image_url ORDER BY checked_at DESC, id DESC) AS rn
      FROM content_image_registry
    ) r WHERE r.rn > 1;
    SELECT count(*) INTO n_arc FROM content_quality_issues_archive WHERE resolved_at < acutoff;
  ELSE
    WITH o AS (
      SELECT id, recorded_at, price_inr, in_stock,
             lag(price_inr)  OVER w AS prev_p, lead(price_inr) OVER w AS next_p,
             lag(in_stock)   OVER w AS prev_s, lead(in_stock)  OVER w AS next_s,
             row_number() OVER w AS rn, count(*) OVER (PARTITION BY set_id, store_id) AS cnt
      FROM price_history
      WINDOW w AS (PARTITION BY set_id, store_id ORDER BY recorded_at, id)
    )
    DELETE FROM price_history ph USING o
    WHERE ph.id = o.id AND o.recorded_at < cutoff AND o.rn > 1 AND o.rn < o.cnt
      AND o.prev_p IS NOT DISTINCT FROM o.price_inr AND o.next_p IS NOT DISTINCT FROM o.price_inr
      AND o.prev_s IS NOT DISTINCT FROM o.in_stock  AND o.next_s IS NOT DISTINCT FROM o.in_stock;
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

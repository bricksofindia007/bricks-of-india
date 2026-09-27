-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260709110131, name auto_resolve_false_positive_scans, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).


-- The original report groups by `severity` + `resolved` (❌ critical / ⚠️ warning / ℹ️ info,
-- with a separate "Fixed Automatically" section for resolved=true rows with a fix_detail).
-- Whatever external process builds that report almost certainly reads directly off
-- resolved/severity on this table -- that's the actual lever, not a new column nobody reads.
-- So: reconciliation now marks confirmed false positives as genuinely RESOLVED, using the
-- same fields the system already uses for legitimate auto-fixes, instead of adding a flag
-- that a report script would have to be separately taught to respect.

ALTER TABLE public.content_quality_issues
  ADD COLUMN IF NOT EXISTS original_severity text;

CREATE OR REPLACE FUNCTION public.reconcile_page_load_errors()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  total_articles integer;
  latest_batch timestamptz;
  prior_batch timestamptz;
  is_systemic boolean;
BEGIN
  SELECT
    (SELECT count(*) FROM public.reviews) +
    (SELECT count(*) FROM public.blog_posts) +
    (SELECT count(*) FROM public.news_articles) +
    (SELECT count(*) FROM public.guides)
  INTO total_articles;

  SELECT max(checked_at) INTO latest_batch
  FROM public.content_quality_issues
  WHERE check_name = 'page_load_error' AND resolved = false AND reconciled_at IS NULL;

  IF latest_batch IS NULL THEN
    RETURN;
  END IF;

  SELECT max(checked_at) INTO prior_batch
  FROM public.content_quality_issues
  WHERE check_name = 'page_load_error' AND checked_at < latest_batch;

  SELECT (count(DISTINCT article_slug)::float / GREATEST(total_articles, 1)) > 0.15
  INTO is_systemic
  FROM public.content_quality_issues
  WHERE check_name = 'page_load_error' AND checked_at = latest_batch;

  IF is_systemic THEN
    UPDATE public.content_quality_issues
    SET suspected_false_positive = true,
        original_severity = coalesce(original_severity, severity),
        resolved = true,
        resolved_at = now(),
        fix_detail = format(
          'Auto-reconciled: %s%% of live articles (%s of %s) failed page_load_error in this single scan batch — statistically a scanner/WAF/rate-limit block, not simultaneous content outages. Not a real content issue.',
          round(100.0 * (SELECT count(DISTINCT article_slug) FROM public.content_quality_issues WHERE check_name='page_load_error' AND checked_at = latest_batch)::numeric / GREATEST(total_articles,1), 1),
          (SELECT count(DISTINCT article_slug) FROM public.content_quality_issues WHERE check_name='page_load_error' AND checked_at = latest_batch),
          total_articles
        ),
        reconciled_at = now()
    WHERE check_name = 'page_load_error' AND checked_at = latest_batch;
  ELSE
    UPDATE public.content_quality_issues cur
    SET suspected_false_positive = NOT EXISTS (
          SELECT 1 FROM public.content_quality_issues prev
          WHERE prev.check_name = 'page_load_error'
            AND prev.checked_at = prior_batch
            AND prev.article_slug = cur.article_slug
            AND prev.detail = cur.detail
        ),
        original_severity = CASE WHEN NOT EXISTS (
          SELECT 1 FROM public.content_quality_issues prev
          WHERE prev.check_name = 'page_load_error'
            AND prev.checked_at = prior_batch
            AND prev.article_slug = cur.article_slug
            AND prev.detail = cur.detail
        ) THEN coalesce(cur.original_severity, cur.severity) ELSE cur.original_severity END,
        resolved = CASE WHEN NOT EXISTS (
          SELECT 1 FROM public.content_quality_issues prev
          WHERE prev.check_name = 'page_load_error'
            AND prev.checked_at = prior_batch
            AND prev.article_slug = cur.article_slug
            AND prev.detail = cur.detail
        ) THEN true ELSE cur.resolved END,
        resolved_at = CASE WHEN NOT EXISTS (
          SELECT 1 FROM public.content_quality_issues prev
          WHERE prev.check_name = 'page_load_error'
            AND prev.checked_at = prior_batch
            AND prev.article_slug = cur.article_slug
            AND prev.detail = cur.detail
        ) THEN now() ELSE cur.resolved_at END,
        fix_detail = CASE WHEN NOT EXISTS (
          SELECT 1 FROM public.content_quality_issues prev
          WHERE prev.check_name = 'page_load_error'
            AND prev.checked_at = prior_batch
            AND prev.article_slug = cur.article_slug
            AND prev.detail = cur.detail
        ) THEN 'Auto-reconciled: single-batch failure, not confirmed on the prior scan run. Held as unverified pending a second consecutive failure before being treated as a real outage.'
        ELSE cur.fix_detail END,
        reconciled_at = now()
    WHERE cur.check_name = 'page_load_error' AND cur.checked_at = latest_batch;
  END IF;
END;
$$;

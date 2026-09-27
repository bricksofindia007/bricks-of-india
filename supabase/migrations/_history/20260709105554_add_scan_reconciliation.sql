-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260709105554, name add_scan_reconciliation, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).


-- 1. Track whether an issue is a suspected false positive from a bad scan run,
--    without deleting or hiding the underlying facts.
ALTER TABLE public.content_quality_issues
  ADD COLUMN IF NOT EXISTS suspected_false_positive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;

-- 2. A real, queryable view of scan health per batch (batch = checked_at timestamp).
--    Denominator = actual published article count at time of query (scales automatically
--    as reviews/blog_posts/news_articles/guides grow — no hardcoded numbers).
CREATE OR REPLACE VIEW public.v_scan_batch_health AS
WITH total_articles AS (
  SELECT
    (SELECT count(*) FROM public.reviews) +
    (SELECT count(*) FROM public.blog_posts) +
    (SELECT count(*) FROM public.news_articles) +
    (SELECT count(*) FROM public.guides) AS n
),
batches AS (
  SELECT
    checked_at,
    count(*) AS issue_rows,
    count(DISTINCT article_slug) AS distinct_articles_failed
  FROM public.content_quality_issues
  WHERE check_name = 'page_load_error'
  GROUP BY checked_at
)
SELECT
  b.checked_at,
  b.issue_rows,
  b.distinct_articles_failed,
  t.n AS total_articles_live,
  round(100.0 * b.distinct_articles_failed / GREATEST(t.n, 1), 1) AS pct_articles_failed,
  (b.distinct_articles_failed::float / GREATEST(t.n, 1)) > 0.15 AS systemic_failure_suspected
FROM batches b, total_articles t
ORDER BY b.checked_at DESC;

-- 3. Reconciliation function. Run after every scan batch (via pg_cron below).
--    Logic, based on observed facts (not cosmetic thresholds pulled from nowhere):
--    a) SYSTEMIC: if >15% of all live articles failed page_load_error in the same
--       checked_at batch, that's a scanner/WAF/rate-limit problem, not 300 simultaneous
--       content outages. Mark the whole batch suspected_false_positive.
--    b) PERSISTENCE: for non-systemic batches, a page_load_error is only trusted as
--       real once the SAME article_slug+detail fails in two consecutive scan batches.
--       A single-batch blip (transient timeout/block) gets marked suspected pending
--       confirmation on the next run, not blasted as critical immediately.
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
    RETURN; -- nothing new to reconcile
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
    SET suspected_false_positive = true, reconciled_at = now()
    WHERE check_name = 'page_load_error' AND checked_at = latest_batch;
  ELSE
    -- Trust only slugs that also failed in the immediately preceding batch.
    UPDATE public.content_quality_issues cur
    SET suspected_false_positive = NOT EXISTS (
          SELECT 1 FROM public.content_quality_issues prev
          WHERE prev.check_name = 'page_load_error'
            AND prev.checked_at = prior_batch
            AND prev.article_slug = cur.article_slug
            AND prev.detail = cur.detail
        ),
        reconciled_at = now()
    WHERE cur.check_name = 'page_load_error' AND cur.checked_at = latest_batch;
  END IF;
END;
$$;

-- 4. Schedule it to run automatically, hourly, so every batch gets reconciled
--    shortly after it lands — no dependency on knowing the external scanner's
--    exact cron time.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'reconcile-page-load-errors-hourly',
  '15 * * * *',
  $$SELECT public.reconcile_page_load_errors();$$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reconcile-page-load-errors-hourly'
);

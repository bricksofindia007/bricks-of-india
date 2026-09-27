-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260709111406, name create_image_repair_queue, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).


CREATE TABLE IF NOT EXISTS public.image_repair_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_slug text NOT NULL,
  section text NOT NULL DEFAULT 'news_articles',
  current_hero_image text,
  recovered_candidate_url text,
  recovery_method text,
  verified boolean NOT NULL DEFAULT false,
  verified_status_code integer,
  applied boolean NOT NULL DEFAULT false,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(article_slug)
);

INSERT INTO public.image_repair_queue (article_slug, section, current_hero_image, recovered_candidate_url, recovery_method)
WITH fb AS (
  SELECT slug, hero_image FROM public.news_articles WHERE hero_image ILIKE '%fallback-hero%'
),
pd AS (
  SELECT pd.published_url, pd.source_url, fb.slug, fb.hero_image
  FROM public.pending_drafts pd
  JOIN fb ON pd.published_url ILIKE '%' || fb.slug
),
recov AS (
  SELECT DISTINCT ON (pd.slug) pd.slug, pd.hero_image,
    COALESCE(
      (regexp_match(rs.raw_payload->>'content:encoded', '<img[^>]+src="([^"]+)"'))[1],
      (regexp_match(rs.raw_payload->>'content', '<img[^>]+src="([^"]+)"'))[1]
    ) AS recovered_img
  FROM pd JOIN public.raw_signals rs ON rs.url = pd.source_url
  ORDER BY pd.slug
)
SELECT fb.slug, 'news_articles', fb.hero_image, recov.recovered_img,
  CASE WHEN recov.recovered_img IS NOT NULL THEN 'recovered_from_source_rss' ELSE 'unrecoverable_needs_manual_source' END
FROM fb
LEFT JOIN recov ON recov.slug = fb.slug
ON CONFLICT (article_slug) DO NOTHING;

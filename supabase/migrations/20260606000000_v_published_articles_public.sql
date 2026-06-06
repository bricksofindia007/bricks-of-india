-- Read-only view for author page and future public-facing queries.
-- Exposes only published articles; excludes pending_drafts entirely.
-- security_invoker = true: view runs as the calling role, not the owner,
--   so RLS on the underlying tables applies even to the view caller.
-- Grants: SELECT to anon role only.
--
-- Note: neither news_articles nor blog_posts has an updated_at column
--   (schema confirmed 2026-06-06). Using NULL::timestamptz as updated_at;
--   update if a tracking column is added to the tables later.

CREATE OR REPLACE VIEW v_published_articles_public
  WITH (security_invoker = true) AS
  SELECT
    id,
    slug,
    title,
    excerpt           AS lede,
    published_at,
    NULL::timestamptz AS updated_at,
    'news'::text      AS route_type
  FROM news_articles
  WHERE published_at IS NOT NULL

  UNION ALL

  SELECT
    id,
    slug,
    title,
    excerpt           AS lede,
    published_at,
    NULL::timestamptz AS updated_at,
    CASE WHEN category = 'Opinion' THEN 'opinion'::text ELSE 'blog'::text END AS route_type
  FROM blog_posts
  WHERE published_at IS NOT NULL;

GRANT SELECT ON v_published_articles_public TO anon;
REVOKE INSERT, UPDATE, DELETE ON v_published_articles_public FROM PUBLIC;

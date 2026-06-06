-- Read-only view for author page and future public-facing queries.
-- Exposes only published articles; excludes pending_drafts entirely.
-- Grants SELECT to anon role; no write access.

DROP VIEW IF EXISTS v_published_articles_public;

CREATE VIEW v_published_articles_public AS
  SELECT
    id,
    slug,
    title,
    excerpt   AS lede,
    published_at,
    updated_at,
    'news'    AS route_type
  FROM news_articles
  WHERE published_at IS NOT NULL

  UNION ALL

  SELECT
    id,
    slug,
    title,
    excerpt   AS lede,
    published_at,
    updated_at,
    'blog'    AS route_type
  FROM blog_posts
  WHERE published_at IS NOT NULL
    AND category != 'Opinion'

  UNION ALL

  SELECT
    id,
    slug,
    title,
    excerpt   AS lede,
    published_at,
    updated_at,
    'opinion' AS route_type
  FROM blog_posts
  WHERE published_at IS NOT NULL
    AND category = 'Opinion';

-- Grant read-only access to anonymous role
GRANT SELECT ON v_published_articles_public TO anon;
REVOKE INSERT, UPDATE, DELETE ON v_published_articles_public FROM anon;

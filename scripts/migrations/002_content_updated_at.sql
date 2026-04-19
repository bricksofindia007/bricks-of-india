-- Migration 002: Add updated_at to content tables
-- Run in Supabase Dashboard → SQL Editor

-- news_articles
ALTER TABLE news_articles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE news_articles
  SET updated_at = published_at
  WHERE updated_at IS NULL;

ALTER TABLE news_articles
  ALTER COLUMN updated_at SET DEFAULT NOW();

-- reviews
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE reviews
  SET updated_at = published_at
  WHERE updated_at IS NULL;

ALTER TABLE reviews
  ALTER COLUMN updated_at SET DEFAULT NOW();

-- blog_posts
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE blog_posts
  SET updated_at = published_at
  WHERE updated_at IS NULL;

ALTER TABLE blog_posts
  ALTER COLUMN updated_at SET DEFAULT NOW();

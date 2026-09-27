-- Migration 20260514000000 — reviews schema hardening
-- Adds missing columns to the reviews table to align with news_articles / blog_posts schema.
-- Apply via: Supabase Dashboard → SQL Editor → paste and run.
-- All ADD COLUMN statements use IF NOT EXISTS — safe to re-run.

-- ── New columns ───────────────────────────────────────────────────────────────

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS hero_image      text,
  ADD COLUMN IF NOT EXISTS excerpt         text,
  ADD COLUMN IF NOT EXISTS seo_title       text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();

-- ── updated_at trigger ────────────────────────────────────────────────────────
-- update_updated_at() was created in baseline schema.sql and is idempotent in
-- migration 20260503000000. Creating trigger only if it does not already exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'reviews_updated_at'
      AND tgrelid = 'reviews'::regclass
  ) THEN
    EXECUTE $t$
      CREATE TRIGGER reviews_updated_at
        BEFORE UPDATE ON reviews
        FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    $t$;
  END IF;
END $$;

-- ── RLS check ─────────────────────────────────────────────────────────────────
-- reviews is public read, service-role write. Verify RLS is on.
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reviews'
      AND policyname = 'public read'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "public read"
        ON reviews
        FOR SELECT
        TO anon
        USING (true)
    $p$;
  END IF;
END $$;

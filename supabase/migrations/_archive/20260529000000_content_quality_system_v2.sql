-- Content Quality System v2 schema additions
-- Adds auto_fixable + fix_detail to existing content_quality_issues table
-- Creates content_image_registry and content_fix_log tables

-- 1. Extend content_quality_issues
ALTER TABLE content_quality_issues
  ADD COLUMN IF NOT EXISTS auto_fixable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fix_detail   text;

-- 2. content_image_registry
CREATE TABLE IF NOT EXISTS content_image_registry (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  checked_at   timestamptz DEFAULT now(),
  article_slug text,
  section      text,
  image_url    text,
  http_status  integer,
  is_duplicate boolean     DEFAULT false,
  duplicate_of text[]
);
CREATE INDEX IF NOT EXISTS idx_cir_image_url    ON content_image_registry (image_url);
CREATE INDEX IF NOT EXISTS idx_cir_is_duplicate ON content_image_registry (is_duplicate);
CREATE INDEX IF NOT EXISTS idx_cir_checked_at   ON content_image_registry (checked_at);
ALTER TABLE content_image_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON content_image_registry
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 3. content_fix_log
CREATE TABLE IF NOT EXISTS content_fix_log (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  fixed_at     timestamptz DEFAULT now(),
  article_slug text,
  section      text,
  fix_type     text,
  body_before  text,
  body_after   text,
  issue_id     uuid        REFERENCES content_quality_issues(id)
);
CREATE INDEX IF NOT EXISTS idx_cfl_article_slug ON content_fix_log (article_slug);
CREATE INDEX IF NOT EXISTS idx_cfl_fixed_at     ON content_fix_log (fixed_at);
ALTER TABLE content_fix_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON content_fix_log
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

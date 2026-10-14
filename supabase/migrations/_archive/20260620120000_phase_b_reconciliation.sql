-- PR-2b-3.6 Batch 2 — Phase B reconciliation
-- Captures all schema changes applied directly in Supabase SQL editor on 2026-06-20.
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS).

-- ── 1A. generator_runs: add drafts_failed ────────────────────────────────────

ALTER TABLE generator_runs
  ADD COLUMN IF NOT EXISTS drafts_failed integer NOT NULL DEFAULT 0;

-- ── 1B. guides: add hero_image, seo_title, seo_description ──────────────────
-- publishOneDraft sends these columns; live schema only had featured_image_url.
-- Backfill: copy featured_image_url → hero_image for existing rows.

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS hero_image       text,
  ADD COLUMN IF NOT EXISTS seo_title        text,
  ADD COLUMN IF NOT EXISTS seo_description  text;

UPDATE guides
  SET hero_image = featured_image_url
  WHERE hero_image IS NULL AND featured_image_url IS NOT NULL;

-- ── 1C. pending_drafts: add discard_reason and published_at ─────────────────
-- discard_reason: existed in live DB with no migration — documented here.
-- published_at: new column; backfilled from news_articles/blog_posts in Steps 2A/2B.

ALTER TABLE pending_drafts
  ADD COLUMN IF NOT EXISTS discard_reason text;

ALTER TABLE pending_drafts
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- ── 1D. pending_drafts: drop lint_results (plural) ───────────────────────────
-- lint_result (singular) is the live column written by generate-approved-drafts.ts.
-- lint_results (plural) had zero code references and is a legacy duplicate.
-- Backed up before drop: pending_drafts_lint_results_backup_20260620

ALTER TABLE pending_drafts DROP COLUMN IF EXISTS lint_results;

-- ── 2A. Backfill published_at from news_articles (~78 rows) ──────────────────

UPDATE pending_drafts pd
  SET published_at = na.published_at
  FROM news_articles na
  WHERE pd.status = 'published'
    AND pd.published_url = '/news/' || na.slug
    AND pd.published_at IS NULL;

-- ── 2B. Backfill published_at from blog_posts (1 opinion row) ────────────────

UPDATE pending_drafts pd
  SET published_at = bp.published_at
  FROM blog_posts bp
  WHERE pd.status = 'published'
    AND pd.published_url = '/opinion/' || bp.slug
    AND pd.published_at IS NULL;

-- ── 3B. Repair 3 NULL-published_url rows (explicit UUIDs from Step 3A) ───────
-- Populated after Step 3A diagnostic — see PR body for exact UUIDs and slugs used.

-- ── 4A. CHECK constraint: published rows must have published_url ──────────────

ALTER TABLE pending_drafts
  ADD CONSTRAINT pending_drafts_published_has_url
  CHECK (status != 'published' OR published_url IS NOT NULL) NOT VALID;

ALTER TABLE pending_drafts
  VALIDATE CONSTRAINT pending_drafts_published_has_url;

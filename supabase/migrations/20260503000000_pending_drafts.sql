-- Migration 20260503000000 — pending_drafts
-- Convention: supabase/migrations/<timestamp>_<name>.sql
-- Apply via: Supabase Dashboard → SQL Editor → paste and run.
-- This is the first migration under the supabase/migrations/ convention.
-- Prior schema history lives in scripts/schema.sql (baseline) and
-- scripts/migrations/ + db/migrations/ (ad-hoc, pre-CLI convention).
-- Future migrations go here with incrementing timestamps.

-- ── updated_at function ───────────────────────────────────────────────────────
-- update_updated_at() already exists in scripts/schema.sql (applied at
-- project baseline). CREATE OR REPLACE here is idempotent and harmless.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── pending_drafts table ──────────────────────────────────────────────────────
CREATE TABLE pending_drafts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url          text        NOT NULL,
  source_title        text        NOT NULL,
  source_excerpt      text,
  source_published_at timestamptz,
  draft_title         text,
  draft_body          text,

  -- NOTE on NULL: the spec listed null inside the IN(...) list.
  -- In Postgres, CHECK constraints evaluate to TRUE or NULL (not FALSE) when
  -- the column IS NULL — so NULLs pass automatically via column nullability.
  -- Listing null inside IN(...) does nothing useful and is omitted here.
  draft_verdict       text        CHECK (draft_verdict IN ('BUY', 'WAIT FOR SALE', 'IMPORT ONLY', 'SKIP')),

  draft_format        text        CHECK (draft_format IN ('news', 'review', 'opinion')),
  word_count          int,
  status              text        NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft', 'approved', 'rejected', 'published', 'failed_lint')),
  lint_results        jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  approved_at         timestamptz,
  approved_by         text,
  published_url       text
);

-- ── indexes ───────────────────────────────────────────────────────────────────

-- Dedup at write time: one draft per source URL
CREATE UNIQUE INDEX idx_pending_drafts_source_url
  ON pending_drafts (source_url);

-- /admin/pending query path
CREATE INDEX idx_pending_drafts_status
  ON pending_drafts (status);

-- Default ordering: newest first
CREATE INDEX idx_pending_drafts_created_at
  ON pending_drafts (created_at DESC);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE TRIGGER pending_drafts_updated_at
  BEFORE UPDATE ON pending_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Reviews Pipeline Overhaul — MyBrickHouse/Toycra direct sourcing
--
-- Live schema inspected before this migration was written:
--   reviews: id, set_id, title, slug, content, verdict, rating, youtube_url,
--            published_at, created_at, hero_image, excerpt, seo_title,
--            seo_description, updated_at — no source_* columns, no conflicts.
--   reviews.verdict distribution: WAIT=93, BUY NOW=15, IMPORT ONLY=5 (no AVOID
--   rows exist yet). The 5 legacy IMPORT ONLY rows are why the CHECK below is
--   added NOT VALID — a plain CHECK would reject the migration outright.
--   pending_drafts: no source_retailer/source_price_inr/source_stock_status/
--   source_checked_at columns present; existing source_url/source_title/
--   source_excerpt/source_published_at are RADAR-provenance fields, not
--   retailer-listing fields — no naming collision, just a shared "source_"
--   prefix with a different meaning depending on which table it's on.
--   pending_drafts.draft_verdict has NO live CHECK constraint at all (the
--   repo's 20260528130000_pending_drafts_verdict_fix.sql migration file
--   claims to add pending_drafts_draft_verdict_check, but it does not exist
--   in pg_constraint on the live DB — a real migration-file-vs-live drift,
--   reported here since this file is schema-of-record per project policy,
--   but not fixed: out of scope for the reviews pipeline).

-- ── reviews: source-of-truth columns ────────────────────────────────────────

ALTER TABLE reviews
  ADD COLUMN source_retailer text,              -- 'mybrickhouse' | 'toycra' | 'both'
  ADD COLUMN source_price_inr integer,           -- confirmed retailer price, not estimated
  ADD COLUMN source_stock_status text,           -- 'in_stock' | 'out_of_stock'
  ADD COLUMN source_checked_at timestamptz,      -- last time this listing was verified live
  ADD COLUMN verdict_disclaimer_variant text;    -- resolved variant used at generation time, for audit/lint

-- Reviews sourced from this pipeline can never legitimately be IMPORT ONLY
-- (listing on MyBrickHouse/Toycra is the entry condition). NOT VALID so the
-- 5 pre-existing IMPORT ONLY rows (RADAR-08-sourced, predate this pipeline)
-- are left untouched rather than rejecting the migration — enforced on all
-- new writes and any future UPDATE, not backfilled onto legacy rows.
--
-- BUG (caught + fixed same-day, see 20260730010000_reviews_verdict_check_scope_fix.sql):
-- this version is unconditional across the whole table, which also blocks
-- every FUTURE legacy RADAR-sourced review (source_retailer IS NULL) from
-- ever using IMPORT ONLY — still a legitimate verdict for that source (a
-- set genuinely absent from India retail). The restriction should only
-- apply where source_retailer IS NOT NULL. Left as originally shipped here
-- for an honest migration history; the follow-up file is the actual fix.
ALTER TABLE reviews
  ADD CONSTRAINT reviews_verdict_no_import_check
  CHECK (verdict IN ('BUY NOW', 'WAIT', 'AVOID')) NOT VALID;

-- ── pending_drafts: carry retailer metadata from discovery through to publish ──

ALTER TABLE pending_drafts
  ADD COLUMN source_retailer text,
  ADD COLUMN source_price_inr integer,
  ADD COLUMN source_stock_status text,
  ADD COLUMN source_checked_at timestamptz;

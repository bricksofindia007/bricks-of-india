-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260730031601, name reviews_source_pipeline, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Reviews Pipeline Overhaul — MyBrickHouse/Toycra direct sourcing
ALTER TABLE reviews
  ADD COLUMN source_retailer text,
  ADD COLUMN source_price_inr integer,
  ADD COLUMN source_stock_status text,
  ADD COLUMN source_checked_at timestamptz,
  ADD COLUMN verdict_disclaimer_variant text;

ALTER TABLE reviews
  ADD CONSTRAINT reviews_verdict_no_import_check
  CHECK (verdict IN ('BUY NOW', 'WAIT', 'AVOID')) NOT VALID;

ALTER TABLE pending_drafts
  ADD COLUMN source_retailer text,
  ADD COLUMN source_price_inr integer,
  ADD COLUMN source_stock_status text,
  ADD COLUMN source_checked_at timestamptz;

-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260708183355, name mrp_verified_flag, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

ALTER TABLE sets ADD COLUMN IF NOT EXISTS mrp_verified boolean NOT NULL DEFAULT false;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS mrp_review_reason text;
CREATE INDEX IF NOT EXISTS idx_sets_mrp_verified ON sets(mrp_verified);

-- Migration 20260503120000 — pending_drafts iteration support
-- Apply via: Supabase Dashboard → SQL Editor → paste and run.
--
-- Changes:
--   1. Drop unique constraint on source_url so multiple iteration rows
--      can exist for the same source (Day 2 known-bad row preserved as baseline,
--      each Day 3 prompt iteration produces a new row).
--   2. Add nullable iteration_label column for tagging rows by iteration
--      (e.g. 'day3-v2-attempt-1', 'day3-v2-attempt-2').
--   3. Index iteration_label for filtering.
--   4. Recreate source_url index as non-unique (performance, no longer dedup).
--   5. Tag the existing Day 2 known-bad baseline row explicitly.

-- 1. Drop unique index on source_url
DROP INDEX IF EXISTS idx_pending_drafts_source_url;

-- 2. Add iteration label column
ALTER TABLE pending_drafts ADD COLUMN iteration_label text;

-- 3. Index iteration_label
CREATE INDEX idx_pending_drafts_iteration_label
  ON pending_drafts (iteration_label);

-- 4. Recreate source_url index as non-unique (indexed for performance, no longer dedup)
CREATE INDEX idx_pending_drafts_source_url
  ON pending_drafts (source_url);

-- 5. Tag the Day 2 known-bad baseline row
UPDATE pending_drafts
  SET iteration_label = 'baseline-v1-day2'
  WHERE id = '39dd6b67-ee8b-42e7-b4c0-b0e14275aa73';

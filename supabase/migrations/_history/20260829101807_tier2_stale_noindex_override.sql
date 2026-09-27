-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260829101807, name tier2_stale_noindex_override, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

ALTER TABLE sets
  ADD COLUMN IF NOT EXISTS noindex_override boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN sets.noindex_override IS 'Manually-applied noindex, independent of the trigger-maintained index_tier column -- see 20260829010000_tier2_stale_noindex_override.sql. Currently used for the "tier2, year<2020, zero price_history ever" cutoff (14,836 sets applied 2026-08-29). Point-in-time: not automatically cleared if a flagged set later gets its first real price.';

CREATE INDEX IF NOT EXISTS idx_sets_noindex_override ON sets(noindex_override) WHERE noindex_override;

UPDATE sets s
SET noindex_override = true
WHERE s.index_tier = 'tier2'
  AND s.year < 2020
  AND NOT EXISTS (SELECT 1 FROM price_history ph WHERE ph.set_id = s.set_number);

-- Tier2 noindex cutoff: year < 2020 AND zero price history ever.
--
-- Deliberately a SEPARATE flag, not a reclassification of index_tier to
-- 'tier3'. index_tier is DB-trigger-maintained (see
-- 20260727000000_index_tier_classification.sql's sync_index_tier_for_set()
-- / compute_index_tier()) -- sets_sync_index_tier_trigger refires on any
-- future name/theme/year correction from a Rebrickable resync, and
-- compute_index_tier() has no concept of "old + never priced" in its
-- tier3 rule (merch/parts/book keywords only). Setting index_tier='tier3'
-- directly on these rows would not be durable: the very next metadata
-- correction touching one of them would silently recompute it back to
-- 'tier2' via that trigger, undoing this change with no visible signal.
-- A column the sync trigger never touches is the safe way to apply this.
--
-- Criteria checks price_history (not just current store_prices) for
-- "ever priced" -- current store_prices alone misses 446 sets with real
-- historical pricing from the since-discontinued "jaiman" store, which
-- never wrote to store_prices but did write to price_history. Confirmed
-- live before this migration: exactly 14,836 tier2 sets match
-- (index_tier='tier2' AND year<2020 AND NOT EXISTS in price_history).
--
-- Consumed by src/app/sets/[slug]/page.tsx (noindex meta, OR'd with the
-- existing index_tier='tier3' check) and src/app/sitemap.ts (excluded
-- alongside tier3). Both already updated in the same PR as this migration.
--
-- Point-in-time, not trigger-maintained: a set flagged noindex_override
-- here that later gets its first real price will NOT automatically flip
-- back to indexed -- there is no sync mechanism for that yet, only a
-- one-time UPDATE below. Flagged as a known follow-up, not built here
-- (out of this task's stated scope: "apply this cutoff", not "build a
-- self-maintaining rule").

ALTER TABLE sets
  ADD COLUMN IF NOT EXISTS noindex_override boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN sets.noindex_override IS 'Manually-applied noindex, independent of the trigger-maintained index_tier column -- see 20260829010000_tier2_stale_noindex_override.sql. Currently used for the "tier2, year<2020, zero price_history ever" cutoff (14,836 sets applied 2026-08-29). Point-in-time: not automatically cleared if a flagged set later gets its first real price.';

CREATE INDEX IF NOT EXISTS idx_sets_noindex_override ON sets(noindex_override) WHERE noindex_override;

-- One-time application of the year<2020 + zero-price-ever cutoff.
UPDATE sets s
SET noindex_override = true
WHERE s.index_tier = 'tier2'
  AND s.year < 2020
  AND NOT EXISTS (SELECT 1 FROM price_history ph WHERE ph.set_id = s.set_number);

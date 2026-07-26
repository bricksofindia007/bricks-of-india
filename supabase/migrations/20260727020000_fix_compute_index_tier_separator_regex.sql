-- Closes a migration-history gap, not a schema gap: compute_index_tier()
-- on live main has been correct since before 20260727000000_index_tier_
-- classification.sql was ever committed (the buggy separator-dot version
-- was caught and fixed via a raw execute_sql CREATE OR REPLACE, before
-- commit, before push) -- but that fix was never its own tracked
-- apply_migration call, so Supabase's migration HISTORY only recorded
-- the original (buggy) version's timestamp. Anyone reconstructing DB
-- state purely by replaying `list_migrations` history -- rather than
-- reading the actual committed file content -- would have missed the
-- fix. This migration is that missing history entry: an idempotent
-- CREATE OR REPLACE with the exact already-correct function body (no
-- behavior change on an already-fixed database), so index_tier
-- classification is now reproducible from migration history alone.
--
-- The bug itself, for the record: an earlier version escaped the
-- keyword regex's separator dots ("key\.?chain" instead of "key.?chain")
-- -- "\." matches a literal period only, silently breaking every
-- keyword needing a space/hyphen separator ("Key Chain", "Bag Tag").
-- Caught live: compute_index_tier() on a known keychain returned
-- 'tier2' instead of 'tier3'. The dots below are deliberately
-- unescaped -- "any separator character or none" is the intended
-- meaning, not "a literal period."

CREATE OR REPLACE FUNCTION compute_index_tier(p_name text, p_theme text, p_year int, p_has_price boolean)
RETURNS text AS $$
DECLARE
  tier3_keywords text := '(key.?chain|key.?light|bag.?tag|\ywatch\y|\ydvd\y|sticker|d.?tickers|backpack|lunch.?box|notebook|hoodie|t.?shirt|sweatshirt|\ymug\y|plush|battery.?pack|connector.?pegs|\yaxles?\y|bricks.?pack|modulex|\ywire\y|extension|building.?plates)';
  book_merch_themes text[] := ARRAY['Story Books','Activity Books with LEGO Parts','Activity Books','Non-fiction Books','Ideas Books'];
  core_retail_themes text[] := ARRAY[
    'Star Wars','Technic','Friends','Ninjago','Creator 3-in-1','Harry Potter','Icons','Speed Champions',
    'Disney','Minecraft','Brickheadz','Botanicals','City','LEGO Ideas and CUUSOO','Spider-Man',
    'The Infinity Saga','Disney Princess','Jurassic World','Editions','Batman','Duplo','Police','Fortnite',
    'Bluey','Classic','Construction','Super Mario','LEGO Art','Creator','Frozen','Christmas','Peppa Pig',
    'Trains','Easter','Ultimate Collector Series','Avengers','Architecture','One Piece','Valentine','Town',
    'Airport','Fire','Modular Buildings','Space','Toy Story','Seasonal','Chinese Traditional Festivals',
    'Arctic','X-Men','Gabby''s Dollhouse','Wednesday','Marvel','Coast Guard','Super Heroes Marvel',
    'Off-Road','Jungle','Farm','Halloween','Chinese (Lunar) New Year','Captain America','Hospital'
  ];
BEGIN
  IF lower(coalesce(p_name, '')) ~* tier3_keywords
     OR lower(coalesce(p_theme, '')) ~* tier3_keywords
     OR p_theme = ANY(book_merch_themes)
  THEN
    RETURN 'tier3';
  END IF;

  IF p_year >= 2023 AND p_has_price AND p_theme = ANY(core_retail_themes) THEN
    RETURN 'tier1';
  END IF;

  RETURN 'tier2';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Idempotent re-backfill -- a no-op on every row given the function is
-- already correct on this database, but included so replaying this
-- migration on a fresh database (where the function might otherwise
-- have been created correctly from the start, making this a genuine
-- no-op) still leaves index_tier consistent with the function.
UPDATE sets s
SET index_tier = compute_index_tier(
  s.name, s.theme, s.year,
  EXISTS (SELECT 1 FROM store_prices sp WHERE sp.set_id = s.set_number AND sp.price_inr IS NOT NULL)
);

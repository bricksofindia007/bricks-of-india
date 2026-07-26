-- GSC-01 Part A: continuous set-indexing tier classification.
-- Tier 1 = actively promoted (recent + priced + core-retail theme)
-- Tier 2 = normal indexing, no special promotion or suppression
-- Tier 3 = noindex candidate (merch/parts/exclusives, not real LEGO sets)
--
-- DB-enforced via triggers on BOTH sets and store_prices, not app-level
-- logic in a single ingestion script -- has_price depends on
-- store_prices, a separate table the scraper updates independently every
-- 6 hours, so a set's tier can change without sets itself being touched
-- (e.g. a set goes back in stock, or a store delists it). Matches this
-- repo's established pattern (video_posts_clear_priority_trigger,
-- migration 20260726150000) of putting classification at the DB level so
-- it can't be silently skipped by a different ingestion path (RADAR, CMF
-- sync, manual insert, or any future one).
--
-- Fixes applied vs. the Phase 1 diagnostic query (confirmed live against
-- real data before this migration):
--   1. "book" is no longer a bare substring match against name/theme --
--      it wrongly caught real reviewed sets ("Sherlock Holmes: Book
--      Nook" 10351, "Comic Book and Game Store" 42674). Now theme-gated:
--      only fires for actual book-merchandise themes.
--   2. Non-numeric set_number is no longer an independent Tier 3
--      trigger -- it was catching real sets with no merch signal at all
--      (K4492 "Star Wars Miniatures Kit III", PUPPY-HOUSE). A Tier 3
--      classification now always requires a keyword/theme match.
--      Known consequence, not a bug: some genuine non-core items with no
--      keyword corroboration (event-exclusive polybags, literal shoe
--      collabs, tote bags) now fall through to Tier 2 instead of Tier 3
--      -- the given keyword list doesn't cover every merch category.

CREATE OR REPLACE FUNCTION compute_index_tier(p_name text, p_theme text, p_year int, p_has_price boolean)
RETURNS text AS $$
DECLARE
  -- Dots here are deliberately UNESCAPED ("." not "\.") -- they mean "any
  -- separator character or none" (matches "Key Chain", "Key-Chain",
  -- "Keychain"), not "a literal period." An earlier version of this
  -- function escaped them, which silently broke every keyword needing a
  -- space/hyphen separator ("Bag Tag", "Key Chain" itself) -- caught live
  -- before this migration was committed, when compute_index_tier() on a
  -- known keychain returned 'tier2' instead of 'tier3'.
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

-- Recomputes and writes index_tier for exactly one set, given its
-- set_number -- the single call site both triggers below share, so the
-- has_price lookup and the write are never duplicated.
CREATE OR REPLACE FUNCTION sync_index_tier_for_set(p_set_number text)
RETURNS void AS $$
DECLARE
  v_has_price boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM store_prices WHERE set_id = p_set_number AND price_inr IS NOT NULL
  ) INTO v_has_price;

  UPDATE sets
  SET index_tier = compute_index_tier(name, theme, year, v_has_price)
  WHERE set_number = p_set_number
    AND index_tier IS DISTINCT FROM compute_index_tier(name, theme, year, v_has_price);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_sync_index_tier_on_sets()
RETURNS trigger AS $$
BEGIN
  PERFORM sync_index_tier_for_set(NEW.set_number);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fires on INSERT (new set from any ingestion path) or when name/theme/year
-- change (a Rebrickable resync correcting metadata). Does NOT fire on
-- UPDATE OF index_tier itself -- the backfill/sync UPDATE above only
-- touches that column, so this can't recurse.
CREATE TRIGGER sets_sync_index_tier_trigger
AFTER INSERT OR UPDATE OF name, theme, year ON sets
FOR EACH ROW
EXECUTE FUNCTION trg_sync_index_tier_on_sets();

CREATE OR REPLACE FUNCTION trg_sync_index_tier_on_store_prices()
RETURNS trigger AS $$
BEGIN
  PERFORM sync_index_tier_for_set(NEW.set_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- A set gaining its first real price (scraper finds stock) can newly
-- qualify for Tier 1; this is the only way that happens without editing
-- the sets row itself.
CREATE TRIGGER store_prices_sync_index_tier_trigger
AFTER INSERT OR UPDATE OF price_inr ON store_prices
FOR EACH ROW
EXECUTE FUNCTION trg_sync_index_tier_on_store_prices();

CREATE OR REPLACE FUNCTION trg_sync_index_tier_on_store_prices_delete()
RETURNS trigger AS $$
BEGIN
  PERFORM sync_index_tier_for_set(OLD.set_id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- A set losing its only price row (delisted) can drop out of Tier 1.
CREATE TRIGGER store_prices_sync_index_tier_delete_trigger
AFTER DELETE ON store_prices
FOR EACH ROW
EXECUTE FUNCTION trg_sync_index_tier_on_store_prices_delete();

ALTER TABLE sets ADD COLUMN IF NOT EXISTS index_tier text NOT NULL DEFAULT 'tier2'
  CHECK (index_tier IN ('tier1', 'tier2', 'tier3'));
CREATE INDEX IF NOT EXISTS idx_sets_index_tier ON sets(index_tier);

-- One-time backfill for all 25,296 existing rows. Does not fire the
-- sets_sync_index_tier_trigger (that only watches name/theme/year).
UPDATE sets s
SET index_tier = compute_index_tier(
  s.name, s.theme, s.year,
  EXISTS (SELECT 1 FROM store_prices sp WHERE sp.set_id = s.set_number AND sp.price_inr IS NOT NULL)
);

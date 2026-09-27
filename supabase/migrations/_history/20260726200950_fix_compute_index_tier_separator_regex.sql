-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260726200950, name fix_compute_index_tier_separator_regex, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

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

UPDATE sets s
SET index_tier = compute_index_tier(
  s.name, s.theme, s.year,
  EXISTS (SELECT 1 FROM store_prices sp WHERE sp.set_id = s.set_number AND sp.price_inr IS NOT NULL)
);

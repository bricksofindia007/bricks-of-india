-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260825183631, name gwp_pricing_schema, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

ALTER TABLE sets
  ADD COLUMN is_gwp boolean NOT NULL DEFAULT false,
  ADD COLUMN gwp_parent_set_number text REFERENCES sets(set_number);

COMMENT ON COLUMN sets.is_gwp IS
  'True if this set was originally released as a Gift-with-Purchase (LEGO.com Insiders Days spend-threshold promo, or bundled with a specific set), not a normally purchasable retail set. Independent of whether a store currently sells it standalone -- see gwp_parent_set_number and the store_prices-first display rule (store_prices is always checked first; is_gwp only explains an absence of a price, it never suppresses a real one).';

COMMENT ON COLUMN sets.gwp_parent_set_number IS
  'For a GWP that requires purchasing one specific other set to receive it (not a general LEGO.com spend threshold with no single required item), that required parent set''s set_number. NULL for spend-threshold GWPs with no single required parent, and for any non-GWP set.';

UPDATE sets SET is_gwp = true WHERE set_number IN ('30730', '40908', '40912', '40919', '40894');
UPDATE sets SET is_gwp = true WHERE set_number IN ('40896', '40891');
UPDATE sets SET gwp_parent_set_number = '21361' WHERE set_number = '40919';
UPDATE sets SET gwp_parent_set_number = '42232' WHERE set_number = '40894';

-- BOI Fix Brief issue #78 (2026-08-26) -- GWP pricing rule, finalized by
-- Abhinav: if a tracked store lists a real standalone price for a GWP set's
-- own set_id, show it like any normal set (store_prices is checked first,
-- always -- see src/app/reviews/[slug]/page.tsx and technical-hygiene.mjs's
-- ReviewedSetPrices check, both already correct on this point per PR #73).
-- If no store lists one, label it as a gift-with-purchase tied to its
-- associated/required parent set (when one exists), with no independent
-- price shown. This is the permanence-marker gap that was tracked as open
-- through the rest of the session.
--
-- Two distinct GWP shapes were confirmed this session (linkage audit +
-- live MyBrickHouse verification, 2026-08-25): a bare GWP with no priced
-- link anywhere (40908, 40912, 30730), and a GWP tied to one specific
-- required parent-set purchase (40894 -> parent 42232; 40919 -> parent
-- 21361) -- a flat boolean alone can't represent the second shape, hence
-- the separate parent-set column rather than is_gwp alone.

ALTER TABLE sets
  ADD COLUMN is_gwp boolean NOT NULL DEFAULT false,
  ADD COLUMN gwp_parent_set_number text REFERENCES sets(set_number);

COMMENT ON COLUMN sets.is_gwp IS
  'True if this set was originally released as a Gift-with-Purchase (LEGO.com Insiders Days spend-threshold promo, or bundled with a specific set), not a normally purchasable retail set. Independent of whether a store currently sells it standalone -- see gwp_parent_set_number and the store_prices-first display rule (store_prices is always checked first; is_gwp only explains an absence of a price, it never suppresses a real one).';

COMMENT ON COLUMN sets.gwp_parent_set_number IS
  'For a GWP that requires purchasing one specific other set to receive it (not a general LEGO.com spend threshold with no single required item), that required parent set''s set_number. NULL for spend-threshold GWPs with no single required parent, and for any non-GWP set.';

-- Backfill the 6 real cases confirmed by live evidence this session
-- (MyBrickHouse direct checks + store_prices cross-reference, 2026-08-25).
-- No standalone price anywhere:
UPDATE sets SET is_gwp = true WHERE set_number IN ('30730', '40908', '40912', '40919', '40894');
-- GWP-origin but a tracked store DOES sell it standalone (is_gwp is about
-- origin/classification, not current sellability -- store_prices already
-- shows the real price for these two regardless of this flag):
UPDATE sets SET is_gwp = true WHERE set_number IN ('40896', '40891');
-- Required-parent-purchase relationships:
UPDATE sets SET gwp_parent_set_number = '21361' WHERE set_number = '40919'; -- Gremlins Gizmo and Stripe Figures -> Gremlins: Gizmo
UPDATE sets SET gwp_parent_set_number = '42232' WHERE set_number = '40894'; -- Koenigsegg Sadair's Spear Steering Wheel -> Koenigsegg Sadair's Spear Megacar

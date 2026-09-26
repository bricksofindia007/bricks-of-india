-- Wave 1 PR-0 (2026-09-26): capture each listing's displayed MRP / strike-
-- through (Shopify variant compare_at_price) alongside its selling price.
--
-- store_prices ONLY. price_history is deliberately untouched, so capturing
-- MRP adds no growth to the table the 2026-09-26 DB-size work (#191) trimmed.
--
-- Nullable, no default: ADD COLUMN is a catalog-only change (no table rewrite).
-- Projected size: ~4 bytes x 1,882 rows ≈ 8-15 KB incl. alignment. store_prices
-- rows are already rewritten on every scrape, so no extra churn.
--
-- NULL = the store sets no compare_at_price for that listing (common at
-- MyBrickHouse). Anchor logic (locked rule R2, ruling C) lives in the
-- price-summary view (PR-B), not here.
ALTER TABLE public.store_prices
  ADD COLUMN IF NOT EXISTS compare_at_price_inr integer;

COMMENT ON COLUMN public.store_prices.compare_at_price_inr IS
  'Listing''s displayed MRP / strike-through (Shopify compare_at_price) for the chosen variant, rounded INR. NULL when the store sets none. Written by scripts/scrape-now.mjs; never copied to price_history.';

-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260926094143, name store_prices_compare_at, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Repo file: supabase/migrations/20260926010000_store_prices_compare_at.sql (Wave 1 PR-0)
ALTER TABLE public.store_prices
  ADD COLUMN IF NOT EXISTS compare_at_price_inr integer;

COMMENT ON COLUMN public.store_prices.compare_at_price_inr IS
  'Listing''s displayed MRP / strike-through (Shopify compare_at_price) for the chosen variant, rounded INR. NULL when the store sets none. Written by scripts/scrape-now.mjs; never copied to price_history.';

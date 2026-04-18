-- Bricks of India — Migration 001: store_prices + price_history
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- Safe to re-run (uses IF NOT EXISTS).

-- Current prices per store (one row per set per store, upserted each scrape)
CREATE TABLE IF NOT EXISTS store_prices (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id      TEXT        NOT NULL,
  store_id    TEXT        NOT NULL CHECK (store_id IN ('toycra', 'mybrickhouse', 'jaiman')),
  price_inr   NUMERIC,
  in_stock    BOOLEAN     NOT NULL DEFAULT FALSE,
  product_url TEXT        NOT NULL,
  scraped_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (set_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_store_prices_set_id   ON store_prices(set_id);
CREATE INDEX IF NOT EXISTS idx_store_prices_store_id  ON store_prices(store_id);
CREATE INDEX IF NOT EXISTS idx_store_prices_scraped   ON store_prices(scraped_at DESC);

-- Historical price log (append-only, one row per scrape per store per set)
CREATE TABLE IF NOT EXISTS price_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id      TEXT        NOT NULL,
  store_id    TEXT        NOT NULL,
  price_inr   NUMERIC,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_set_id   ON price_history(set_id);
CREATE INDEX IF NOT EXISTS idx_price_history_store_id  ON price_history(store_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded  ON price_history(recorded_at DESC);

-- Enable Row Level Security (anon can read, service role can write)
ALTER TABLE store_prices  ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist, then recreate
DROP POLICY IF EXISTS "allow_public_read_store_prices"  ON store_prices;
DROP POLICY IF EXISTS "allow_public_read_price_history" ON price_history;

CREATE POLICY "allow_public_read_store_prices"
  ON store_prices FOR SELECT USING (true);

CREATE POLICY "allow_public_read_price_history"
  ON price_history FOR SELECT USING (true);

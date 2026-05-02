-- Migration 001 — price_snapshots
-- Applied manually via Supabase dashboard SQL editor.
-- See db/migrations/README.md for the convention.

CREATE TABLE price_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  set_num       TEXT NOT NULL,
  store         TEXT NOT NULL,        -- 'toycra' | 'mybrickhouse' | 'jaiman'
  price_inr     INTEGER NOT NULL,     -- in rupees, no decimals
  in_stock      BOOLEAN NOT NULL,
  snapshot_date DATE NOT NULL,        -- the day this snapshot represents (UTC)
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (set_num, store, snapshot_date)
);

CREATE INDEX idx_price_snapshots_set_date
  ON price_snapshots (set_num, snapshot_date DESC);

CREATE INDEX idx_price_snapshots_date
  ON price_snapshots (snapshot_date DESC);

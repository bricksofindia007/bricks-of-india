-- cmf_figures: individual LEGO Collectible Minifigures, one row per figure variant
-- Populated by scripts/sync-cmf-figures.mjs
-- series_set_number joins to sets.set_number (the parent blind-bag set)

CREATE TABLE IF NOT EXISTS cmf_figures (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  figure_number       text        NOT NULL UNIQUE,   -- '71051-1', '71051-2' etc.
  series_set_number   text        NOT NULL,           -- '71051' — FK to sets.set_number
  name                text        NOT NULL,           -- 'Peacock Suit'
  image_url           text,
  series_name         text        NOT NULL,           -- 'Series 28 Minifigures'
  year                int,
  figure_index        int,                            -- numeric suffix for sort order
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cmf_figures_series_idx ON cmf_figures(series_set_number);
CREATE INDEX IF NOT EXISTS cmf_figures_year_idx   ON cmf_figures(year);

-- RLS: public read, service-role write
ALTER TABLE cmf_figures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmf_figures_public_read" ON cmf_figures FOR SELECT USING (true);

-- CATALOG-04 v2: retirement tracking columns on sets table

ALTER TABLE sets
  ADD COLUMN IF NOT EXISTS retirement_date   date,
  ADD COLUMN IF NOT EXISTS is_retiring_soon  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retired           boolean NOT NULL DEFAULT false;

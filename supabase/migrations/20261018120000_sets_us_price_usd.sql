-- boi:issue 658
-- US retail price in dollars for each set, from the catalogue source. Used only for worth estimates
-- in My Collection. Nullable, no default: a set has no value until the populate job writes one.
-- Not read by any public page in this migration.
ALTER TABLE public.sets ADD COLUMN IF NOT EXISTS us_price_usd numeric;

COMMENT ON COLUMN public.sets.us_price_usd IS 'US retail price in USD from the catalogue source. Null until the populate job has written it.';

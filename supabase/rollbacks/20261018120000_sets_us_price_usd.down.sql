-- Rollback for 20261018120000_sets_us_price_usd. Run by hand, in one transaction, only when approved.
begin;
ALTER TABLE public.sets DROP COLUMN IF EXISTS us_price_usd;
commit;

-- Rollback for 20261018120100_sets_bulk_us_price. Run by hand, in one transaction, only when approved.
begin;
DROP FUNCTION IF EXISTS public.sets_bulk_us_price(jsonb);
commit;

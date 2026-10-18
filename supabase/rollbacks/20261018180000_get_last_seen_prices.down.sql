-- Rollback for 20261018180000_get_last_seen_prices. Run by hand, in one transaction, only when approved.
-- Removes the function: My Collection shows the approved retired line for every set until it returns.
begin;
DROP FUNCTION IF EXISTS public.get_last_seen_prices(text[]);
commit;

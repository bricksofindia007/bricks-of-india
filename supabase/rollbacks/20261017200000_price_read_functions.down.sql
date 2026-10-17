-- Rollback for 20261017200000_price_read_functions. Run by hand, in one transaction, only when approved.
-- Restores the anonymous direct read on the two price tables and removes the three functions.
-- Safe to run after the migration: the grants restored here are the ones the migration removed.
begin;
grant select on public.store_prices to anon, authenticated;
grant select on public.price_history to anon, authenticated;
drop function if exists public.get_set_prices(text);
drop function if exists public.get_price_history(text, int);
drop function if exists public.get_price_summaries(text[]);
commit;

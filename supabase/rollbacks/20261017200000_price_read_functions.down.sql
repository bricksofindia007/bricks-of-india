-- Rollback for 20261017200000_price_read_functions. Run by hand, in one transaction, only when approved.
-- Removes the price read functions. Does NOT touch table grants: run 20261017270000's down first if the
-- anonymous direct read must come back.
begin;
drop function if exists public.get_set_prices(text);
drop function if exists public.get_price_history(text, int);
drop function if exists public.get_price_summaries(text[]);
drop function if exists public.get_price_summary_for_set(text);
commit;

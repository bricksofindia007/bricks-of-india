-- Rollback for 20261018190000_usd_inr_rate. Run by hand, in one transaction, only when approved.
-- Removes the server-only read function and the stored-rate table. The price estimates then have no stored rate.
begin;
drop function if exists public.get_usd_inr_rate();
drop table if exists public.usd_inr_rate;
commit;

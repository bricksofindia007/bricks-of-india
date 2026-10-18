-- Rollback for 20261017220000_price_call_counts. Run by hand, in one transaction, only when approved.
-- Removes the call-count function. Nothing else depends on it.
begin;
drop function if exists public.get_price_call_counts();
commit;

-- Rollback for 20261017270000. Run by hand, in one transaction, only when approved.
-- Re-grants SELECT on the two price tables to anon and authenticated, exactly as production has it
-- (scripts/backup/prod-grants-2026-10-18.sql).
begin;
grant select on table public.store_prices, public.price_history to anon, authenticated;
commit;

-- Rollback for 20261024230000_account_storage.sql. Drops the account tables and the limit trigger. Only run if no data is kept.
drop trigger if exists saved_sets_limit on public.saved_sets;
drop function if exists public.saved_sets_limit();
drop table if exists public.saved_figures;
drop table if exists public.saved_sets;
drop table if exists public.accounts;

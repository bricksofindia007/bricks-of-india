-- Rollback for 20261025010000_signin_codes.sql. Drops the sign-in and session tables. Only run if no data is kept.
drop table if exists public.account_sessions;
drop table if exists public.sign_in_sends;
drop table if exists public.sign_in_codes;

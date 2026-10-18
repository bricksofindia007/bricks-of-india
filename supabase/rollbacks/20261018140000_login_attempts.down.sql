-- Rollback for 20261018140000_login_attempts. Run by hand, in one transaction, only when approved.
-- Clears every failure count and block: sign-in attempts are no longer limited in the app.
begin;
DROP TABLE IF EXISTS public.login_attempts;
commit;

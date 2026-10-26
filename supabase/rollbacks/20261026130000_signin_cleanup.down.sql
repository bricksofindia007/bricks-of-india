-- Rollback for 20261026130000_signin_cleanup. Run by hand, in one transaction. Removes only the function; no rows are touched.
drop function if exists public.cleanup_sign_in_rows(boolean);

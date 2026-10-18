-- Rollback for 20261017250000_admin_sessions. Run by hand, in one transaction, only when approved.
-- Dropping the table ends every open admin session: the server no longer finds them.
begin;
drop table if exists public.admin_sessions;
commit;

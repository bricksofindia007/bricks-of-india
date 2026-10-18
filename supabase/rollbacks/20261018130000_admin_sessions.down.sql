-- Rollback for 20261018130000_admin_sessions. Run by hand, in one transaction, only when approved.
-- Drops every open admin session: all admins are signed out.
begin;
DROP TABLE IF EXISTS public.admin_sessions;
commit;

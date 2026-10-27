-- Rollback for 20261027130000_revoke_saved_sets_limit_execute.sql (issue 828). Restores the default PUBLIC execute only.
grant execute on function public.saved_sets_limit() to public;

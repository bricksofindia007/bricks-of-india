-- boi:issue 828
-- Revokes the default public execute on the saved sets limit trigger function (order 1130, addendum 23:31 item G).
-- Migration 20261024230000 created public.saved_sets_limit() with no revoke, so it carries the default PUBLIC execute.
-- That migration is already applied on staging and is NOT edited. This one only removes execute from PUBLIC, anon and authenticated.
-- NOT APPLIED: staging rehearsal first; production only in the bundle window.
-- Rollback: supabase/rollbacks/20261027130000_revoke_saved_sets_limit_execute.down.sql

revoke all on function public.saved_sets_limit() from public, anon, authenticated;

-- Self-check: no browser role or PUBLIC holds execute on the function. Fails the migration if one does.
do $$
begin
  if exists (
    select 1 from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'saved_sets_limit'
      and privilege_type = 'EXECUTE'
      and upper(grantee) in ('ANON', 'AUTHENTICATED', 'PUBLIC')
  ) then
    raise exception 'saved_sets_limit: anon, authenticated or public still has execute';
  end if;
end
$$;

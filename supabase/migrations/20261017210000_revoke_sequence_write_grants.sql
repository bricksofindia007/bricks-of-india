-- boi:issue 625
-- The anonymous and signed-in roles may not set sequence values. Inserts need only USAGE (nextval),
-- which stays granted, so the public insert paths (newsletter, community spotlights) are unchanged.
-- Found by the standing privilege check (scripts/rehearsal/privileges-check.sql). Rollback:
-- supabase/rollbacks/20261017210000_revoke_sequence_write_grants.down.sql
revoke update on all sequences in schema public from anon, authenticated;

-- Objects created later by the migration roles get no update right on sequences for these roles.
-- Each default-privilege change runs only when the migration login is a member of that role (the hosted login cannot change another role's defaults).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_admin') and pg_has_role(current_user, 'supabase_admin', 'member') then
    alter default privileges for role supabase_admin in schema public revoke update on sequences from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'postgres') and pg_has_role(current_user, 'postgres', 'member') then
    alter default privileges for role postgres in schema public revoke update on sequences from anon, authenticated;
  end if;
end $$;

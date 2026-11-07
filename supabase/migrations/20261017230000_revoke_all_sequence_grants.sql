-- Sequences in the public schema: the anonymous and signed-in roles get no rights at all.
-- Inserts from the site run through the full-access server client, which keeps its rights, so no
-- working path loses access. Rollback: supabase/rollbacks/20261017230000_revoke_all_sequence_grants.down.sql
revoke all on all sequences in schema public from anon, authenticated;

-- Sequences created later by the migration roles get no rights for these roles either.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    alter default privileges for role supabase_admin in schema public revoke all on sequences from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'postgres') then
    alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
  end if;
end $$;

-- Rehearsal check for public.admin_sessions (run after the migrations, in the rehearsal database).
-- Checks: row-level security is on; anonymous and signed-in roles hold no rights; the server role holds the
-- three it needs; an anonymous read is refused; a session row can be revoked by the server role.
do $$
declare
  rls boolean;
begin
  select relrowsecurity into rls from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'admin_sessions';
  if rls is distinct from true then raise exception 'RLS: public.admin_sessions has row-level security off'; end if;

  if has_table_privilege('anon', 'public.admin_sessions', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'GRANT: anon holds rights on public.admin_sessions';
  end if;
  if has_table_privilege('authenticated', 'public.admin_sessions', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'GRANT: authenticated holds rights on public.admin_sessions';
  end if;
  if not (has_table_privilege('service_role', 'public.admin_sessions', 'SELECT')
          and has_table_privilege('service_role', 'public.admin_sessions', 'INSERT')
          and has_table_privilege('service_role', 'public.admin_sessions', 'UPDATE')) then
    raise exception 'GRANT: service_role lacks select, insert or update on public.admin_sessions';
  end if;

  -- an anonymous read is refused
  begin
    set local role anon;
    perform 1 from public.admin_sessions limit 1;
    reset role;
    raise exception 'EXPECTED REFUSAL: anonymous role read public.admin_sessions';
  exception when insufficient_privilege then
    reset role;
  end;

  -- the server role can insert and revoke a session (throwaway row, removed at the end)
  set local role service_role;
  insert into public.admin_sessions (id, expires_at) values ('rehearsal-session-000000', now() + interval '1 hour');
  update public.admin_sessions set revoked_at = now() where id = 'rehearsal-session-000000' and revoked_at is null;
  reset role;
  delete from public.admin_sessions where id = 'rehearsal-session-000000';

  raise notice 'admin sessions check met: RLS on, no anonymous or signed-in rights, server role can insert and revoke';
end $$;

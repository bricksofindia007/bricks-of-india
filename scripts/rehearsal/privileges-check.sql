-- Standing check (run after every migration, in the rehearsal database and by the anonymous probe's owner).
-- Fails if the anonymous or the signed-in role holds INSERT, UPDATE, DELETE or TRUNCATE on any object
-- in the public schema, or if a default privilege would give them those rights on new objects.
--
-- Note: objects created by supabase_admin get open defaults on Supabase (default privileges grant the
-- API roles broad rights unless revoked). A migration that creates an object as supabase_admin is
-- therefore only safe if this check passes afterwards. The check looks at what exists and at the
-- default-privilege rules, so it catches both.
do $$
declare
  bad text;
begin
  -- existing objects: tables, views, materialised views, partitioned tables, foreign tables, sequences
  select string_agg(c.relname || ' ' || r.rolname || ' ' || a.privilege_type, ', ' order by c.relname)
    into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault(case when c.relkind = 'S' then 'S'::"char" else 'r'::"char" end, c.relowner))) a
  join pg_roles r on r.oid = a.grantee
  where n.nspname = 'public'
    and c.relkind in ('r', 'v', 'm', 'p', 'f', 'S')
    and r.rolname in ('anon', 'authenticated')
    and a.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
  if bad is not null then
    raise exception 'PRIVILEGE CHECK: write rights on public objects: %', bad;
  end if;

  -- default privileges for objects created later in public (by any creating role)
  select string_agg(pg_get_userbyid(d.defaclrole) || ' ' || r.rolname || ' ' || a.privilege_type, ', ')
    into bad
  from pg_default_acl d
  cross join lateral aclexplode(d.defaclacl) a
  join pg_roles r on r.oid = a.grantee
  where d.defaclnamespace = 'public'::regnamespace
    and r.rolname in ('anon', 'authenticated')
    and a.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
  if bad is not null then
    raise exception 'PRIVILEGE CHECK: default privileges would grant writes on new public objects: %', bad;
  end if;

  raise notice 'privilege check met: no write rights for anon or authenticated on public objects or defaults';
end $$;

-- Standing check (run after every migration): the anonymous and signed-in roles hold no privilege at all on
-- any sequence in the public schema, and default privileges would not give them any on new sequences.
do $$
declare
  bad text;
begin
  select string_agg(c.relname || ' ' || r.rolname || ' ' || a.privilege_type, ', ' order by c.relname)
    into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault('S'::"char", c.relowner))) a
  join pg_roles r on r.oid = a.grantee
  where n.nspname = 'public'
    and c.relkind = 'S'
    and r.rolname in ('anon', 'authenticated');
  if bad is not null then
    raise exception 'SEQUENCE CHECK: anonymous or signed-in rights on public sequences: %', bad;
  end if;

  select string_agg(pg_get_userbyid(d.defaclrole) || ' ' || r.rolname || ' ' || a.privilege_type, ', ')
    into bad
  from pg_default_acl d
  cross join lateral aclexplode(d.defaclacl) a
  join pg_roles r on r.oid = a.grantee
  where d.defaclnamespace = 'public'::regnamespace
    and d.defaclobjtype = 'S'
    and r.rolname in ('anon', 'authenticated');
  if bad is not null then
    raise exception 'SEQUENCE CHECK: default rights for new public sequences: %', bad;
  end if;

  raise notice 'sequence check met: no anonymous or signed-in rights on public sequences or defaults';
end $$;

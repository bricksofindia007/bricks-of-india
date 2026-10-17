select c.relname, c.relkind, pg_get_userbyid(c.relowner) as owner,
  has_table_privilege('anon', c.oid, 'INSERT,UPDATE,DELETE') as anon_w,
  has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE') as auth_w
from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p','v','m')
and (has_table_privilege('anon', c.oid, 'INSERT,UPDATE,DELETE') or has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE'));

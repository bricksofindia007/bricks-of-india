-- boi:issue 812
-- Read-only reading: the five largest tables by total size, for the weekly usage reading.
-- NOT APPLIED: staging rehearsal and review first (G7). Read by the service role only (G8): nothing for anon, authenticated or public.
create or replace function public.table_size_top5()
returns jsonb
language sql stable
set search_path to 'public', 'pg_catalog'
as $$
  select coalesce(jsonb_agg(t order by t.mb desc), '[]'::jsonb) from (
    select n.nspname || '.' || c.relname as name,
           round(pg_total_relation_size(c.oid) / 1048576.0, 1) as mb
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname in ('public', 'growth')
    order by pg_total_relation_size(c.oid) desc
    limit 5
  ) t;
$$;

revoke all on function public.table_size_top5() from public, anon, authenticated;
grant execute on function public.table_size_top5() to service_role;

-- Read-only: the cumulative call count of each price function, from the query statistics extension.
-- A call is counted when the function's name appears in a recorded query. Returns function names and
-- call counts only. Runs with its owner's rights (security definer) so it can read the statistics view.
-- Only the full-access role may call it (anonymous, signed-in and public roles are revoked).
-- Rollback: supabase/rollbacks/20261017220000_price_call_counts.down.sql

create extension if not exists pg_stat_statements with schema extensions;

create or replace function public.get_price_call_counts()
returns table (function_name text, calls bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select f.name::text, coalesce(sum(s.calls), 0)::bigint
  from (values
    ('get_set_prices'),
    ('get_prices_for_sets'),
    ('get_price_history'),
    ('get_best_prices_for_sets'),
    ('get_price_summaries'),
    ('set_page_data')
  ) as f(name)
  left join extensions.pg_stat_statements s on strpos(s.query, f.name) > 0
  group by f.name
  order by f.name
$$;

revoke all on function public.get_price_call_counts() from public;
revoke all on function public.get_price_call_counts() from anon, authenticated;
grant execute on function public.get_price_call_counts() to service_role;

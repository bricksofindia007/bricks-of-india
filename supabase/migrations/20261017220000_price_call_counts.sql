-- Read-only: the cumulative call count of each price function, from the database statistics.
-- Returns function names and call counts only. Runs with its owner's rights (security definer) so it can read
-- the statistics view. Only the full-access role may call it (anonymous and signed-in roles are revoked).
-- Note: SQL functions are counted only when the database setting track_functions = 'all'. With any other
-- setting the counts stay at zero or are missing; that is a database setting, not a bug in this function.
-- Rollback: supabase/rollbacks/20261017220000_price_call_counts.down.sql

create or replace function public.get_price_call_counts()
returns table (function_name text, calls bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select s.funcname::text as function_name, s.calls
  from pg_stat_user_functions s
  where s.schemaname = 'public'
    and s.funcname in ('get_set_prices', 'get_prices_for_sets', 'get_price_history', 'get_best_prices_for_sets',
                       'get_price_summaries', 'get_price_summary_for_set')
  order by s.funcname
$$;

revoke all on function public.get_price_call_counts() from public;
revoke all on function public.get_price_call_counts() from anon, authenticated;
grant execute on function public.get_price_call_counts() to service_role;

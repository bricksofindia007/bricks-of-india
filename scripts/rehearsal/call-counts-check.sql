-- Rehearsal check for get_price_call_counts (run after the migrations, in the rehearsal database).
-- Checks: the shape (two columns), the fixed search path, definer rights, the six names covered, the grants
-- (service role only), and that the statistics view the function reads exists. Counts are not asserted:
-- the rehearsal database does not run live traffic.
do $$
declare
  shape text;
  cfg text[];
  names int;
  secdef boolean;
begin
  select pg_get_function_result(p.oid), p.proconfig, p.prosecdef
    into shape, cfg, secdef
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_price_call_counts';
  if shape is distinct from 'TABLE(function_name text, calls bigint)' then
    raise exception 'SHAPE: get_price_call_counts returns %, expected TABLE(function_name text, calls bigint)', shape;
  end if;
  if not secdef then raise exception 'RIGHTS: get_price_call_counts is not security definer'; end if;
  if cfg is null or not ('search_path=""' = any (cfg)) then
    raise exception 'SEARCH PATH: get_price_call_counts does not fix search_path to empty';
  end if;

  if to_regclass('extensions.pg_stat_statements') is null then
    raise exception 'STATS: extensions.pg_stat_statements is not available';
  end if;

  if has_function_privilege('anon', 'public.get_price_call_counts()', 'EXECUTE') then
    raise exception 'GRANT: anon can execute get_price_call_counts';
  end if;
  if has_function_privilege('authenticated', 'public.get_price_call_counts()', 'EXECUTE') then
    raise exception 'GRANT: authenticated can execute get_price_call_counts';
  end if;
  if has_function_privilege('public', 'public.get_price_call_counts()', 'EXECUTE') then
    raise exception 'GRANT: public can execute get_price_call_counts';
  end if;
  if not has_function_privilege('service_role', 'public.get_price_call_counts()', 'EXECUTE') then
    raise exception 'GRANT: service_role cannot execute get_price_call_counts';
  end if;

  -- six price functions covered, one row each
  select count(*) into names from public.get_price_call_counts();
  if names <> 6 then raise exception 'COVERAGE: get_price_call_counts returned % rows, expected 6', names; end if;

  raise notice 'call-count function met: two columns, six functions, service role only, fixed search path';
end $$;

-- Rehearsal check for get_price_call_counts (run after the migrations, in the rehearsal database).
-- Checks the shape (two columns only) and the grants: the full-access role may call it; the anonymous and
-- signed-in roles may not. Counts are not asserted here: the rehearsal database does not run the live traffic.
do $$
declare
  shape text;
begin
  select pg_get_function_result(p.oid) into shape
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_price_call_counts';
  if shape is distinct from 'TABLE(function_name text, calls bigint)' then
    raise exception 'SHAPE: get_price_call_counts returns %, expected TABLE(function_name text, calls bigint)', shape;
  end if;

  if has_function_privilege('anon', 'public.get_price_call_counts()', 'EXECUTE') then
    raise exception 'GRANT: anon can execute get_price_call_counts';
  end if;
  if has_function_privilege('authenticated', 'public.get_price_call_counts()', 'EXECUTE') then
    raise exception 'GRANT: authenticated can execute get_price_call_counts';
  end if;
  if not has_function_privilege('service_role', 'public.get_price_call_counts()', 'EXECUTE') then
    raise exception 'GRANT: service_role cannot execute get_price_call_counts';
  end if;

  -- the function runs for the full-access role and returns only the two columns
  perform function_name, calls from public.get_price_call_counts();

  raise notice 'call-count function met: two columns, full-access role only';
end $$;

-- Runs as the anonymous role against the rehearsal database, after the migrations.
-- Expects: a refusal on each direct read of the two price tables, and a normal answer from each function.
-- Any other result stops the job.
do $$
begin
  -- 1. direct reads refused
  begin
    set local role anon;
    perform 1 from public.store_prices limit 1;
    reset role;
    raise exception 'EXPECTED REFUSAL: anonymous role could read store_prices';
  exception when insufficient_privilege then
    reset role;
  end;

  begin
    set local role anon;
    perform 1 from public.price_history limit 1;
    reset role;
    raise exception 'EXPECTED REFUSAL: anonymous role could read price_history';
  exception when insufficient_privilege then
    reset role;
  end;

  -- 2. functions answer
  set local role anon;
  perform count(*) from public.get_set_prices('75419');
  perform count(*) from public.get_prices_for_sets(array['75419', '10305']);
  perform count(*) from public.get_price_history('75419', 10);
  perform count(*) from public.get_best_prices_for_sets(array['75419', '10305']);
  reset role;
  raise notice 'anon expectations met: direct reads refused, functions answer';
end $$;

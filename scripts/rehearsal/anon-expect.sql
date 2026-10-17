-- Runs in the rehearsal database after the migrations.
-- 1. Direct reads of the two price tables are refused for the anonymous role.
-- 2. The price functions answer the anonymous role, within their caps.
-- 3. A store in testing (display_enabled = false) is never returned by the functions.
-- The seed is throwaway data in the rehearsal database only. A failed check rolls the whole block back.
do $$
declare
  n int;
  testing_rows int;
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

  -- Seed as the owner: 21 public stores, one testing store, 22 price rows for one set, 250 history rows.
  insert into public.stores (id, name, site_url, display_enabled, display_order, scraper_kind)
  select 'rehearsal-s' || lpad(g::text, 2, '0'), 'Rehearsal ' || g, 'https://rehearsal' || g || '.invalid',
         g <= 21, 900 + g, 'manual'
  from generate_series(1, 22) g;

  insert into public.store_prices (set_id, store_id, price_inr, in_stock, product_url, scraped_at)
  select '99999', 'rehearsal-s' || lpad(g::text, 2, '0'), 100 + g, true, 'https://rehearsal' || g || '.invalid/p', now()
  from generate_series(1, 22) g;

  insert into public.price_history (set_id, store_id, price_inr, in_stock, recorded_at)
  select '99999', 'rehearsal-s01', 100, true, now() - (g || ' minutes')::interval from generate_series(1, 250) g;

  insert into public.price_history (set_id, store_id, price_inr, in_stock, recorded_at)
  select '99999', 'rehearsal-s22', 100, true, now() - (g || ' minutes')::interval from generate_series(1, 3) g;

  -- 2 and 3. functions answer, within caps, testing store excluded
  set local role anon;

  select count(*) into n from public.get_set_prices('99999');
  if n <> 20 then raise exception 'CAP/FILTER: get_set_prices returned % rows, expected 20 (21 public, cap 20)', n; end if;

  select count(*) into n from public.get_price_history('99999', 1000);
  if n <> 200 then raise exception 'CAP: get_price_history returned % rows, expected 200', n; end if;

  select count(*) into testing_rows from public.get_price_history('99999', 1000) where store_id = 'rehearsal-s22';
  if testing_rows <> 0 then raise exception 'VISIBILITY: a testing store appeared in get_price_history (% rows)', testing_rows; end if;

  select count(*) into n from public.get_price_summaries(array(select g::text from generate_series(1, 200) g));
  if n > 150 then raise exception 'CAP: get_price_summaries returned % rows, cap 150', n; end if;

  reset role;

  -- cleanup (owner): the seed never reaches a later step
  delete from public.price_history where set_id = '99999';
  delete from public.store_prices where set_id = '99999';
  delete from public.stores where id like 'rehearsal-s%';

  raise notice 'anon expectations met: direct reads refused; functions answer within caps; testing store excluded';
end $$;

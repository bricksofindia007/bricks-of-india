-- Price read functions for the public key, and removal of the anonymous direct read on the two
-- price tables. Read-only. Each function runs with its owner's rights, so the anonymous role can
-- call it without a direct grant on the table. Rollback: supabase/rollbacks/20261017200000_price_read_functions.down.sql
--
-- Sizes are capped at what the migrated pages need (reviews detail: one set, its stores, its
-- 14-day stock events, its summary). Store visibility: a store is returned only while its registry
-- row has display_enabled = true. That switch is also the testing state: a store in testing has
-- display_enabled = false, so its prices are never returned here or shown on a page.

create or replace function public.get_set_prices(p_set_number text)
returns table (set_id text, store_id text, price_inr numeric, in_stock boolean, product_url text, scraped_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select sp.set_id, sp.store_id, sp.price_inr, sp.in_stock, sp.product_url, sp.scraped_at
  from public.store_prices sp
  join public.stores st on st.id = sp.store_id and st.display_enabled
  where sp.set_id = p_set_number
  order by sp.store_id
  limit 20
$$;

create or replace function public.get_price_history(p_set_number text, p_limit int default 200)
returns table (set_id text, store_id text, price_inr numeric, in_stock boolean, recorded_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select ph.set_id, ph.store_id, ph.price_inr, ph.in_stock, ph.recorded_at
  from public.price_history ph
  join public.stores st on st.id = ph.store_id and st.display_enabled
  where ph.set_id = p_set_number
  order by ph.recorded_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 200)
$$;

-- Summary row (reference price, discount tier, best store) for a list of sets. Reads the existing
-- set_price_summary view, which keeps display_enabled stores only and runs with its owner's rights.
create or replace function public.get_price_summaries(p_set_numbers text[])
returns setof public.set_price_summary
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.set_price_summary
  where set_id = any (p_set_numbers[1:150])
  limit 150
$$;

revoke all on function public.get_set_prices(text) from public;
revoke all on function public.get_price_history(text, int) from public;
revoke all on function public.get_price_summaries(text[]) from public;
grant execute on function public.get_set_prices(text) to anon, authenticated, service_role;
grant execute on function public.get_price_history(text, int) to anon, authenticated, service_role;
grant execute on function public.get_price_summaries(text[]) to anon, authenticated, service_role;

-- The anonymous direct read goes. service_role keeps its access (server pages).
revoke select on public.store_prices from anon, authenticated;
revoke select on public.price_history from anon, authenticated;

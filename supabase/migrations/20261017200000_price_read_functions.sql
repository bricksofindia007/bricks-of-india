-- Price read functions for the public key, and removal of the anonymous direct read on the two
-- price tables. Read-only. Each function runs with its owner's rights, so the anonymous role can
-- call it without a direct grant on the table. Rollback: supabase/rollbacks/20261017200000_price_read_functions.down.sql
-- Pages that read prices must move to these functions in the same release.

create or replace function public.get_set_prices(p_set_number text)
returns table (set_id text, store_id text, price_inr numeric, in_stock boolean, product_url text, scraped_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select sp.set_id, sp.store_id, sp.price_inr, sp.in_stock, sp.product_url, sp.scraped_at
  from public.store_prices sp
  where sp.set_id = p_set_number
  order by sp.store_id
  limit 50
$$;

create or replace function public.get_prices_for_sets(p_set_numbers text[])
returns table (set_id text, store_id text, price_inr numeric, in_stock boolean, product_url text, scraped_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select sp.set_id, sp.store_id, sp.price_inr, sp.in_stock, sp.product_url, sp.scraped_at
  from public.store_prices sp
  where sp.set_id = any (p_set_numbers[1:500])
  order by sp.set_id, sp.store_id
  limit 5000
$$;

create or replace function public.get_price_history(p_set_number text, p_limit int default 100)
returns table (set_id text, store_id text, price_inr numeric, in_stock boolean, recorded_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select ph.set_id, ph.store_id, ph.price_inr, ph.in_stock, ph.recorded_at
  from public.price_history ph
  where ph.set_id = p_set_number
  order by ph.recorded_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
$$;

-- Cheapest in-stock row per set (one row per set). Same rule as the reviews page: no sold-out fallback.
create or replace function public.get_best_prices_for_sets(p_set_numbers text[])
returns table (set_id text, store_id text, price_inr numeric, in_stock boolean, product_url text, scraped_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (sp.set_id) sp.set_id, sp.store_id, sp.price_inr, sp.in_stock, sp.product_url, sp.scraped_at
  from public.store_prices sp
  where sp.set_id = any (p_set_numbers[1:500])
    and sp.in_stock is true
    and sp.price_inr is not null
  order by sp.set_id, sp.price_inr asc, sp.store_id
  limit 500
$$;

-- Summary row (reference price, discount tier, best store) for a list of sets. Reads the existing
-- set_price_summary view, which runs with its owner's rights. Used by the reviews page and the summary helper.
create or replace function public.get_price_summaries(p_set_numbers text[])
returns setof public.set_price_summary
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.set_price_summary
  where set_id = any (p_set_numbers[1:500])
  limit 500
$$;

revoke all on function public.get_set_prices(text) from public;
revoke all on function public.get_prices_for_sets(text[]) from public;
revoke all on function public.get_price_history(text, int) from public;
revoke all on function public.get_best_prices_for_sets(text[]) from public;
revoke all on function public.get_price_summaries(text[]) from public;
grant execute on function public.get_set_prices(text) to anon, authenticated, service_role;
grant execute on function public.get_prices_for_sets(text[]) to anon, authenticated, service_role;
grant execute on function public.get_price_history(text, int) to anon, authenticated, service_role;
grant execute on function public.get_best_prices_for_sets(text[]) to anon, authenticated, service_role;
grant execute on function public.get_price_summaries(text[]) to anon, authenticated, service_role;

-- The anonymous direct read goes. service_role keeps its access (server pages).
revoke select on public.store_prices from anon, authenticated;
revoke select on public.price_history from anon, authenticated;

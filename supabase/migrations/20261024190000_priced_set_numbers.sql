-- Narrow source for the sitemap (B4 rework). Returns only the set numbers that have a store price above zero.
-- No price values, store names or product addresses are returned. Not applied: owner and Chat review first (G7, G8),
-- then a staging rehearsal and a backup before any production apply.
create or replace function public.priced_set_numbers()
returns table (set_number text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct s.set_number
  from public.sets s
  join public.store_prices sp on sp.set_id = s.set_number
  where sp.price_inr > 0;
$$;

revoke all on function public.priced_set_numbers() from public;
grant execute on function public.priced_set_numbers() to anon, authenticated;

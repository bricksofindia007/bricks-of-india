-- Rollback for 20261022180000_price_functions_service_only. Run by hand, in one transaction, only if the
-- service-role callers are reverted too. Restores the anon and authenticated execute grants from 17 and 18 Oct,
-- the get_distinct_themes grants, and the function bodies from before 25 Oct (silent cut at 150 sets).
grant execute on function public.get_set_prices(text) to anon, authenticated;
grant execute on function public.get_price_history(text, int) to anon, authenticated;
grant execute on function public.get_price_summary_for_set(text) to anon, authenticated;
grant execute on function public.get_last_seen_prices(text[]) to anon, authenticated;
grant execute on function public.get_usd_inr_rate() to anon, authenticated;
grant execute on function public.get_distinct_themes() to anon, authenticated;

create or replace function public.get_last_seen_prices(p_set_numbers text[])
returns table (set_id text, price_inr numeric, observed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (ph.set_id) ph.set_id::text, ph.price_inr, ph.recorded_at
  from public.price_history ph
  join public.stores st on st.id = ph.store_id and st.display_enabled
  where ph.set_id = any (p_set_numbers[1:150])
    and ph.price_inr is not null
  order by ph.set_id, ph.recorded_at desc
$$;

create or replace function public.get_price_summaries(p_set_numbers text[])
returns table (set_id text, deal_tier text)
language sql
stable
security definer
set search_path = ''
as $$
  select v.set_id::text, v.deal_tier::text
  from public.set_price_summary v
  where v.set_id = any (p_set_numbers[1:150])
  limit 150
$$;

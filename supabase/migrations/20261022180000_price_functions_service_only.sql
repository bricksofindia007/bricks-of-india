-- boi:issue B4 B12 (Bundle 3, queue item 2). NOT APPLIED: staging first, then production in a separate window.
-- Closes the five SECURITY DEFINER price functions that the anonymous and signed-in roles could call through the
-- public API: get_set_prices, get_price_history, get_price_summary_for_set, get_last_seen_prices, get_usd_inr_rate.
-- Execute is kept for service_role only. Every caller is server code (reviews page, last-seen route, rate reader,
-- price summary) and moves to the service-role server client in the same release.
-- Invoker rights would not work: the underlying tables (store_prices, price_history, usd_inr_rate) are closed to
-- the anonymous role by design (20261017270000), so a definer-free function would read nothing.
-- Rollback: supabase/rollbacks/20261022180000_price_functions_service_only.down.sql (restores the 17 Oct and 18 Oct grants
-- and the earlier function bodies).

revoke execute on function public.get_set_prices(text) from anon, authenticated;
revoke execute on function public.get_price_history(text, int) from anon, authenticated;
revoke execute on function public.get_price_summary_for_set(text) from anon, authenticated;
revoke execute on function public.get_last_seen_prices(text[]) from anon, authenticated;
revoke execute on function public.get_usd_inr_rate() from anon, authenticated;

grant execute on function public.get_set_prices(text) to service_role;
grant execute on function public.get_price_history(text, int) to service_role;
grant execute on function public.get_price_summary_for_set(text) to service_role;
grant execute on function public.get_last_seen_prices(text[]) to service_role;
grant execute on function public.get_usd_inr_rate() to service_role;

-- Added 25 Oct 2026 (order 1142). get_distinct_themes is server-only too: its one caller (the sets page) uses the
-- service-role client. The sets table keeps its public-read policy, so no public page depends on this grant.
revoke execute on function public.get_distinct_themes() from anon, authenticated;
grant execute on function public.get_distinct_themes() to service_role;

-- Added 25 Oct 2026. A list of more than 150 sets is an error, not a silent cut to the first 150. The route already
-- refuses more than 150 with a 400 before the call, so no user sees this error through the route.
create or replace function public.get_last_seen_prices(p_set_numbers text[])
returns table (set_id text, price_inr numeric, observed_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if cardinality(p_set_numbers) > 150 then
    raise exception 'at most 150 sets' using errcode = '22023';
  end if;
  return query
    select distinct on (ph.set_id) ph.set_id::text, ph.price_inr, ph.recorded_at
    from public.price_history ph
    join public.stores st on st.id = ph.store_id and st.display_enabled
    where ph.set_id = any (p_set_numbers)
      and ph.price_inr is not null
    order by ph.set_id, ph.recorded_at desc;
end
$$;

create or replace function public.get_price_summaries(p_set_numbers text[])
returns table (set_id text, deal_tier text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if cardinality(p_set_numbers) > 150 then
    raise exception 'at most 150 sets' using errcode = '22023';
  end if;
  return query
    select v.set_id::text, v.deal_tier::text
    from public.set_price_summary v
    where v.set_id = any (p_set_numbers);
end
$$;

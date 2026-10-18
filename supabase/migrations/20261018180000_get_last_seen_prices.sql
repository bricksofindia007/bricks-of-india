-- boi:issue 669
-- Last observed Indian price and its date, per set, for a batch of sets (at most 150). Used by My Collection's
-- retired-set line: "Last seen in India at ₹X (month, year)". Built as a SECURITY DEFINER function so that the
-- price history table itself is never readable by a browser role; only this function is.
-- Stores count only while display_enabled (the same switch every other price read uses).
-- Grants: identical to the existing price read functions (public revoked; anon, authenticated, service_role). NOT APPLIED.
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

-- Same grant as get_set_prices, get_price_history and get_price_summary_for_set in 20261017200000: public revoked,
-- execute to anon, authenticated and service_role. The function returns only the set, the price and the date.
revoke all on function public.get_last_seen_prices(text[]) from public;
grant execute on function public.get_last_seen_prices(text[]) to anon, authenticated, service_role;

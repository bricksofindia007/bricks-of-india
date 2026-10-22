-- boi:issue B4 B12 (Bundle 3, queue item 2). NOT APPLIED: staging first, then production in a separate window.
-- Closes the five SECURITY DEFINER price functions that the anonymous and signed-in roles could call through the
-- public API: get_set_prices, get_price_history, get_price_summary_for_set, get_last_seen_prices, get_usd_inr_rate.
-- Execute is kept for service_role only. Every caller is server code (reviews page, last-seen route, rate reader,
-- price summary) and moves to the service-role server client in the same release.
-- Invoker rights would not work: the underlying tables (store_prices, price_history, usd_inr_rate) are closed to
-- the anonymous role by design (20261017270000), so a definer-free function would read nothing.
-- Rollback: supabase/rollbacks/20261022180000_price_functions_service_only.down.sql (restores the 17 Oct and 18 Oct grants).

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

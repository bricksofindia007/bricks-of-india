-- Rollback for 20261022180000_price_functions_service_only. Run by hand, in one transaction, only if the
-- service-role callers are reverted too. Restores the anon and authenticated execute grants from 17 and 18 Oct.
grant execute on function public.get_set_prices(text) to anon, authenticated;
grant execute on function public.get_price_history(text, int) to anon, authenticated;
grant execute on function public.get_price_summary_for_set(text) to anon, authenticated;
grant execute on function public.get_last_seen_prices(text[]) to anon, authenticated;
grant execute on function public.get_usd_inr_rate() to anon, authenticated;

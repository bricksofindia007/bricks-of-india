-- Removes the anonymous and signed-in direct read on the two price tables. Applied AFTER the site deploy:
-- the live reviews page reads both tables with the public key until the deploy lands.
-- The price functions (20261017200000) carry the public reads from then on; service_role keeps its access.
-- Rollback: supabase/rollbacks/20261017270000_revoke_anon_price_table_reads.down.sql
revoke select on public.store_prices from anon, authenticated;
revoke select on public.price_history from anon, authenticated;

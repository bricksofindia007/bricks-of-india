-- boi:issue 455
-- boi:backup-tables public.stores, public.store_prices
-- boi:expect-before select count(*) from public.stores where id = 'mybrickhouse' and name = 'MyBrickHouse' and site_url = 'https://lego.mybrickhouse.com' = 1
-- boi:expect-after select (select count(*) from public.stores where id = 'mybrickhouse' and name = 'lego.in' and site_url = 'https://lego.in') + (select count(*) from public.store_prices where store_id = 'mybrickhouse' and product_url like 'https://lego.mybrickhouse.com/%') = 1
--
-- #455 (P14 round 5 item 3, AUTHORIZED by Abhinav): the store formerly at lego.mybrickhouse.com is
-- now lego.in (same LEGO Certified Store, new address). Registry display name -> "lego.in",
-- site_url -> https://lego.in, and outbound product links still on the old host move to the same
-- path on lego.in. The scraper already writes lego.in links (873 rows); 161 older rows (listings
-- no longer in the feed) still point at the old host (read-only count, 1 Oct 2026).
-- store_id stays 'mybrickhouse' (it's the key every table uses). scraper_config is not touched.
-- The after-assertion is written so it holds on staging (no seeded store_prices) and production alike.
-- No trigger fires: trg_price_history_on_change watches price_inr and in_stock only.

UPDATE public.stores
   SET name = 'lego.in', site_url = 'https://lego.in'
 WHERE id = 'mybrickhouse' AND name = 'MyBrickHouse';

UPDATE public.store_prices
   SET product_url = 'https://lego.in/' || substring(product_url from length('https://lego.mybrickhouse.com/') + 1)
 WHERE store_id = 'mybrickhouse' AND product_url LIKE 'https://lego.mybrickhouse.com/%';

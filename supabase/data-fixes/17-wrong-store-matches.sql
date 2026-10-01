-- boi:issue 17
-- boi:backup-tables public.store_prices, public.price_history
-- boi:expect-before select (select count(*) from public.store_prices where store_id = 'mybrickhouse' and set_id in ('1000','2022','3745','5000') and in_stock = false) + (select count(*) from public.price_history where store_id = 'mybrickhouse' and set_id in ('1000','2022','3745','5000')) = 12
-- boi:expect-after select (select count(*) from public.store_prices where store_id = 'mybrickhouse' and set_id in ('1000','2022','3745','5000')) + (select count(*) from public.price_history where store_id = 'mybrickhouse' and set_id in ('1000','2022','3745','5000')) = 0
-- (g) Catalogue Health: four LEGO.in rows from 25 Jun 2026 were matched to the wrong (vintage) set by a number in the
-- product title, and their set pages link to another product:
--   1000 "Mosaic Set"            -> technic-bmw-m-1000-rr-42130
--   2022 "Amy Elephant"          -> technic-2022-ford-gt-42154
--   3745 "Locomotive Black Bricks" -> ideas-dungeons-dragons-red-dragon-s-tale (...3745-pieces)
--   5000 "Replacement 4.5V Motor" -> icons-lamborghini-countach-5000-quattrovalvole-10337
-- G6: a wrong match is purged with its history, backup first. All four are out of stock and not in today's feed.
DELETE FROM public.price_history WHERE store_id = 'mybrickhouse' AND set_id IN ('1000','2022','3745','5000');
DELETE FROM public.store_prices WHERE store_id = 'mybrickhouse' AND set_id IN ('1000','2022','3745','5000') AND in_stock = false;

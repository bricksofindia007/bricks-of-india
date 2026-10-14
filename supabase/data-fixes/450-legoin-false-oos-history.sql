-- boi:issue 450
-- boi:backup-tables public.price_history
-- boi:expect-before select (select count(*) from public.price_history where store_id = 'mybrickhouse' and recorded_at = '2026-09-29T12:17:43.399+00:00' and in_stock = false) + (select count(*) from public.price_history r join (select distinct on (set_id) set_id, price_inr from public.price_history where store_id = 'mybrickhouse' and recorded_at < '2026-09-29T12:17:43.399+00:00' order by set_id, recorded_at desc) lb on lb.set_id = r.set_id and lb.price_inr = r.price_inr where r.store_id = 'mybrickhouse' and r.recorded_at = '2026-09-30T19:29:18.531+00:00' and r.in_stock = true and r.set_id in (select set_id from public.price_history where store_id = 'mybrickhouse' and recorded_at = '2026-09-29T12:17:43.399+00:00' and in_stock = false)) = 1591
-- boi:expect-after select (select count(*) from public.price_history where store_id = 'mybrickhouse' and recorded_at = '2026-09-29T12:17:43.399+00:00' and in_stock = false) + (select count(*) from public.price_history where store_id = 'mybrickhouse' and recorded_at = '2026-09-30T19:29:18.531+00:00') = 69
--
-- #450 (P14 D, APPROVED order by Abhinav): remove the 816 false out-of-stock history rows written
-- by scrape run 36567076036 (29 Sep 12:17:43.399 UTC; lego.mybrickhouse.com answered every variant
-- available:false to the runner's Accept-Language header) and the 775 restore rows (approved write,
-- run 36765750134, 30 Sep 19:29:18.531 UTC) that only undo them: same set, in stock, same price as
-- that set's last row before 12:17. Kept: 69 restore rows that are genuine changes observed at
-- 19:29 (40 on the same sets where the price changed as the Brick Rush sale ended -- 1 of them,
-- 60450, now out of stock -- and 29 on sets that weren't in the 816).
-- Read-only counts, 30 Sep ~19:40 UTC: 816 + 775 = 1,591 to delete; price_history 177,251 -> 175,660.
-- 854240 and 60450 are deleted with the rest (Abhinav's decision); their stock at 12:17 was not
-- established.

-- (2) first, because it identifies its rows through the (1) rows:
DELETE FROM public.price_history r
 USING (SELECT DISTINCT ON (set_id) set_id, price_inr
          FROM public.price_history
         WHERE store_id = 'mybrickhouse' AND recorded_at < '2026-09-29T12:17:43.399+00:00'
         ORDER BY set_id, recorded_at DESC) lb
 WHERE r.store_id = 'mybrickhouse'
   AND r.recorded_at = '2026-09-30T19:29:18.531+00:00'
   AND r.in_stock = true
   AND r.set_id = lb.set_id
   AND r.price_inr = lb.price_inr
   AND r.set_id IN (SELECT set_id FROM public.price_history
                     WHERE store_id = 'mybrickhouse'
                       AND recorded_at = '2026-09-29T12:17:43.399+00:00'
                       AND in_stock = false);

-- (1) the 816 false rows:
DELETE FROM public.price_history
 WHERE store_id = 'mybrickhouse'
   AND recorded_at = '2026-09-29T12:17:43.399+00:00'
   AND in_stock = false;

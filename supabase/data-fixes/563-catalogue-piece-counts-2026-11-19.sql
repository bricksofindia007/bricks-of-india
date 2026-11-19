-- boi:issue 563
-- boi:backup-tables public.sets
-- Catalogue piece counts (chat-confirmed, 19 Nov 2026): set 42704 is 1,406 (was 1,411); set 43258 is 572 (was 579).
-- Set 71819 is 1,212 in the catalogue already; not changed here. Only the pieces column changes.
-- The set pages read this column: public.set_page_data() selects from public.sets (baseline migration, function set_page_data).
-- boi:expect-before select case when (select count(*) from public.sets where set_number = '42704' and pieces = 1411) = 1 and (select count(*) from public.sets where set_number = '43258' and pieces = 579) = 1 then 2 else 0 end = 2
-- boi:expect-after select case when (select count(*) from public.sets where set_number = '42704' and pieces = 1406) = 1 and (select count(*) from public.sets where set_number = '43258' and pieces = 572) = 1 then 2 else 0 end = 2

UPDATE public.sets
SET pieces = 1406
WHERE set_number = '42704'
  AND pieces = 1411;

UPDATE public.sets
SET pieces = 572
WHERE set_number = '43258'
  AND pieces = 579;

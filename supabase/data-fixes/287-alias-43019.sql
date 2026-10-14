-- boi:issue 287
-- boi:backup-tables public.set_name_aliases
-- boi:expect-before select count(*) from public.set_name_aliases where set_number = '43019' = 0
-- boi:expect-after select count(*) from public.set_name_aliases where set_number = '43019' and alias_name = 'Soccer Ball' and approved_by = 'Abhinav' = 1
-- 43019 alias approved by Abhinav (P8 item 3, 28 Sep 2026). Needs migration 20260928120000_set_name_aliases.
INSERT INTO public.set_name_aliases (set_number, alias_name, source, evidence, approved_by, approved_at)
VALUES ('43019', 'Soccer Ball',
        'MyBrickHouse "Soccer Ball" (SKU 43019); Toycra "Lego 43019 Editions FIFA Soccer Ball (1498 Pieces)"',
        'catalogue 43019 = "Football", theme Editions, 1,498 pieces; Toycra title states 1498 pieces; both listings carry SKU/number 43019',
        'Abhinav', '2026-09-28T00:00:00Z');

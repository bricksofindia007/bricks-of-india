-- boi:issue 455
-- boi:backup-tables public.stores
-- boi:expect-before select count(*) from public.stores where id = 'mybrickhouse' and name = 'lego.in' = 1
-- boi:expect-after select count(*) from public.stores where id = 'mybrickhouse' and name = 'LEGO.in' = 1
-- Z1 (P14 round 7, Abhinav): the store's display name is "LEGO.in", its own spelling. URLs stay lowercase.
UPDATE public.stores SET name = 'LEGO.in' WHERE id = 'mybrickhouse' AND name = 'lego.in';

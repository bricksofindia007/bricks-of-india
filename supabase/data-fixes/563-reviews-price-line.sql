-- boi:issue 563
-- boi:backup-tables public.reviews
-- boi:expect-before select count(*) from public.reviews where content ~ 'Priced at ₹[0-9,]+ on .+?, confirmed in stock as of [^.]+\.' = 165
-- boi:expect-after select count(*) from public.reviews where content ~ 'Priced at ₹[0-9,]+ on .+?, confirmed in stock as of [^.]+\.' = 0

UPDATE public.reviews SET content = regexp_replace(content, 'Priced at ₹([0-9,]+) on (.+?), confirmed in stock as of [^.]+\.', 'At review, it was priced at ₹\1 on \2.', 'g') WHERE content ~ 'Priced at ₹[0-9,]+ on .+?, confirmed in stock as of [^.]+\.';

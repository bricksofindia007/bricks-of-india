-- boi:issue 563
-- boi:backup-tables public.reviews
-- boi:expect-before select count(*) from public.reviews where content like '%See live prices and stock on the [%' or content like '%It is sold in India — see live prices and stock on the [%' or content like '%LEGO.in and Toycra will likely stock it, but no live prices are available yet.%' = 22
-- boi:expect-after select count(*) from public.reviews where content like '%See live prices and stock on the [%' or content like '%It is sold in India — see live prices and stock on the [%' or content like '%LEGO.in and Toycra will likely stock it, but no live prices are available yet.%' = 0

UPDATE public.reviews SET content = replace(content, 'See live prices and stock on the [', 'We check prices daily. See prices and stock on the [') WHERE content LIKE '%See live prices and stock on the [%';
UPDATE public.reviews SET content = replace(content, 'It is sold in India — see live prices and stock on the [', 'It is sold in India. We check prices daily: see prices and stock on the [') WHERE content LIKE '%It is sold in India — see live prices and stock on the [%';
UPDATE public.reviews SET content = replace(content, 'LEGO.in and Toycra will likely stock it, but no live prices are available yet.', 'LEGO.in and Toycra will likely stock it, but we have no prices for it yet.') WHERE content LIKE '%LEGO.in and Toycra will likely stock it, but no live prices are available yet.%';

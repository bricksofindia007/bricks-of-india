-- boi:issue 563
-- boi:backup-tables public.guides
-- boi:expect-before select count(*) from public.guides where content like '%Check bricksofindia.com for live prices across LEGO.in and Toycra before any significant purchase.%' or content like '%We track India availability in real-time.%' or content like '%Check our Deals page for real-time India availability.%' = 2
-- boi:expect-after select count(*) from public.guides where content like '%Check bricksofindia.com for live prices across LEGO.in and Toycra before any significant purchase.%' or content like '%We track India availability in real-time.%' or content like '%Check our Deals page for real-time India availability.%' = 0

UPDATE public.guides SET content = replace(content, 'Check bricksofindia.com for live prices across LEGO.in and Toycra before any significant purchase.', 'Check bricksofindia.com for prices across LEGO.in and Toycra before any significant purchase; we check prices daily.') WHERE content LIKE '%Check bricksofindia.com for live prices across LEGO.in and Toycra before any significant purchase.%';
UPDATE public.guides SET content = replace(content, 'We track India availability in real-time.', 'We check India prices and availability daily.') WHERE content LIKE '%We track India availability in real-time.%';
UPDATE public.guides SET content = replace(content, 'Check our Deals page for real-time India availability.', 'Check our Deals page for India availability; we check prices daily.') WHERE content LIKE '%Check our Deals page for real-time India availability.%';

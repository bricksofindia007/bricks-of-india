-- boi:issue 714
-- boi:backup-tables public.stores
-- boi:expect-before select count(*) from public.stores where id = 'toycra' and affiliate_note = 'ABHINAV12 gives 12% off at Toycra; we earn a commission.' = 1
-- boi:expect-after select count(*) from public.stores where id = 'toycra' and affiliate_note = 'ABHINAV12 gets you 12% off at Toycra. It''s not a fortune. But neither is your bank balance. We cannot fix everything!' = 1
-- Changes the Toycra store note (shown on the which-set lab page). Touches only that row, and only while the old note is still there, so a re-run changes nothing.
update public.stores
set affiliate_note = 'ABHINAV12 gets you 12% off at Toycra. It''s not a fortune. But neither is your bank balance. We cannot fix everything!'
where id = 'toycra'
  and affiliate_note = 'ABHINAV12 gives 12% off at Toycra; we earn a commission.';

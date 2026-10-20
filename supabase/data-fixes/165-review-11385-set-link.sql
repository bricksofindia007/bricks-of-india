-- boi:issue 165
-- boi:backup-tables public.reviews
-- boi:expect-before select case when (select count(*) from public.sets where set_number = '11385') = 1 then (select count(*) from public.reviews where slug = 'lego-star-trek-uss-enterprise-ncc-1701-bridge-11385-worth-18' and set_id = (select id from public.sets where set_number = '1701')) else -1 end = 1
-- boi:expect-after select count(*) from public.reviews where slug = 'lego-star-trek-uss-enterprise-ncc-1701-bridge-11385-worth-18' and set_id = (select id from public.sets where set_number = '11385') = 1
-- Points the review at the one sets row numbered 11385. Only this review, only while it still points at 1701, so a re-run changes nothing.
update public.reviews
set set_id = (select id from public.sets where set_number = '11385')
where slug = 'lego-star-trek-uss-enterprise-ncc-1701-bridge-11385-worth-18'
  and set_id = (select id from public.sets where set_number = '1701')
  and (select count(*) from public.sets where set_number = '11385') = 1;

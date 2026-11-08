-- boi:issue 910
-- boi:backup-tables public.video_posts
-- boi:expect-before select count(*) from public.video_posts where story_number = 78 and set_number = '76269' and status = 'publish_blocked' = 1
-- boi:expect-after select count(*) from public.video_posts where story_number = 78 and set_number = '76269' and status = 'approved' = 1
-- Puts daily video story 78 (Avengers Tower, set 76269) back from publish_blocked to approved (order 0960, owner rule of 7 Nov 2026: stock status at one store never blocks a post). Only this row, and only its status. Its escalation note is kept as the record of the earlier hold.
update public.video_posts set status = 'approved' where story_number = 78 and set_number = '76269' and status = 'publish_blocked';

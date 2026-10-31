-- boi:issue 882
-- boi:backup-tables public.quiet_panic_posts
-- boi:expect-before select count(*) from public.quiet_panic_posts where id = '9facaca4-13fd-4d5a-b58a-807635ed6343' and status = 'pending_approval' and posted_at is null = 1
-- boi:expect-after select count(*) from public.quiet_panic_posts where id = '9facaca4-13fd-4d5a-b58a-807635ed6343' and status = 'approved' = 1
-- Approves the queued Wallace and Gromit video (QP 47, set 21371) for posting, as decided by the owner on 30 Oct 2026. The approved_at column is set by a trigger.
update public.quiet_panic_posts set status = 'approved' where id = '9facaca4-13fd-4d5a-b58a-807635ed6343' and status = 'pending_approval';

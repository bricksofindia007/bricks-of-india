-- boi:issue 836
-- boi:backup-tables public.quiet_panic_posts
-- boi:expect-before select count(*) from public.quiet_panic_posts where id = 'eefa64e5-a38b-4762-9eb3-78a3dd843efb' and status = 'pending_approval' and posted_at is null = 1
-- boi:expect-after select count(*) from public.quiet_panic_posts where id = 'eefa64e5-a38b-4762-9eb3-78a3dd843efb' and status = 'approved' = 1
-- Approves the queued Spinosaurus Dinosaur Escape video (set 77982) for posting. The approved_at column is set by a trigger.
update public.quiet_panic_posts set status = 'approved' where id = 'eefa64e5-a38b-4762-9eb3-78a3dd843efb' and status = 'pending_approval';

-- boi:issue 909
-- boi:backup-tables public.quiet_panic_posts
-- boi:expect-before select count(*) from public.quiet_panic_posts where id = 'a35e5054-632b-4f06-a0d4-69aa02d8dae6' and status = 'pending_approval' and posted_at is null = 1
-- boi:expect-after select count(*) from public.quiet_panic_posts where id = 'a35e5054-632b-4f06-a0d4-69aa02d8dae6' and status = 'approved' = 1
-- Approves the queued Quiet Panic video for set 77978 (Young T. rex Transport Truck, row 49) for posting, as decided by the owner. The approved_at column is set by a trigger.
update public.quiet_panic_posts set status = 'approved' where id = 'a35e5054-632b-4f06-a0d4-69aa02d8dae6' and status = 'pending_approval';

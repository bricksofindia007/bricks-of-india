-- boi:issue 716
-- boi:backup-tables public.quiet_panic_posts
-- boi:expect-before select count(*) from public.quiet_panic_posts where id = 'c8499079-28ca-44f2-93bf-d26f1b3b780e' and status = 'pending_approval' = 1
-- boi:expect-after select count(*) from public.quiet_panic_posts where id = 'c8499079-28ca-44f2-93bf-d26f1b3b780e' and status = 'approved' = 1
-- Approves one queued video post (Fun Halloween Skeleton, #30717) for the next publishing slot. Only this row, and only while it is still pending_approval.
-- approved_at is set by the database trigger trg_set_approved_at on the status change; the publisher selects status = 'approved' ordered by sequence_number.
update public.quiet_panic_posts
set status = 'approved'
where id = 'c8499079-28ca-44f2-93bf-d26f1b3b780e'
  and status = 'pending_approval';

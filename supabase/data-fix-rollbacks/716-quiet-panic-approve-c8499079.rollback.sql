-- Rollback for 716-quiet-panic-approve-c8499079. Run by hand, in one transaction, only when approved, and only before the publisher has picked the row up.
-- Restores status and approved_at from the backup the fix took first: boi_backups.public__quiet_panic_posts__<STAMP>. Only this row is touched.
-- Proof: the row must be pending_approval again with approved_at NULL (as before the fix).
begin;
update public.quiet_panic_posts q
set status = b.status,
    approved_at = b.approved_at
from boi_backups.public__quiet_panic_posts__<STAMP> b
where b.id = q.id
  and q.id = 'c8499079-28ca-44f2-93bf-d26f1b3b780e';
select count(*) = 1 as restored_pending
from public.quiet_panic_posts
where id = 'c8499079-28ca-44f2-93bf-d26f1b3b780e'
  and status = 'pending_approval'
  and approved_at is null;
commit;

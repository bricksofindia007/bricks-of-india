-- DRAFT rollback for data fix 142 (newsletter drafts dismissed). Not applied. Run by hand, in one transaction, only with Chat's OK.
-- Puts back the status of the same six drafts: pending_approval. Only rows that are currently 'dismissed' and are in the six ids.
-- The backup taken by the fix is named by the run's backup line: boi_backups.growth__newsletter_drafts__<STAMP> (<STAMP> from that line).
-- Proof: the status counts after the restore must equal the counts recorded before the fix (<PENDING_BEFORE> pending_approval, <DISMISSED_BEFORE> dismissed).
begin;
update growth.newsletter_drafts n
set status = b.status
from boi_backups.growth__newsletter_drafts__<STAMP> b
where b.id = n.id
  and n.id in ('6cf643ef-cb7f-43b3-b136-54f7b14e8174','d555dd2d-8c16-4dc3-9f62-d539287f27af','6429215b-6d0f-455e-862d-5c17c4e3f7d7','9611add1-d2e1-40f4-b526-cb8c72f0fc1e','b7dd1557-5de6-4685-ae31-c315715d255d','c0fa2e6b-bcd2-4578-bac4-407e0237375b')
  and n.status = 'dismissed';
select count(*) filter (where status = 'pending_approval') as pending_after,
       count(*) filter (where status = 'dismissed') as dismissed_after
from growth.newsletter_drafts
where id in ('6cf643ef-cb7f-43b3-b136-54f7b14e8174','d555dd2d-8c16-4dc3-9f62-d539287f27af','6429215b-6d0f-455e-862d-5c17c4e3f7d7','9611add1-d2e1-40f4-b526-cb8c72f0fc1e','b7dd1557-5de6-4685-ae31-c315715d255d','c0fa2e6b-bcd2-4578-bac4-407e0237375b');
-- If the counts above are not the recorded ones, ROLLBACK instead of COMMIT.
commit;

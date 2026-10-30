-- Rollback for data fix 142-newsletter-dismiss-six-pending (issue 142). Run by hand, in one transaction, only when approved.
-- Puts the six drafts back to pending_approval. Only these six ids, and only the ones still dismissed (a draft that was
-- changed by hand since is left alone). Nothing is deleted.
begin;
update growth.newsletter_drafts
set status = 'pending_approval'
where id in (
  '6429215b-6d0f-455e-862d-5c17c4e3f7d7',
  '6cf643ef-cb7f-43b3-b136-54f7b14e8174',
  '9611add1-d2e1-40f4-b526-cb8c72f0fc1e',
  'b7dd1557-5de6-4685-ae31-c315715d255d',
  'c0fa2e6b-bcd2-4578-bac4-407e0237375b',
  'd555dd2d-8c16-4dc3-9f62-d539287f27af'
)
  and status = 'dismissed';
select count(*) as back_to_pending
from growth.newsletter_drafts
where id in (
  '6429215b-6d0f-455e-862d-5c17c4e3f7d7',
  '6cf643ef-cb7f-43b3-b136-54f7b14e8174',
  '9611add1-d2e1-40f4-b526-cb8c72f0fc1e',
  'b7dd1557-5de6-4685-ae31-c315715d255d',
  'c0fa2e6b-bcd2-4578-bac4-407e0237375b',
  'd555dd2d-8c16-4dc3-9f62-d539287f27af'
)
  and status = 'pending_approval';
commit;

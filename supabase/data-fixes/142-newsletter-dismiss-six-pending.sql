-- boi:issue 142
-- boi:backup-tables growth.newsletter_drafts
-- boi:expect-before select count(*) from growth.newsletter_drafts where id in ('6cf643ef-cb7f-43b3-b136-54f7b14e8174','d555dd2d-8c16-4dc3-9f62-d539287f27af','6429215b-6d0f-455e-862d-5c17c4e3f7d7','9611add1-d2e1-40f4-b526-cb8c72f0fc1e','b7dd1557-5de6-4685-ae31-c315715d255d','c0fa2e6b-bcd2-4578-bac4-407e0237375b') and status = 'pending_approval' = 6
-- boi:expect-after select count(*) from growth.newsletter_drafts where id in ('6cf643ef-cb7f-43b3-b136-54f7b14e8174','d555dd2d-8c16-4dc3-9f62-d539287f27af','6429215b-6d0f-455e-862d-5c17c4e3f7d7','9611add1-d2e1-40f4-b526-cb8c72f0fc1e','b7dd1557-5de6-4685-ae31-c315715d255d','c0fa2e6b-bcd2-4578-bac4-407e0237375b') and status = 'dismissed' = 6
-- Sets the six approved pending drafts (Chat, 18:08 IST) to dismissed. Never archived: the status check has no archived value.
-- Only these six ids, only while they are still pending_approval. The two sent issues are not in the list and are not touched.
update growth.newsletter_drafts
set status = 'dismissed'
where id in ('6cf643ef-cb7f-43b3-b136-54f7b14e8174','d555dd2d-8c16-4dc3-9f62-d539287f27af','6429215b-6d0f-455e-862d-5c17c4e3f7d7','9611add1-d2e1-40f4-b526-cb8c72f0fc1e','b7dd1557-5de6-4685-ae31-c315715d255d','c0fa2e6b-bcd2-4578-bac4-407e0237375b')
  and status = 'pending_approval';

-- boi:issue 911
-- boi:backup-tables public.quiet_panic_posts
-- boi:expect-before select count(*) from public.quiet_panic_posts where id = 'c4af5037-27f9-40db-ab03-1825cb5f888b' and status = 'pending_approval' and reworked_from = '660c4b8f-9278-404e-9343-da305ec01769' = 1
-- boi:expect-after select count(*) from public.quiet_panic_posts where id = 'c4af5037-27f9-40db-ab03-1825cb5f888b' and status = 'approved' = 1
-- Approves the reworked Quiet Panic video for set 40812 (Snowman Ornaments) that replaces the rejected row 660c4b8f, as the owner approved in chat. Only this row, and only its status. The approved_at column is set by a trigger.
update public.quiet_panic_posts set status = 'approved' where id = 'c4af5037-27f9-40db-ab03-1825cb5f888b' and status = 'pending_approval' and reworked_from = '660c4b8f-9278-404e-9343-da305ec01769';

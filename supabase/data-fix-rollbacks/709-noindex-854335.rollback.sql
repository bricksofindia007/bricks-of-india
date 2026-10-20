-- Rollback for 709-noindex-854335. Run by hand, in one transaction, only when approved.
-- Restores noindex_override from the backup the fix took first: boi_backups.public__sets__<STAMP>.
-- Only the one row is touched. Proof: the row must be back to noindex_override = false.
begin;
update public.sets s
set noindex_override = b.noindex_override
from boi_backups.public__sets__<STAMP> b
where b.id = s.id
  and s.set_number = '854335';
select count(*) = 1 as restored_not_overridden
from public.sets
where set_number = '854335'
  and noindex_override = false;
commit;

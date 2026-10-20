-- Rollback for 714-toycra-store-note. Run by hand, in one transaction, only when approved.
-- Restores the Toycra store note from the backup the fix took first: boi_backups.public__stores__<STAMP>.
-- Only that one row is touched. Proof: the note must be the old text again.
begin;
update public.stores s
set affiliate_note = b.affiliate_note
from boi_backups.public__stores__<STAMP> b
where b.id = s.id
  and s.id = 'toycra';
select count(*) = 1 as restored_old_note
from public.stores
where id = 'toycra'
  and affiliate_note = 'ABHINAV12 gives 12% off at Toycra; we earn a commission.';
commit;

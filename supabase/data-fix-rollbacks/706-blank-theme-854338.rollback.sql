-- Rollback for 706-blank-theme-854338. Run by hand, in one transaction, only when approved.
-- Restores the set's theme from the backup the fix took first: boi_backups.public__sets__<STAMP>
-- (<STAMP> is the stamp printed by the run's backup line). Only the one row is touched.
-- Proof: the theme must be blank again, as before the fix.
begin;
update public.sets s
set theme = b.theme
from boi_backups.public__sets__<STAMP> b
where b.id = s.id
  and s.set_number = '854338';
select count(*) = 1 as restored_blank
from public.sets
where set_number = '854338'
  and (theme is null or theme in ('', 'Unknown'));
commit;

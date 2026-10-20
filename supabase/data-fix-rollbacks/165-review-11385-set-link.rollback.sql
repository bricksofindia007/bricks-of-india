-- Rollback for 165-review-11385-set-link. Run by hand, in one transaction, only when approved.
-- Restores the review's set_id from the backup the fix took first: boi_backups.public__reviews__<STAMP>
-- (<STAMP> is the stamp printed by the run's backup line). Only this one review is touched.
-- Proof: the review must point at the set numbered 1701 again, as before the fix.
begin;
update public.reviews r
set set_id = b.set_id
from boi_backups.public__reviews__<STAMP> b
where b.id = r.id
  and r.slug = 'lego-star-trek-uss-enterprise-ncc-1701-bridge-11385-worth-18';
select count(*) = 1 as restored_to_1701
from public.reviews
where slug = 'lego-star-trek-uss-enterprise-ncc-1701-bridge-11385-worth-18'
  and set_id = (select id from public.sets where set_number = '1701');
commit;

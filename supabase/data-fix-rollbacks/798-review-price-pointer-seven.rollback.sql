-- Rollback for data fix 798-review-price-pointer-seven (issue 798). Run by hand, in one transaction, only when approved.
-- Restores the seven review pages' content from the backup the fix took first: boi_backups.public__reviews__<STAMP>
-- (<STAMP> is the stamp printed by the run's backup line). Only these seven slugs are touched.
-- Proof: the content hash after the restore must equal the hash recorded before the fix (<HASH_BEFORE>).
begin;
update public.reviews r
set content = b.content
from boi_backups.public__reviews__<STAMP> b
where b.id = r.id
  and r.slug in (
    'lego-2-fast-2-furious-nissan-skyline-gt-r-r34-car-42210-wort',
    'lego-42172-mclaren-p1-review',
    'lego-airport-with-airplane-60502-worth-9999',
    'lego-alphabet-truck-10421-worth-3799',
    'lego-batman-forever-batmobile-76304-worth-10999',
    'lego-big-interactive-community-train-10428-worth-13749',
    'lego-dinosaur-fossils-triceratops-77985-worth-10999'
  );
select count(*) as restored_exact
from public.reviews r
join boi_backups.public__reviews__<STAMP> b on b.id = r.id
where r.slug in (
    'lego-2-fast-2-furious-nissan-skyline-gt-r-r34-car-42210-wort',
    'lego-42172-mclaren-p1-review',
    'lego-airport-with-airplane-60502-worth-9999',
    'lego-alphabet-truck-10421-worth-3799',
    'lego-batman-forever-batmobile-76304-worth-10999',
    'lego-big-interactive-community-train-10428-worth-13749',
    'lego-dinosaur-fossils-triceratops-77985-worth-10999'
  )
  and r.content = b.content;
commit;

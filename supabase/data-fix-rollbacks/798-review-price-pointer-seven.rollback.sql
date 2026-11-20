-- DRAFT rollback for data fix 798 (seven review pages: price sentences become pointers to the price box). Not applied.
-- Puts back the review text from the backup the fix took first: boi_backups.public__reviews__<STAMP> (<STAMP> from the run's backup line).
-- Only the seven slugs in the fix are touched. Warning: this restores their whole content field, so any correction made to these pages after the fix is lost. Check the pages first.
-- Proof: the restored rows must hash to the values recorded before the fix (<HASH_BEFORE>).
begin;
update public.reviews r
set content = b.content
from boi_backups.public__reviews__<STAMP> b
where b.id = r.id
  and r.slug in ('lego-2-fast-2-furious-nissan-skyline-gt-r-r34-car-42210-wort', 'lego-42172-mclaren-p1', 'lego-60502-airport-with-airplane', 'lego-76304-batman-forever-batmobile');
select md5(string_agg(content, '|' order by slug)) = '<HASH_BEFORE>' as restored_exactly
from public.reviews
where slug in ('lego-2-fast-2-furious-nissan-skyline-gt-r-r34-car-42210-wort', 'lego-42172-mclaren-p1', 'lego-60502-airport-with-airplane', 'lego-76304-batman-forever-batmobile');
-- If restored_exactly is not true, ROLLBACK instead of COMMIT.
commit;

-- Rollback draft for supabase/data-fixes/563-piece-counts-2026-11-19.sql. Run only if the forward fix must be undone.
-- boi:backup-tables public.reviews
-- Restores the three rows the forward fix changed, from the backup taken in the same window (boi_backups, name ends with the run stamp).
-- Replace <STAMP> with the backup's stamp before running.
update public.reviews r
set content = b.content
from boi_backups.public__reviews__<STAMP> b
where r.id = b.id
  and r.slug in ('lego-dragon-stone-shrine-71819-worth-11899', 'lego-heartlake-city-grand-hotel-42704-worth-15999', 'lego-kakamora-barge-43258-worth-10999')
  and r.content is distinct from b.content;
-- Rollback draft for supabase/data-fixes/563-catalogue-piece-counts-2026-11-19.sql. Run only if the forward fix must be undone.
-- boi:backup-tables public.sets
-- Replace <STAMP> with the backup's stamp before running. The backup is taken first (boi_backups.public__sets__<STAMP>).
update public.sets
set pieces = 1411
where set_number = '42704'
  and pieces = 1406;

update public.sets
set pieces = 579
where set_number = '43258'
  and pieces = 572;

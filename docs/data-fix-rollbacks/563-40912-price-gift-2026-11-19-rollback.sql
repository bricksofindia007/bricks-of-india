-- Rollback draft for supabase/data-fixes/563-40912-price-gift-2026-11-19.sql. Run only if the forward fix must be undone.
-- boi:backup-tables public.reviews
-- Restores the one row the forward fix changed, from the backup taken in the same window. Replace <STAMP> before running.
update public.reviews r
set content = b.content
from boi_backups.public__reviews__<STAMP> b
where r.id = b.id
  and r.slug = 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag'
  and r.content is distinct from b.content;
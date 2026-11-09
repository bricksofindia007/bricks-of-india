-- Rollback for data fix 911 (marker B on reviews with source_retailer null).
-- Removes exactly the marker paragraph that 911 added: a blank line, "*", the approved text, "*". Nothing else changes.
-- Run it on staging first, the same way as 911 (db-migrate fixes input), and only with the owner's approval.
-- boi:backup-tables public.reviews
-- boi:expect-before select count(*) from public.reviews where source_retailer is null and position($m$Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today's.$m$ in content) > 0
-- boi:expect-after select count(*) from public.reviews where position($m$Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today's.$m$ in content) > 0

UPDATE public.reviews
SET content = replace(content,
      E'\n\n*' || $m$Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today's.$m$ || '*',
      '')
WHERE source_retailer IS NULL
  AND position($m$Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today's.$m$ in content) > 0;

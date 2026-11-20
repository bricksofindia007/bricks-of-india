-- Data fix 911: marker B on the reviews where source_retailer is null (decision 5, option B, approved).
-- Owner approval: 8 Nov 2026, 14:21 to 14:41 IST (decision #5, exact text below). Placement per Chat, 8 Nov 2026.
-- Rule: the marker is its own italic paragraph, inserted directly after the first paragraph that contains a rupee figure.
-- A review with no rupee figure is skipped (the expect-after count below shows how many rows that is, per the run).
-- Rule R1: the inserted words are the approved text only; nothing else in the review changes.
-- Rule G16: the text is added, nothing is removed. Re-running is a no-op (the guard on the marker text).
-- Not run on any database by this change. Staging first, through the db-migrate fixes input; production only in its own window.
-- Rollback: docs/data-fix-rollbacks/911-marker-b-reviews-rollback.sql.
-- boi:issue 911
-- boi:backup-tables public.reviews
-- boi:expect-before select count(*) from public.reviews where source_retailer is null and position($m$Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today's.$m$ in content) > 0
-- boi:expect-after select (select count(*) from public.reviews where source_retailer is null and position($m$Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today's.$m$ in content) > 0) - (select count(*) from public.reviews where source_retailer is null and regexp_instr(content, '₹\s?[0-9]') > 0)
-- The before count must be 0 (no review holds the marker yet) and the source_retailer-null count must be 63.
-- The after count must be 0: every review with a rupee figure holds the marker once, and no other review does.

DO $fix$
DECLARE
  marker text := $m$Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today's.$m$;
  r record;
  p int;
  q int;
  body text;
BEGIN
  FOR r IN
    SELECT id, content FROM public.reviews
    WHERE source_retailer IS NULL AND position(marker in content) = 0
  LOOP
    -- p: position of the first rupee figure in the review (1-based).
    p := regexp_instr(r.content, '₹\s?[0-9]');
    CONTINUE WHEN p = 0;
    -- q: offset of the first blank line at or after p, counted from p. Its absolute position is p + q - 1.
    q := strpos(substr(r.content, p), E'\n\n');
    IF q = 0 THEN
      -- The rupee paragraph is the last one: the marker goes at the end.
      body := r.content || E'\n\n*' || marker || '*';
    ELSE
      -- End the rupee paragraph, add the marker as its own italic paragraph, then keep the rest unchanged.
      body := left(r.content, p + q - 2) || E'\n\n*' || marker || '*' || substr(r.content, p + q - 1);
    END IF;
    UPDATE public.reviews SET content = body WHERE id = r.id;
  END LOOP;
END
$fix$;

-- Replay of the corrected set, rolled back at the end. NOT RUN. Run only in the owner-approved window, after review.
begin;
-- boi:issue 563
-- boi:backup-tables public.reviews
-- Corrects piece counts in two reviews and one review's sentence on piece count (owner decision 20, 8 Nov 2026).
-- Only the first Heartlake page (42704) is in this file. The second Heartlake page (-2) already has the corrected count and no note; it is excluded.
-- boi:expect-before select case when (select count(*) from public.reviews where slug = 'lego-dragon-stone-shrine-71819-worth-11899' and position('708 pieces' in content) > 0) = 1 and (select count(*) from public.reviews where slug = 'lego-heartlake-city-grand-hotel-42704-worth-15999' and position('1,411' in content) > 0) = 1 and (select count(*) from public.reviews where slug = 'lego-kakamora-barge-43258-worth-10999' and position('579 pieces' in content) > 0) = 1 then 3 else 0 end = 3
-- boi:expect-after select case when (select count(*) from public.reviews where slug in ('lego-dragon-stone-shrine-71819-worth-11899', 'lego-heartlake-city-grand-hotel-42704-worth-15999', 'lego-kakamora-barge-43258-worth-10999') and (position('708 pieces' in content) > 0 or position('1,411' in content) > 0 or position('579 pieces' in content) > 0)) = 0 and (select count(*) from public.reviews where slug in ('lego-dragon-stone-shrine-71819-worth-11899', 'lego-heartlake-city-grand-hotel-42704-worth-15999', 'lego-kakamora-barge-43258-worth-10999') and position('Correction (8 November 2026): an earlier version of this review gave the wrong piece count' in content) > 0) = 3 then 3 else 0 end = 3

-- 71819: piece count 708 to 1,212 (two sentences), note appended once
UPDATE public.reviews
SET content = replace(replace(content,
      $q$You've got 708 pieces here$q$, $q$You've got 1,212 pieces here$q$),
      $q$The piece count is 708, still enough$q$, $q$The piece count is 1,212, still enough$q$)
      || $q$

*Correction (8 November 2026): an earlier version of this review gave the wrong piece count. It now matches the official count.*$q$
WHERE slug = 'lego-dragon-stone-shrine-71819-worth-11899'
  AND position('708 pieces' in content) > 0
  AND position('Correction (8 November 2026): an earlier version of this review gave the wrong piece count' in content) = 0;

-- 42704 first page only: 1,411 to 1,406 (two sentences), note appended once
UPDATE public.reviews
SET content = replace(replace(content,
      $q$you get 1,411 pieces of$q$, $q$you get 1,406 pieces of$q$),
      $q$At 1,411 pieces, this is$q$, $q$At 1,406 pieces, this is$q$)
      || $q$

*Correction (8 November 2026): an earlier version of this review gave the wrong piece count. It now matches the official count.*$q$
WHERE slug = 'lego-heartlake-city-grand-hotel-42704-worth-15999'
  AND position('1,411' in content) > 0
  AND position('Correction (8 November 2026): an earlier version of this review gave the wrong piece count' in content) = 0;

-- 43258: piece count 579 to 572 (one sentence, curly apostrophe as on the page), note appended once
UPDATE public.reviews
SET content = replace(content,
      $q$Itâ€™s got 579 pieces.$q$, $q$Itâ€™s got 572 pieces.$q$)
      || $q$

*Correction (8 November 2026): an earlier version of this review gave the wrong piece count. It now matches the official count.*$q$
WHERE slug = 'lego-kakamora-barge-43258-worth-10999'
  AND position('579 pieces' in content) > 0
  AND position('Correction (8 November 2026): an earlier version of this review gave the wrong piece count' in content) = 0;
-- boi:issue 563
-- boi:backup-tables public.reviews
-- Review 40912: the price in one sentence (owner decision 20B, option 2, current price) and the gift sentence (owner decision of 8 Nov 2026, 15:07 IST).
-- The slug, title, SEO title, excerpt and the US$180 lines are not changed.
-- boi:expect-before select case when (select count(*) from public.reviews where slug = 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag' and position('swing the â‚¹23,300 price tag' in content) > 0 and position('Itâ€™s a gift with purchase, so it has no Indian price of its own.' in content) > 0) = 1 then 1 else 0 end = 1
-- boi:expect-after select case when (select count(*) from public.reviews where slug = 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag' and (position('swing the â‚¹23,300 price tag' in content) > 0 or position('Itâ€™s a gift with purchase, so it has no Indian price of its own.' in content) > 0)) = 0 and (select count(*) from public.reviews where slug = 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag' and position('gave the wrong price and said the set had no Indian price' in content) > 0) = 1 then 1 else 0 end = 1

UPDATE public.reviews
SET content = replace(replace(content,
      $q$If you can swing the â‚¹23,300 price tag$q$, $q$If you can swing the â‚¹2,499 price tag$q$),
      $q$Itâ€™s a gift with purchase, so it has no Indian price of its own.$q$, $q$It started life as a gift with purchase, but LEGO.in now sells it on its own, no shopping spree required.$q$)
      || $q$

*Correction (8 November 2026): an earlier version of this review gave the wrong price and said the set had no Indian price. It now matches the current store price.*$q$
WHERE slug = 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag'
  AND position('swing the â‚¹23,300 price tag' in content) > 0
  AND position('gave the wrong price' in content) = 0;
-- boi:issue 563
-- boi:backup-tables public.sets
-- Catalogue piece counts (chat-confirmed, 19 Nov 2026): set 42704 is 1,406 (was 1,411); set 43258 is 572 (was 579).
-- Set 71819 is 1,212 in the catalogue already; not changed here. Only the pieces column changes.
-- The set pages read this column: public.set_page_data() selects from public.sets (baseline migration, function set_page_data).
-- boi:expect-before select case when (select count(*) from public.sets where set_number = '42704' and pieces = 1411) = 1 and (select count(*) from public.sets where set_number = '43258' and pieces = 579) = 1 then 2 else 0 end = 2
-- boi:expect-after select case when (select count(*) from public.sets where set_number = '42704' and pieces = 1406) = 1 and (select count(*) from public.sets where set_number = '43258' and pieces = 572) = 1 then 2 else 0 end = 2

UPDATE public.sets
SET pieces = 1406
WHERE set_number = '42704'
  AND pieces = 1411;

UPDATE public.sets
SET pieces = 572
WHERE set_number = '43258'
  AND pieces = 579;

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

-- Checks after the three fixes (run inside the same transaction)
select 'piece-count after' as check, count(*) as rows_with_old_text from public.reviews where slug in ('lego-dragon-stone-shrine-71819-worth-11899','lego-heartlake-city-grand-hotel-42704-worth-15999','lego-kakamora-barge-43258-worth-10999') and (position('708 pieces' in content) > 0 or position('1,411' in content) > 0 or position('579 pieces' in content) > 0);
select '40912 after' as check, count(*) as rows_with_old_text from public.reviews where slug = 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag' and (position('swing the â‚¹23,300 price tag' in content) > 0 or position('Itâ€™s a gift with purchase' in content) > 0);
select '911 marker after' as check, (select count(*) from public.reviews where source_retailer is null and position('Prices move faster than a minifig loses its hat.' in content) > 0) as null_source_with_marker, (select count(*) from public.reviews where source_retailer is null and content ~ 'â‚¹\s?[0-9]') as null_source_with_rupee;

select 'catalogue after' as check, (select pieces from public.sets where set_number = '42704') as pieces_42704, (select pieces from public.sets where set_number = '43258') as pieces_43258;

rollback;

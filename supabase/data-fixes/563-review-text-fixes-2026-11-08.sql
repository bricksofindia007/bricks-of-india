-- boi:issue 563
-- boi:backup-tables public.reviews
-- boi:expect-before select case when (select count(*) from public.reviews where slug = 'lego-dragon-stone-shrine-71819-worth-11899' and position('708 pieces' in content) > 0) = 1 and (select count(*) from public.reviews where slug in ('lego-heartlake-city-grand-hotel-42704-worth-15999', 'lego-heartlake-city-grand-hotel-42704-worth-15999-2') and position('Correction (8 November 2026): an earlier version of this review gave the wrong piece count' in content) = 0) = 2 and (select count(*) from public.reviews where slug = 'lego-kakamora-barge-43258-worth-10999' and position('579 pieces' in content) > 0) = 1 and (select count(*) from public.reviews where slug = 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag' and position('swing the ₹23,300 price tag' in content) > 0 and position('It’s a gift with purchase, so it has no Indian price of its own.' in content) > 0) = 1 then 5 else 0 end = 5
-- boi:expect-after select case when (select count(*) from public.reviews where slug = 'lego-dragon-stone-shrine-71819-worth-11899' and position('708 pieces' in content) > 0) = 0 and (select count(*) from public.reviews where slug in ('lego-heartlake-city-grand-hotel-42704-worth-15999', 'lego-heartlake-city-grand-hotel-42704-worth-15999-2') and position('1,411' in content) > 0) = 0 and (select count(*) from public.reviews where slug = 'lego-kakamora-barge-43258-worth-10999' and position('579 pieces' in content) > 0) = 0 and (select count(*) from public.reviews where slug = 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag' and (position('swing the ₹23,300 price tag' in content) > 0 or position('It’s a gift with purchase, so it has no Indian price of its own.' in content) > 0)) = 0 and (select count(*) from public.reviews where slug in ('lego-dragon-stone-shrine-71819-worth-11899', 'lego-heartlake-city-grand-hotel-42704-worth-15999', 'lego-heartlake-city-grand-hotel-42704-worth-15999-2', 'lego-kakamora-barge-43258-worth-10999', 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag') and position('Correction (8 November 2026): an earlier version of this review' in content) > 0) = 5 then 5 else 0 end = 5
--
-- Order 1580 item 3 (owner-approved 8 Nov 2026): piece counts (decision #20) and the 40912 price (decision #20B).
-- Rule R1: each replace() changes only the words named. Rule G16: a dated note is appended; nothing is removed.
-- Marker B (decision #5) is NOT in this file: data fix 911 owns it, and runs on its own.
-- Rewritten (21 Nov 2026) so the expect checks match the staging reviews: 5 rows change (71819, both 42704 pages, 43258, 40912).
-- The second 42704 page already holds the corrected count (1,406), so only its note is appended.
-- The 40912 gift sentence uses the curly apostrophe the reviews hold.
-- Re-running is a no-op: the note guard stops a second append.
-- NOT RUN. This file is prepared for the release 2 window only: staging first, then production in its own window.

-- 71819 lego-dragon-stone-shrine-71819-worth-11899 (1 review, 2 sentences)
UPDATE public.reviews
SET content = replace(replace(content,
      $q$You've got 708 pieces here$q$, $q$You've got 1,212 pieces here$q$),
      $q$The piece count is 708, still enough$q$, $q$The piece count is 1,212, still enough$q$)
      || $q$

*Correction (8 November 2026): an earlier version of this review gave the wrong piece count. It now matches the official count.*$q$
WHERE slug = 'lego-dragon-stone-shrine-71819-worth-11899'
  AND position('708 pieces' in content) > 0
  AND position('Correction (8 November 2026): an earlier version of this review gave the wrong piece count' in content) = 0;

-- 42704 lego-heartlake-city-grand-hotel-42704-worth-15999 and its second page (-2): both get the note; the count changes only where it is still 1,411.
UPDATE public.reviews
SET content = replace(replace(replace(content,
      $q$you get 1,411 pieces of$q$, $q$you get 1,406 pieces of$q$),
      $q$At 1,411 pieces, this is$q$, $q$At 1,406 pieces, this is$q$),
      $q$Heartlake City Grand Hotel has 1,411 pieces.$q$, $q$Heartlake City Grand Hotel has 1,406 pieces.$q$)
      || $q$

*Correction (8 November 2026): an earlier version of this review gave the wrong piece count. It now matches the official count.*$q$
WHERE slug IN ('lego-heartlake-city-grand-hotel-42704-worth-15999', 'lego-heartlake-city-grand-hotel-42704-worth-15999-2')
  AND position('Correction (8 November 2026): an earlier version of this review gave the wrong piece count' in content) = 0;

-- 43258 lego-kakamora-barge-43258-worth-10999 (1 review, 2 sentences)
UPDATE public.reviews
SET content = replace(replace(content,
      $q$It’s got 579 pieces.$q$, $q$It’s got 572 pieces.$q$),
      $q$Kakamora Barge has 579 pieces.$q$, $q$Kakamora Barge has 572 pieces.$q$)
      || $q$

*Correction (8 November 2026): an earlier version of this review gave the wrong piece count. It now matches the official count.*$q$
WHERE slug = 'lego-kakamora-barge-43258-worth-10999'
  AND position('579 pieces' in content) > 0
  AND position('Correction (8 November 2026): an earlier version of this review gave the wrong piece count' in content) = 0;

-- 40912 lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag. The slug, title, seo_title, excerpt and the US$180 lines are NOT changed (G16).
UPDATE public.reviews
SET content = replace(replace(content,
      $q$If you can swing the ₹23,300 price tag$q$, $q$If you can swing the ₹2,499 price tag$q$),
      $q$It’s a gift with purchase, so it has no Indian price of its own.$q$, $q$It started life as a gift with purchase, but LEGO.in now sells it on its own, no shopping spree required.$q$)
      || $q$

*Correction (8 November 2026): an earlier version of this review gave the wrong price and said the set had no Indian price. It now matches the current store price.*$q$
WHERE slug = 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag'
  AND position('swing the ₹23,300 price tag' in content) > 0
  AND position('Correction (8 November 2026): an earlier version of this review gave the wrong price' in content) = 0;

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
      $q$It’s got 579 pieces.$q$, $q$It’s got 572 pieces.$q$)
      || $q$

*Correction (8 November 2026): an earlier version of this review gave the wrong piece count. It now matches the official count.*$q$
WHERE slug = 'lego-kakamora-barge-43258-worth-10999'
  AND position('579 pieces' in content) > 0
  AND position('Correction (8 November 2026): an earlier version of this review gave the wrong piece count' in content) = 0;
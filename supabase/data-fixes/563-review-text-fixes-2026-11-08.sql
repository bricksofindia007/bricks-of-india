-- boi:issue 563
-- boi:backup-tables public.reviews
-- boi:expect-before select case when (select count(*) from public.reviews where slug = 'lego-dragon-stone-shrine-71819-worth-11899' and position('708 pieces' in content) > 0) = 1 and (select count(*) from public.reviews where slug in ('lego-heartlake-city-grand-hotel-42704-worth-15999', 'lego-heartlake-city-grand-hotel-42704-worth-15999-2') and position('1,411' in content) > 0) = 2 and (select count(*) from public.reviews where slug = 'lego-kakamora-barge-43258-worth-10999' and position('579 pieces' in content) > 0) = 1 and (select count(*) from public.reviews where slug = 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag' and position('swing the ₹23,300 price tag' in content) > 0 and position('It''s a gift with purchase, so it has no Indian price of its own.' in content) > 0) = 1 and (select count(*) from public.reviews where published_at is not null and published_at <= now() and coalesce(source_retailer, '') = '' and position('*Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today''s.*' in content) = 0) = 63 then 68 else 0 end = 68
-- boi:expect-after select case when (select count(*) from public.reviews where slug = 'lego-dragon-stone-shrine-71819-worth-11899' and position('708 pieces' in content) > 0) = 0 and (select count(*) from public.reviews where slug in ('lego-heartlake-city-grand-hotel-42704-worth-15999', 'lego-heartlake-city-grand-hotel-42704-worth-15999-2') and position('1,411' in content) > 0) = 0 and (select count(*) from public.reviews where slug = 'lego-kakamora-barge-43258-worth-10999' and position('579 pieces' in content) > 0) = 0 and (select count(*) from public.reviews where slug = 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag' and (position('swing the ₹23,300 price tag' in content) > 0 or position('It''s a gift with purchase, so it has no Indian price of its own.' in content) > 0)) = 0 and (select count(*) from public.reviews where published_at is not null and published_at <= now() and coalesce(source_retailer, '') = '' and (length(content) - length(replace(content, '*Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today''s.*', ''))) = length('*Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today''s.*')) = 63 then 63 else 0 end = 63
--
-- Order 1580 item 3 (owner-approved 8 Nov 2026): piece counts (decision #20), 40912 price (decision #20B), and marker B (decision #5).
-- Rule R1: each replace() changes only the words named. Rule G16: a dated note is appended; nothing is removed.
-- Expect-before counts the rows that still hold the old text (68 in total). Expect-after counts the same rows with the old text
-- gone and the marker in place exactly once (63 + 0 = 63). Re-running is a no-op: the note guard stops a second append and the
-- marker guard stops a second marker. The rollback restores the changed rows from the backup: docs/data-fix-rollbacks/.
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

-- 42704 lego-heartlake-city-grand-hotel-42704-worth-15999 and its second page (-2): 2 rows, 3 sentences each
UPDATE public.reviews
SET content = replace(replace(replace(content,
      $q$you get 1,411 pieces of$q$, $q$you get 1,406 pieces of$q$),
      $q$At 1,411 pieces, this is$q$, $q$At 1,406 pieces, this is$q$),
      $q$Heartlake City Grand Hotel has 1,411 pieces.$q$, $q$Heartlake City Grand Hotel has 1,406 pieces.$q$)
      || $q$

*Correction (8 November 2026): an earlier version of this review gave the wrong piece count. It now matches the official count.*$q$
WHERE slug IN ('lego-heartlake-city-grand-hotel-42704-worth-15999', 'lego-heartlake-city-grand-hotel-42704-worth-15999-2')
  AND position('1,411' in content) > 0
  AND position('Correction (8 November 2026): an earlier version of this review gave the wrong piece count' in content) = 0;

-- 43258 lego-kakamora-barge-43258-worth-10999 (1 review, 2 sentences)
UPDATE public.reviews
SET content = replace(replace(content,
      $q$It's got 579 pieces.$q$, $q$It's got 572 pieces.$q$),
      $q$Kakamora Barge has 579 pieces.$q$, $q$Kakamora Barge has 572 pieces.$q$)
      || $q$

*Correction (8 November 2026): an earlier version of this review gave the wrong piece count. It now matches the official count.*$q$
WHERE slug = 'lego-kakamora-barge-43258-worth-10999'
  AND position('579 pieces' in content) > 0
  AND position('Correction (8 November 2026): an earlier version of this review gave the wrong piece count' in content) = 0;

-- 40912 lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag (1 review). The slug, title, seo_title, excerpt and the US$180 lines are NOT changed (G16).
UPDATE public.reviews
SET content = replace(replace(content,
      $q$If you can swing the ₹23,300 price tag$q$, $q$If you can swing the ₹2,499 price tag$q$),
      $q$It's a gift with purchase, so it has no Indian price of its own.$q$, $q$It started life as a gift with purchase, but LEGO.in now sells it on its own, no shopping spree required.$q$)
      || $q$

*Correction (8 November 2026): an earlier version of this review gave the wrong price and said the set had no Indian price. It now matches the current store price.*$q$
WHERE slug = 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag'
  AND position('swing the ₹23,300 price tag' in content) > 0
  AND position('Correction (8 November 2026): an earlier version of this review gave the wrong price' in content) = 0;

-- Marker B (decision #5): the italic marker goes in as its own paragraph directly after the first paragraph that holds a
-- rupee figure. Paragraphs are split on a blank line (never on sentences, so "Mrs." is harmless). Rows that already hold the
-- marker are skipped. Target rows: published, and coalesce(source_retailer, '') = ''. The same algorithm is in
-- scripts/data-fix-logic/review-marker.mjs and is tested there; it has not been run against a database.
UPDATE public.reviews r
SET content = array_to_string(
      (t.paras)[1:t.idx]
      || ARRAY[$q$*Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today's.*$q$]
      || (t.paras)[t.idx + 1:array_length(t.paras, 1)],
      E'\n\n')
FROM (
  SELECT x.id, x.paras, x.idx
  FROM (
    SELECT r0.id,
           string_to_array(r0.content, E'\n\n') AS paras,
           (SELECT min(u.o) FROM unnest(string_to_array(r0.content, E'\n\n')) WITH ORDINALITY AS u(p, o) WHERE u.p ~ '₹\s?[0-9]') AS idx
    FROM public.reviews r0
    WHERE r0.published_at IS NOT NULL
      AND r0.published_at <= now()
      AND coalesce(r0.source_retailer, '') = ''
      AND position($q$*Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today's.*$q$ in r0.content) = 0
  ) x
  WHERE x.idx IS NOT NULL
) t
WHERE r.id = t.id;

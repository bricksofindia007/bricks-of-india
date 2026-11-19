-- boi:issue 563
-- boi:backup-tables public.reviews
-- Review 40912: the price in one sentence (owner decision 20B, option 2, current price) and the gift sentence (owner decision of 8 Nov 2026, 15:07 IST).
-- The slug, title, SEO title, excerpt and the US$180 lines are not changed.
-- boi:expect-before select case when (select count(*) from public.reviews where slug = 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag' and position('swing the ₹23,300 price tag' in content) > 0 and position('It’s a gift with purchase, so it has no Indian price of its own.' in content) > 0) = 1 then 1 else 0 end = 1
-- boi:expect-after select case when (select count(*) from public.reviews where slug = 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag' and (position('swing the ₹23,300 price tag' in content) > 0 or position('It’s a gift with purchase, so it has no Indian price of its own.' in content) > 0)) = 0 and (select count(*) from public.reviews where slug = 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag' and position('gave the wrong price and said the set had no Indian price' in content) > 0) = 1 then 1 else 0 end = 1

UPDATE public.reviews
SET content = replace(replace(content,
      $q$If you can swing the ₹23,300 price tag$q$, $q$If you can swing the ₹2,499 price tag$q$),
      $q$It’s a gift with purchase, so it has no Indian price of its own.$q$, $q$It started life as a gift with purchase, but LEGO.in now sells it on its own, no shopping spree required.$q$)
      || $q$

*Correction (8 November 2026): an earlier version of this review gave the wrong price and said the set had no Indian price. It now matches the current store price.*$q$
WHERE slug = 'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag'
  AND position('swing the ₹23,300 price tag' in content) > 0
  AND position('gave the wrong price' in content) = 0;
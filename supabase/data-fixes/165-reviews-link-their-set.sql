-- boi:issue 165
-- boi:backup-tables public.reviews
-- boi:expect-before select count(*) from public.reviews where set_id is null and slug in ('lego-don-donkey-kong-arcade-72051-worth-25700', 'lego-mini-hogwarts-castle-review-is-it-worth-your-wallets-sc') = 2
-- boi:expect-after select count(*) from public.reviews r join public.sets s on s.id = r.set_id where (r.slug, s.set_number) in (('lego-don-donkey-kong-arcade-72051-worth-25700', '72051'), ('lego-mini-hogwarts-castle-review-is-it-worth-your-wallets-sc', '40975')) = 2
-- #165 (round 6 C17): two reviews were never linked to their set, so their pages miss live prices. Link them to the one
-- catalogue row each title names (72051 Donkey Kong Arcade; 40975 Mini Hogwarts Castle, 2026). Text unchanged.
-- Not linked here (decision for chat): the Destiny's Bounty board game review (three catalogue rows match) and the
-- Build-a-Minifigure 2026 review (not a numbered set).
UPDATE public.reviews SET set_id = (SELECT id FROM public.sets WHERE set_number = '72051') WHERE slug = 'lego-don-donkey-kong-arcade-72051-worth-25700' AND set_id IS NULL;
UPDATE public.reviews SET set_id = (SELECT id FROM public.sets WHERE set_number = '40975') WHERE slug = 'lego-mini-hogwarts-castle-review-is-it-worth-your-wallets-sc' AND set_id IS NULL;

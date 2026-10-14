-- boi:issue 165
-- boi:backup-tables public.reviews
-- boi:expect-before select (select count(*) from public.reviews r join public.sets s on s.id = r.set_id where r.slug = 'lego-gremlins-gizmo-and-stripe-40919-worth-3300' and s.set_number = '21361') + (select count(*) from public.reviews r join public.sets s on s.id = r.set_id where r.slug = 'lego-darth-vaders-lightsaber-40897-worth-the-import-price' and s.set_number = '40483') + (select count(*) from public.reviews where slug = 'lego-ninjago-destinys-bounty-adventures-board-game-a-coopera' and set_id is null) = 3
-- boi:expect-after select count(*) from public.reviews r join public.sets s on s.id = r.set_id where (r.slug, s.set_number) in (('lego-gremlins-gizmo-and-stripe-40919-worth-3300', '40919'), ('lego-darth-vaders-lightsaber-40897-worth-the-import-price', '40897'), ('lego-ninjago-destinys-bounty-adventures-board-game-a-coopera', '12009')) = 3
-- Three reviews point at the set they review: two were linked to a different set, one to none.
-- (The Build-a-Minifigure 2026 review stays unlinked: the catalogue has no set for that product.)
UPDATE public.reviews SET set_id = (SELECT id FROM public.sets WHERE set_number = '40919')
WHERE slug = 'lego-gremlins-gizmo-and-stripe-40919-worth-3300' AND set_id = (SELECT id FROM public.sets WHERE set_number = '21361');
UPDATE public.reviews SET set_id = (SELECT id FROM public.sets WHERE set_number = '40897')
WHERE slug = 'lego-darth-vaders-lightsaber-40897-worth-the-import-price' AND set_id = (SELECT id FROM public.sets WHERE set_number = '40483');
UPDATE public.reviews SET set_id = (SELECT id FROM public.sets WHERE set_number = '12009')
WHERE slug = 'lego-ninjago-destinys-bounty-adventures-board-game-a-coopera' AND set_id IS NULL;

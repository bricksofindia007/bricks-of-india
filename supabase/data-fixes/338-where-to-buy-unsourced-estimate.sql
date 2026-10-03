-- boi:issue 338
-- boi:backup-tables public.guides
-- boi:expect-before select count(*) from public.guides where slug = 'where-to-buy-lego-india-2026' and position('Expect to pay 30-50% more than US prices for most sets.' in content) > 0 = 1
-- boi:expect-after select count(*) from public.guides where slug = 'where-to-buy-lego-india-2026' and position('Expect to pay 30-50% more than US prices for most sets.' in content) = 0 and position('Correction (3 October 2026)' in content) > 0 = 1
-- #338: no source exists for this estimate, so only that one sentence is removed, and a dated
-- correction note is added at the end.
UPDATE public.guides
SET content = replace(content, ' Expect to pay 30-50% more than US prices for most sets.', '')
             || E'\n\n*Correction (3 October 2026): we removed a line estimating how much more LEGO costs in India than in the US, because we could not point to a source for it.*'
WHERE slug = 'where-to-buy-lego-india-2026' AND position('Expect to pay 30-50% more than US prices for most sets.' in content) > 0;

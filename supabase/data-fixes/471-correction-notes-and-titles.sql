-- boi:issue 471
-- boi:backup-tables public.news_articles, public.reviews
-- boi:expect-before select (select count(*) from public.news_articles where title like '<%>' and seo_title like '<%>') + (select count(*) from public.news_articles where position('The promotion dates now follow Brickset''s set data' in content) > 0) + (select count(*) from public.reviews where slug in ('lego-sagrada-famlia-21065-worth-76400-2', 'lego-hanging-golden-pothos-11512-worth-estimated-import-pric', 'lego-arcade-pinball-machine-11374-worth-30000', 'lego-darth-vaders-lightsaber-40897-worth-the-import-price') and content ~ '(per Brickset\)|\(catalogue\)|\(Brickset\)\.|narrated an unnamed reviewer|because Brickset lists)') = 10
-- boi:expect-after select (select count(*) from public.news_articles where title like '<%' or seo_title like '<%') + (select count(*) from public.news_articles where position('Brickset''s set data' in content) > 0) + (select count(*) from public.reviews where content ~ '(per Brickset\)|Piece count corrected to [0-9,]+ \(catalogue\)|\(Brickset\)\.|narrated an unnamed reviewer|because Brickset lists)') = 0
-- Four article titles lose stray angle brackets. Five correction notes keep their facts and drop the wording about how they were checked.
UPDATE public.news_articles SET title = substr(title, 2, length(title) - 2) WHERE title LIKE '<%>';
UPDATE public.news_articles SET seo_title = substr(seo_title, 2, length(seo_title) - 2) WHERE seo_title LIKE '<%>';
UPDATE public.news_articles SET content = replace(content, 'The promotion dates now follow Brickset''s set data (21–30 September 2026)', 'The promotion dates are now correct (21–30 September 2026)')
WHERE position('The promotion dates now follow Brickset''s set data (21–30 September 2026)' in content) > 0;
UPDATE public.reviews SET content = replace(content, '(12,060, per Brickset)', '(12,060)')
WHERE slug = 'lego-sagrada-famlia-21065-worth-76400-2' AND position('(12,060, per Brickset)' in content) > 0;
UPDATE public.reviews SET content = replace(content, 'Piece count corrected to 372 (catalogue)', 'Piece count corrected to 372')
WHERE slug = 'lego-hanging-golden-pothos-11512-worth-estimated-import-pric' AND position('Piece count corrected to 372 (catalogue)' in content) > 0;
UPDATE public.reviews SET content = replace(content, 'Piece count corrected to 2,274 (catalogue)', 'Piece count corrected to 2,274')
WHERE slug = 'lego-arcade-pinball-machine-11374-worth-30000' AND position('Piece count corrected to 2,274 (catalogue)' in content) > 0;
UPDATE public.reviews SET content = replace(replace(replace(content,
    '40897 has 174 pieces (Brickset).', '40897 has 174 pieces.'),
    'restated the handgrip nitpick in our own voice (it had narrated an unnamed reviewer, and a claim about the 2021 Luke Skywalker lightsaber that rested on that reviewer was removed)', 'restated the handgrip nitpick, and removed an unsupported claim about the 2021 Luke Skywalker lightsaber'),
    'because Brickset lists 40897 as a LEGO.com gift with purchase with no retail price', 'because 40897 is a LEGO.com gift with purchase with no retail price')
WHERE slug = 'lego-darth-vaders-lightsaber-40897-worth-the-import-price' AND position('narrated an unnamed reviewer' in content) > 0;

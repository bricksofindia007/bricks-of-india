-- boi:issue 471
-- boi:backup-tables public.news_articles
-- boi:expect-before select count(*) from public.news_articles where slug = 'lego-brick-rush-sale-every-in-store-deal-and-whether-it-beat' and position('ABHINAV12 gets you 12% off full-price sets at Toycra ([Disclosure](/legal/affiliate-disclosure)).' in content) > 0 = 1
-- boi:expect-after select count(*) from public.news_articles where position('[Disclosure](/legal/affiliate-disclosure)' in content) > 0 = 0
-- Round 6 (3 Oct): the disclosure lives only on the legal pages. In the Brick Rush article's own sentence, remove only
-- " ([Disclosure](/legal/affiliate-disclosure))"; every other word stays.
UPDATE public.news_articles
SET content = replace(content, 'ABHINAV12 gets you 12% off full-price sets at Toycra ([Disclosure](/legal/affiliate-disclosure)).', 'ABHINAV12 gets you 12% off full-price sets at Toycra.')
WHERE slug = 'lego-brick-rush-sale-every-in-store-deal-and-whether-it-beat';

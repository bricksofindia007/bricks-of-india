-- boi:issue 563
-- boi:backup-tables public.news_articles
-- boi:expect-before select count(*) from public.news_articles where slug = 'lego-investment-india-2026' and content like '%not a live price quote for any single set%' = 1
-- boi:expect-after select count(*) from public.news_articles where slug = 'lego-investment-india-2026' and (content like '%not a live price quote for any single set%' or content like '%check current retail prices and stock at MyBrickHouse and Toycra%') = 0

UPDATE public.news_articles SET content = replace(replace(content, 'not a live price quote for any single set', 'not a price quote for any single set'), 'check current retail prices and stock at MyBrickHouse and Toycra', 'check current retail prices and stock at LEGO.in and Toycra') WHERE slug = 'lego-investment-india-2026' AND content LIKE '%not a live price quote for any single set%';

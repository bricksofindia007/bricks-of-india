-- boi:issue 176
-- boi:backup-tables public.news_articles
-- boi:expect-before select (select count(*) from public.news_articles where slug = 'lego-pick-a-brick-2026-new-elements-arriving-september-1st' and hero_image = '/lego-news-fallback.png') + (select count(*) from public.news_articles where slug = 'lego-pick-a-brick-2026-over-1800-elements-being-retired' and hero_image like 'https://blogger.googleusercontent.com/%') = 2
-- boi:expect-after select (select count(*) from public.news_articles where slug = 'lego-pick-a-brick-2026-new-elements-arriving-september-1st' and hero_image = '/news/pick-a-brick-september.png') + (select count(*) from public.news_articles where slug = 'lego-pick-a-brick-2026-over-1800-elements-being-retired' and hero_image = '/news/pick-a-brick-retiring.png') = 2
-- Two more Pick a Brick articles get their own top image (one showed the generic fallback, one an image that doesn't load).
UPDATE public.news_articles SET hero_image = '/news/pick-a-brick-september.png'
WHERE slug = 'lego-pick-a-brick-2026-new-elements-arriving-september-1st' AND hero_image = '/lego-news-fallback.png';
UPDATE public.news_articles SET hero_image = '/news/pick-a-brick-retiring.png'
WHERE slug = 'lego-pick-a-brick-2026-over-1800-elements-being-retired' AND hero_image LIKE 'https://blogger.googleusercontent.com/%';

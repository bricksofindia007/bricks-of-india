-- boi:issue 176
-- boi:backup-tables public.news_articles
-- boi:expect-before select count(*) from public.news_articles where slug = 'lego-pick-a-brick-2026-adds-over-100-new-elements-this-augus' and hero_image = '/lego-news-fallback.png' = 1
-- boi:expect-after select count(*) from public.news_articles where slug = 'lego-pick-a-brick-2026-adds-over-100-new-elements-this-augus' and hero_image = '/news/pick-a-brick.png' = 1
-- #176 (round 6 C18): this article never had a real top image (it always showed the generic fallback). It gets BOI's own
-- Pick a Brick card (public/news/pick-a-brick.png, drawn bricks, no third-party image). Text unchanged.
UPDATE public.news_articles SET hero_image = '/news/pick-a-brick.png'
WHERE slug = 'lego-pick-a-brick-2026-adds-over-100-new-elements-this-augus' AND hero_image = '/lego-news-fallback.png';

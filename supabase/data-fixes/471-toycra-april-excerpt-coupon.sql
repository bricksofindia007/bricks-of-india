-- boi:issue 471
-- boi:backup-tables public.news_articles
-- boi:expect-before select count(*) from public.news_articles where slug = 'new-lego-sets-toycra-april-2026' and position('Use code ABHINAV12 for 12% off everything.' in excerpt) > 0 and position('Use code ABHINAV12 for 12% off everything.' in seo_description) > 0 = 1
-- boi:expect-after select count(*) from public.news_articles where position('12% off everything' in coalesce(excerpt, '') || coalesce(seo_description, '')) > 0 = 0
-- The April Toycra article's summary and search description gave the coupon wrongly.
-- Only that exact sentence changes, to the standard full-price wording.
UPDATE public.news_articles
SET excerpt = replace(excerpt, 'Use code ABHINAV12 for 12% off everything.', 'Code ABHINAV12 takes 12% off full-price sets at Toycra, minimum order ₹500.'),
    seo_description = replace(seo_description, 'Use code ABHINAV12 for 12% off everything.', 'Code ABHINAV12 takes 12% off full-price sets at Toycra, minimum order ₹500.')
WHERE slug = 'new-lego-sets-toycra-april-2026';

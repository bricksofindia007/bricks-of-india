-- boi:issue 339
-- boi:backup-tables public.news_articles
-- boi:expect-before select count(*) from public.news_articles where slug = 'flipkart-big-billion-days-lego-44-sets-checked' and (length(content) - length(replace(content, 'the MCL39 is the one where the strikethrough is working harder than the discount.', ''))) / length('the MCL39 is the one where the strikethrough is working harder than the discount.') = 1 and position('Every price below is reported' in content) = 0 = 1
-- boi:expect-after select count(*) from public.news_articles where slug = 'flipkart-big-billion-days-lego-44-sets-checked' and position('the MCL39 is the one where the strikethrough is working harder than the discount.' || chr(10) || chr(10) || 'Every price below is reported, unconfirmed: confirm on sale day.' || chr(10) || chr(10) || '| Set | Flipkart' in content) > 0 = 1
-- Adds one paragraph after the paragraph that ends before the first table. Only the one article, and only where the line is not yet present, so a re-run changes nothing.
update public.news_articles
set content = replace(
  content,
  'the MCL39 is the one where the strikethrough is working harder than the discount.',
  'the MCL39 is the one where the strikethrough is working harder than the discount.' || chr(10) || chr(10) || 'Every price below is reported, unconfirmed: confirm on sale day.')
where slug = 'flipkart-big-billion-days-lego-44-sets-checked'
  and position('Every price below is reported' in content) = 0;

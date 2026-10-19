-- boi:issue 339
-- boi:backup-tables public.news_articles
-- boi:expect-before select count(*) from public.news_articles where slug = 'the-lego-donkey-kong-arcade-2000-now-playable-by-machine' and (length(content) - length(replace(content, '₹17,999 at both MyBrickHouse and Toycra when we wrote this.', ''))) / length('₹17,999 at both MyBrickHouse and Toycra when we wrote this.') = 1 and position('Use code ABHINAV12' in content) = 0
-- boi:expect-after select count(*) from public.news_articles where slug = 'the-lego-donkey-kong-arcade-2000-now-playable-by-machine' and position('₹17,999 at both MyBrickHouse and Toycra when we wrote this. Use code ABHINAV12 at Toycra for 12% off (min. ₹500).' in content) = 1
-- Adds one sentence after the price sentence. Only the one article, and only where the code is not yet present, so a re-run changes nothing.
update public.news_articles
set content = replace(
  content,
  '₹17,999 at both MyBrickHouse and Toycra when we wrote this.',
  '₹17,999 at both MyBrickHouse and Toycra when we wrote this. Use code ABHINAV12 at Toycra for 12% off (min. ₹500).')
where slug = 'the-lego-donkey-kong-arcade-2000-now-playable-by-machine'
  and position('Use code ABHINAV12' in content) = 0;

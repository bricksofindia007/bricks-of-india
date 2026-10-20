-- Rollback for 339-flipkart-reported-line. Run by hand, in one transaction, only when approved.
-- Restores the article's content from the backup the fix took first: boi_backups.public__news_articles__<STAMP>
-- (<STAMP> is the stamp printed by the run's backup line). Only this one article is touched.
-- Proof: the content hash after the restore must equal the hash recorded before the fix (<HASH_BEFORE>).
begin;
update public.news_articles n
set content = b.content
from boi_backups.public__news_articles__<STAMP> b
where b.id = n.id
  and n.slug = 'flipkart-big-billion-days-lego-44-sets-checked';
select md5(content) = '<HASH_BEFORE>' as restored_exactly
from public.news_articles
where slug = 'flipkart-big-billion-days-lego-44-sets-checked';
commit;

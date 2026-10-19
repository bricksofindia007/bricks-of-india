-- Staging only. Adds fixture copies of three articles and one review, so the article data fixes (339) and the review
-- link fix (165) can be rehearsed with their real assertions on a database that may not hold them.
--
-- * Inserts a row only where the slug is absent. An existing row is never changed or deleted.
-- * Every fixture row carries the marker 'FIXTURE STAGING ONLY' in excerpt, so it can be found and removed.
-- * The article text contains only the sentences the fixes anchor on, plus fixture wording. Nothing else is copied.
-- * Refuses to run unless sets 1701 and 11385 both exist, because the review fixture links to them.
-- * Idempotent: a second run inserts nothing.
begin;

do $$
declare
  n integer;
begin
  select count(*) into n from public.sets where set_number in ('1701', '11385');
  if n < 2 then
    raise exception 'seed: sets 1701 and 11385 must both exist on this database; stopped, nothing written';
  end if;
end $$;

insert into public.news_articles (title, slug, content, category, excerpt)
select 'Fixture article (staging only)',
       'the-lego-donkey-kong-arcade-2000-now-playable-by-machine',
       'Fixture article. Staging only. ₹17,999 at both MyBrickHouse and Toycra when we wrote this.',
       'New Sets', 'FIXTURE STAGING ONLY'
where not exists (select 1 from public.news_articles where slug = 'the-lego-donkey-kong-arcade-2000-now-playable-by-machine');

insert into public.news_articles (title, slug, content, category, excerpt)
select 'Fixture article (staging only)',
       'flipkart-big-billion-days-lego-44-sets-checked',
       E'Fixture article. Staging only.\n\nFixture paragraph. the MCL39 is the one where the strikethrough is working harder than the discount.\n\n| Set | Flipkart | Flipkart MRP | Cheapest elsewhere | Verdict |\n|---|---|---|---|---|\n| Fixture | - | - | - | - |',
       'New Sets', 'FIXTURE STAGING ONLY'
where not exists (select 1 from public.news_articles where slug = 'flipkart-big-billion-days-lego-44-sets-checked');

insert into public.reviews (set_id, title, slug, content, verdict, rating, excerpt)
select (select id from public.sets where set_number = '1701' limit 1),
       'Fixture review (staging only)',
       'lego-star-trek-uss-enterprise-ncc-1701-bridge-11385-worth-18',
       'Fixture body. Staging only.',
       'WAIT', 3, 'FIXTURE STAGING ONLY'
where not exists (select 1 from public.reviews where slug = 'lego-star-trek-uss-enterprise-ncc-1701-bridge-11385-worth-18');

do $$
declare
  a integer;
  r integer;
begin
  select count(*) into a from public.news_articles where excerpt = 'FIXTURE STAGING ONLY';
  select count(*) into r from public.reviews where excerpt = 'FIXTURE STAGING ONLY';
  raise notice 'seed: fixture articles %, fixture reviews %', a, r;
end $$;

commit;

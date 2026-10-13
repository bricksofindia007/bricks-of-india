-- HOLD (a). Wording approved by chat (P21b final, 13 Oct 2026). Guards filled from md5-guards-2026-10-13.txt. RAISE below stays until the staging rehearsal passes.
-- Change only: "see live prices and stock on the" -> "see prices and stock on the" in news_articles.content.
-- Published articles: G16 needs a dated correction note, chat to say whether this edit needs one.
-- Ids from chat: ae1fbb91-7fc2-4efa-9909-9d7df4386dab, 98464e3a-7138-4eec-9892-0d879dce4cf0, 60ea5620-dd2f-4794-91bb-7cd10be05c9d.
-- Pages carrying the phrase (slugs from the live site; NOT verified against these ids, check in the DB pull):
--   lego-captain-america-vs-red-hulk-battle-76292-worth-5949
--   lego-the-windmill-farm-21262-worth-5949
--   lego-tiger-31217-worth-6399
-- Live page check: each page shows the phrase once in the article body (the page source repeats it once more in the page-data payload).
-- boi:issue 568
-- boi:backup-tables public.news_articles
-- boi:expect-before select count(*) from public.news_articles where (id::text, md5(content)) in (values ('ae1fbb91-7fc2-4efa-9909-9d7df4386dab','f44cff77bb183376ec695ae6fa67a5d6'), ('98464e3a-7138-4eec-9892-0d879dce4cf0','b7a849fb600519d6cc60b5154b643bfd'), ('60ea5620-dd2f-4794-91bb-7cd10be05c9d','6fc2d1c5ff77293665916936ef5cebe5')) = 3
-- boi:expect-after  select count(*) from public.news_articles where id::text in ('ae1fbb91-7fc2-4efa-9909-9d7df4386dab','98464e3a-7138-4eec-9892-0d879dce4cf0','60ea5620-dd2f-4794-91bb-7cd10be05c9d') and content like '%see prices and stock on the%' and content not like '%see live prices and stock on the%' = 3

DO $$ BEGIN RAISE EXCEPTION 'HOLD (a): awaiting chat confirmation. Do not run.'; END $$;

update public.news_articles
set content = replace(content, 'see live prices and stock on the', 'see prices and stock on the')
where (id::text, md5(content)) in (values ('ae1fbb91-7fc2-4efa-9909-9d7df4386dab','f44cff77bb183376ec695ae6fa67a5d6'), ('98464e3a-7138-4eec-9892-0d879dce4cf0','b7a849fb600519d6cc60b5154b643bfd'), ('60ea5620-dd2f-4794-91bb-7cd10be05c9d','6fc2d1c5ff77293665916936ef5cebe5'))
  and (length(content) - length(replace(content, 'see live prices and stock on the', ''))) = length('see live prices and stock on the');

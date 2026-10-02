-- boi:issue 455
-- boi:backup-tables public.news_articles, public.reviews, public.guides
-- boi:expect-before select (select count(*) from public.news_articles where content like $p$%Updated 1 Oct 2026: MyBrickHouse's online store is now LEGO.in.%$p$) + (select count(*) from public.reviews where content like $p$%Updated 1 Oct 2026: MyBrickHouse's online store is now LEGO.in.%$p$) + (select count(*) from public.guides where content like $p$%Updated 1 Oct 2026: MyBrickHouse's online store is now LEGO.in.%$p$) + (select count(*) from public.guides where slug = 'history-of-lego-in-india' and content like $p$%LEGO.in, which operates the certified store, remains%$p$) + (select count(*) from public.guides where slug = 'what-is-lego-beginners-guide-india' and content like $p$%LEGO.in (LEGO's only certified retail partner in India).%$p$) + (select count(*) from public.guides where slug = 'how-to-buy-lego-india' and content like $p$%LEGO.in is LEGO's only certified retail partner in India. They opened%$p$) + (select count(*) from public.guides where slug = 'where-to-buy-lego-india-2026' and content like $p$%LEGO.in (LEGO.in.in)%$p$) = 694
-- boi:expect-after select (select count(*) from public.news_articles where content like $p$%Updated 1 Oct 2026: MyBrickHouse's online store is now LEGO.in.%$p$) + (select count(*) from public.reviews where content like $p$%Updated 1 Oct 2026: MyBrickHouse's online store is now LEGO.in.%$p$) + (select count(*) from public.guides where content like $p$%Updated 1 Oct 2026: MyBrickHouse's online store is now LEGO.in.%$p$) + (select count(*) from public.news_articles where content like $p$%LEGO.in.in%$p$) + (select count(*) from public.guides where content like $p$%LEGO.in.in%$p$) + abs(218 - (select count(*) from public.reviews where content like $p$%Updated 2 Oct 2026: MyBrickHouse's online store is now LEGO.in.%$p$) - (select count(*) from public.guides where content like $p$%Updated 2 Oct 2026: MyBrickHouse's online store is now LEGO.in.%$p$)) = 0
-- Correction of fix 455 (applied to production 2 Oct 2026 05:27 UTC without chat's sample review; run 36968785112).
-- Chat's rule (round 8 item 4b): news articles keep their text (only links change; none linked to MyBrickHouse);
-- evergreen pages (reviews, guides) say LEGO.in with "Updated <date>: MyBrickHouse's online store is now LEGO.in."
-- 1. News (472): title, excerpt, SEO fields and content restored from the newest in-database backup taken before
--    455 (production: boi_backups.public__news_articles__20261002T052725, seconds before; the backup chosen is the
--    newest one with no 455 note, so staging uses its own pre-455 backup). 471 of 472 bodies were also recovered
--    byte-for-byte offline and match 455's recorded checksums.
-- 2. Evergreen (204 reviews, 14 guides): the note's date corrected to the day it landed, 2 Oct 2026.
-- 3. Four guide lines where 455 renamed the COMPANY (MyBrickHouse runs the Certified Stores; LEGO.in is its online
--    store) or broke a domain ("LEGO.in (LEGO.in.in)").
DO $$
DECLARE
  cand record;
  chosen text;
  n int;
BEGIN
  FOR cand IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'boi_backups' AND table_name LIKE 'public\_\_news\_articles\_\_%'
    ORDER BY table_name DESC
  LOOP
    EXECUTE format('SELECT count(*) FROM boi_backups.%I WHERE content LIKE %L', cand.table_name,
                   '%Updated 1 Oct 2026: MyBrickHouse''s online store is now LEGO.in.%') INTO n;
    IF n = 0 THEN chosen := cand.table_name; EXIT; END IF;
  END LOOP;
  IF chosen IS NULL THEN RAISE EXCEPTION 'no pre-455 news_articles backup found in boi_backups'; END IF;
  RAISE NOTICE 'restoring news from boi_backups.%', chosen;
  EXECUTE format($q$
    UPDATE public.news_articles n
       SET title = b.title, excerpt = b.excerpt, seo_title = b.seo_title,
           seo_description = b.seo_description, content = b.content
      FROM boi_backups.%I b
     WHERE b.id = n.id
       AND n.content LIKE %L
       AND b.content NOT LIKE %L
  $q$, chosen,
     '%Updated 1 Oct 2026: MyBrickHouse''s online store is now LEGO.in.%',
     '%Updated 1 Oct 2026: MyBrickHouse''s online store is now LEGO.in.%');
END $$;

UPDATE public.reviews
   SET content = replace(content, $o$Updated 1 Oct 2026: MyBrickHouse's online store is now LEGO.in.$o$,
                                  $n$Updated 2 Oct 2026: MyBrickHouse's online store is now LEGO.in.$n$)
 WHERE content LIKE $p$%Updated 1 Oct 2026: MyBrickHouse's online store is now LEGO.in.%$p$;

UPDATE public.guides
   SET content = replace(content, $o$Updated 1 Oct 2026: MyBrickHouse's online store is now LEGO.in.$o$,
                                  $n$Updated 2 Oct 2026: MyBrickHouse's online store is now LEGO.in.$n$)
 WHERE content LIKE $p$%Updated 1 Oct 2026: MyBrickHouse's online store is now LEGO.in.%$p$;

UPDATE public.guides SET content = replace(content,
  $o$LEGO.in, which operates the certified store, remains$o$,
  $n$MyBrickHouse, which operates the certified store and the LEGO.in online store, remains$n$)
 WHERE slug = 'history-of-lego-in-india';

UPDATE public.guides SET content = replace(content,
  $o$LEGO.in (LEGO's only certified retail partner in India).$o$,
  $n$LEGO.in (the online store of MyBrickHouse, LEGO's only certified retail partner in India).$n$)
 WHERE slug = 'what-is-lego-beginners-guide-india';

UPDATE public.guides SET content = replace(content,
  $o$LEGO.in is LEGO's only certified retail partner in India. They opened$o$,
  $n$MyBrickHouse, which runs LEGO.in, is LEGO's only certified retail partner in India. They opened$n$)
 WHERE slug = 'how-to-buy-lego-india';

UPDATE public.guides SET content = replace(content,
  $o$LEGO.in (LEGO.in.in)$o$,
  $n$LEGO.in (lego.in)$n$)
 WHERE slug = 'where-to-buy-lego-india-2026';

-- boi:issue 446
-- P12 (30 Sep 2026, Tier 2): anon and authenticated read only PUBLISHED rows of news_articles,
-- reviews and guides. Before this, anon read every row (USING (true)), and two extra permissive
-- policies -- "public read" on reviews (a duplicate) and "public can read guides" (every role) --
-- would have kept every row readable even with the anon policy narrowed (permissive policies OR).
--
-- Published = published_at IS NOT NULL AND published_at <= now(). These tables have no status
-- column; drafts live in pending_drafts. Production had 0 unpublished rows when this was written
-- (493 / 205 / 27), so no reader loses a row today.
--
-- Unchanged, on purpose:
--   * "ci_readonly seed read" USING (true) -- the staging seed copies every row (#443).
--   * BYPASSRLS roles never see policies: service_role (sitemap, the homepage's price reads,
--     publish-draft, lint, scripts, snapshot publisher, set_page_data), growth_service (newsletter),
--     postgres.
--   * Nothing signs in as authenticated today; it gets the same published-only rule anyway.
--
-- Guard against cached "not found" pages: a BEFORE INSERT OR UPDATE trigger on all three tables
-- rejects published_at more than 5 minutes in the future (a trigger, not a CHECK: now() isn't
-- immutable). publish-draft.ts refuses the same.
--
-- Rollback:
--   DROP TRIGGER reject_future_published_at ON public.news_articles;  (same on reviews, guides)
--   DROP FUNCTION public.reject_future_published_at();
--   DROP POLICY "published read" ON public.news_articles;  (same on reviews, guides)
--   CREATE POLICY "Public read news_articles" ON public.news_articles FOR SELECT TO anon USING (true);
--   CREATE POLICY "Public read reviews" ON public.reviews FOR SELECT TO anon USING (true);
--   CREATE POLICY "public read" ON public.reviews FOR SELECT TO anon USING (true);
--   CREATE POLICY "Public read guides" ON public.guides FOR SELECT TO anon USING (true);
--   CREATE POLICY "public can read guides" ON public.guides FOR SELECT USING (true);

DROP POLICY "Public read news_articles" ON public.news_articles;
DROP POLICY "Public read reviews" ON public.reviews;
DROP POLICY "public read" ON public.reviews;
DROP POLICY "Public read guides" ON public.guides;
DROP POLICY "public can read guides" ON public.guides;

CREATE POLICY "published read" ON public.news_articles FOR SELECT TO anon, authenticated
  USING (published_at IS NOT NULL AND published_at <= now());
CREATE POLICY "published read" ON public.reviews FOR SELECT TO anon, authenticated
  USING (published_at IS NOT NULL AND published_at <= now());
CREATE POLICY "published read" ON public.guides FOR SELECT TO anon, authenticated
  USING (published_at IS NOT NULL AND published_at <= now());

CREATE FUNCTION public.reject_future_published_at() RETURNS trigger
  LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.published_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION '%.published_at % is in the future: rows here are published immediately (no scheduling), and a future date would 404 and be cached (#446)',
      TG_TABLE_NAME, NEW.published_at USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.reject_future_published_at() FROM PUBLIC;

CREATE TRIGGER reject_future_published_at BEFORE INSERT OR UPDATE OF published_at ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION public.reject_future_published_at();
CREATE TRIGGER reject_future_published_at BEFORE INSERT OR UPDATE OF published_at ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reject_future_published_at();
CREATE TRIGGER reject_future_published_at BEFORE INSERT OR UPDATE OF published_at ON public.guides
  FOR EACH ROW EXECUTE FUNCTION public.reject_future_published_at();

-- The only read policies left on the three tables: "published read" (anon, authenticated) and
-- "ci_readonly seed read". Anything else means a permissive rule is still open -- roll back.
DO $$
DECLARE extra text;
BEGIN
  SELECT string_agg(tablename || ': ' || policyname, ', ') INTO extra
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('news_articles', 'reviews', 'guides') AND cmd IN ('SELECT', 'ALL')
    AND policyname NOT IN ('published read', 'ci_readonly seed read');
  IF extra IS NOT NULL THEN
    RAISE EXCEPTION 'unexpected read policies remain: % -- rolling back', extra;
  END IF;
END $$;

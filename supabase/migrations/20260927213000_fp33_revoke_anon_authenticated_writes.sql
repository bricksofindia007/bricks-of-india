-- FP3.3 (#275, P5 decision 2, 27 Sep 2026): revoke table-write privileges from anon and
-- authenticated on the 32 public objects that still carried them (30 tables, 2 views).
--
-- Why: defence in depth (G8). Nothing was exploitable (RLS on every table; the only write
-- policies matching these roles are service_role-only or the newsletter insert), but one
-- permissive policy added later would have opened writes immediately.
--
-- Keep/revoke, per object: REVOKE everything except SELECT, for both roles, on all 32.
-- SELECT grants are untouched (public reads keep working exactly as before).
--   * No real write path runs as anon or authenticated:
--       - every site write (newsletter signup, contact, admin actions, webhook) uses
--         createServerClient() = service_role (src/app/actions/newsletter.ts etc.);
--       - scripts/pipelines use the service key; accounts (authenticated) don't exist yet.
--   * pg_stat_statements since 11 Apr: the only anon writes ever executed were 39 UPDATEs
--     of news_articles/blog_posts.hero_image by scripts/populate-article-images.mjs falling
--     back to the anon key; RLS made them silent no-ops (fixed in the same PR: service key
--     required).
--   * newsletter_subscribers: anon INSERT is NOT kept -- the signup Server Action inserts
--     as service_role. The always-true policy "Public insert newsletter" is dropped too
--     (inert without the grant; clears the Security Advisor warning).
-- Future objects: postgres's default privileges in public already exclude anon and
-- authenticated (#195); supabase_admin's defaults can't be changed by postgres.
--
-- Applied: staging first, then production (Tier 2, ACL backup first).
-- Rollback: boi-db-backups/<date>-fp33/acl_before.csv holds every object's relacl; re-GRANT
-- from it (or: GRANT INSERT, UPDATE, DELETE ON <obj> TO anon, authenticated;
-- CREATE POLICY "Public insert newsletter" ON newsletter_subscribers FOR INSERT WITH CHECK (true);).

DO $$
DECLARE
  objs text[] := ARRAY[
    'blog_posts','catalog_coverage_trend','cmf_figures','community_spotlights','content_fix_log',
    'content_image_registry','content_quality_issues','content_quality_issues_archive',
    'content_rejection_reminders','content_rejections','featured_videos','generator_runs','guides',
    'image_repair_queue','news_articles','newsletter_subscribers','opinion_cadence_log','pending_drafts',
    'pending_drafts_lint_results_backup_20260620','posted_lego_sets','posted_sets','price_history',
    'price_snapshots','quiet_panic_posts','raw_signals','reviews','sets','social_automation_heartbeat',
    'store_prices','video_posts','v_published_articles_public','v_scan_batch_health'];
  o text;
  sel_before int; sel_after int; left_over int;
BEGIN
  SELECT count(*) INTO sel_before FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p','v','m')
     AND (has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('authenticated', c.oid, 'SELECT'));

  FOREACH o IN ARRAY objs LOOP
    IF to_regclass('public.' || quote_ident(o)) IS NULL THEN
      RAISE EXCEPTION 'FP3.3: public.% does not exist -- list out of date, rolling back', o;
    END IF;
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.%I FROM anon, authenticated', o);
  END LOOP;

  SELECT count(*) INTO left_over FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p','v','m')
     AND (has_table_privilege('anon', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE')
          OR has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE'));
  IF left_over <> 0 THEN
    RAISE EXCEPTION 'FP3.3: % public objects still writable by anon/authenticated -- rolling back', left_over;
  END IF;

  SELECT count(*) INTO sel_after FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p','v','m')
     AND (has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('authenticated', c.oid, 'SELECT'));
  IF sel_after <> sel_before THEN
    RAISE EXCEPTION 'FP3.3: SELECT grants changed (% -> %) -- rolling back', sel_before, sel_after;
  END IF;
  RAISE NOTICE 'FP3.3: writes revoked on % objects; 0 writable left; SELECT unchanged (% objects)', array_length(objs, 1), sel_after;
END $$;

DROP POLICY IF EXISTS "Public insert newsletter" ON public.newsletter_subscribers;

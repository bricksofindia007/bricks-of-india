-- boi:issue 529
-- Removes public (anon) and signed-in (authenticated) access to tables, views and functions the site
-- never reads with the public key. The site's own public reads are unchanged.
-- Rollback (run in this order):
--   GRANT SELECT ON public.stores, public.price_snapshots, public.v_scan_batch_health, public.pending_drafts,
--     public.pending_drafts_lint_results_backup_20260620, public.raw_signals, public.generator_runs,
--     public.content_quality_issues, public.content_quality_issues_archive, public.content_fix_log,
--     public.content_image_registry, public.content_rejections, public.content_rejection_reminders,
--     public.image_repair_queue, public.opinion_cadence_log, public.catalog_coverage_trend, public.posted_sets,
--     public.posted_lego_sets, public.quiet_panic_posts, public.video_posts, public.social_automation_heartbeat,
--     public.newsletter_subscribers TO anon, authenticated;
--   CREATE POLICY "Public read enabled stores" ON public.stores FOR SELECT TO anon USING (display_enabled);
--   CREATE POLICY "Public read price_snapshots" ON public.price_snapshots FOR SELECT TO anon USING (true);
--   CREATE POLICY price_snapshots_anon_select ON public.price_snapshots FOR SELECT TO anon USING (true);
--   GRANT EXECUTE ON FUNCTION <each function revoked below, e.g. public.reject_video_post(uuid,text)> TO PUBLIC;

REVOKE ALL ON public.stores, public.price_snapshots, public.v_scan_batch_health, public.pending_drafts,
  public.pending_drafts_lint_results_backup_20260620, public.raw_signals, public.generator_runs,
  public.content_quality_issues, public.content_quality_issues_archive, public.content_fix_log,
  public.content_image_registry, public.content_rejections, public.content_rejection_reminders,
  public.image_repair_queue, public.opinion_cadence_log, public.catalog_coverage_trend, public.posted_sets,
  public.posted_lego_sets, public.quiet_panic_posts, public.video_posts, public.social_automation_heartbeat,
  public.newsletter_subscribers
  FROM anon, authenticated;

DROP POLICY IF EXISTS "Public read enabled stores" ON public.stores;
DROP POLICY IF EXISTS "Public read price_snapshots" ON public.price_snapshots;
DROP POLICY IF EXISTS price_snapshots_anon_select ON public.price_snapshots;

-- App functions: EXECUTE comes from the default PUBLIC grant, so it is revoked from PUBLIC and given back
-- to service_role only. Trigger functions keep working (triggers don't check EXECUTE when they fire).
-- get_distinct_themes stays (the /sets page calls it with the public key); extension functions are untouched.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY['assign_quiet_panic_sequence_number','assign_story_number','check_qp_posts_title_consistency',
        'check_video_posts_title_consistency','classify_rejection_reason','clear_regeneration_priority_on_requeue',
        'compute_index_tier','reconcile_page_load_errors','reject_video_post','sync_index_tier_for_set',
        'trg_sync_index_tier_on_sets','trg_sync_index_tier_on_store_prices','trg_sync_index_tier_on_store_prices_delete',
        'update_updated_at'])
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

-- Self-check: any access left for anon/authenticated on the listed relations, or EXECUTE on the listed
-- functions, rolls the whole migration back.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(r || ':' || role, ', ') INTO bad FROM (
    SELECT c.relname AS r, x.role FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated')) x(role)
    WHERE n.nspname = 'public' AND c.relname = ANY (ARRAY['stores','price_snapshots','v_scan_batch_health','pending_drafts',
      'pending_drafts_lint_results_backup_20260620','raw_signals','generator_runs','content_quality_issues',
      'content_quality_issues_archive','content_fix_log','content_image_registry','content_rejections',
      'content_rejection_reminders','image_repair_queue','opinion_cadence_log','catalog_coverage_trend','posted_sets',
      'posted_lego_sets','quiet_panic_posts','video_posts','social_automation_heartbeat','newsletter_subscribers'])
      AND (has_table_privilege(x.role, c.oid, 'SELECT') OR has_table_privilege(x.role, c.oid, 'INSERT')
        OR has_table_privilege(x.role, c.oid, 'UPDATE') OR has_table_privilege(x.role, c.oid, 'DELETE'))
    UNION ALL
    SELECT p.proname, x.role FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated')) x(role)
    WHERE n.nspname = 'public' AND p.proname = ANY (ARRAY['assign_quiet_panic_sequence_number','assign_story_number',
      'check_qp_posts_title_consistency','check_video_posts_title_consistency','classify_rejection_reason',
      'clear_regeneration_priority_on_requeue','compute_index_tier','reconcile_page_load_errors','reject_video_post',
      'sync_index_tier_for_set','trg_sync_index_tier_on_sets','trg_sync_index_tier_on_store_prices',
      'trg_sync_index_tier_on_store_prices_delete','update_updated_at'])
      AND has_function_privilege(x.role, p.oid, 'EXECUTE')
  ) s;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'lockdown incomplete: %', bad; END IF;
  IF NOT has_function_privilege('anon', 'public.get_distinct_themes()', 'EXECUTE') THEN
    RAISE EXCEPTION 'get_distinct_themes must stay callable with the public key';
  END IF;
  IF NOT has_table_privilege('anon', 'public.sets', 'SELECT') OR NOT has_table_privilege('anon', 'public.store_prices', 'SELECT')
     OR NOT has_table_privilege('anon', 'public.v_published_articles_public', 'SELECT') THEN
    RAISE EXCEPTION 'site public reads must stay';
  END IF;
END $$;

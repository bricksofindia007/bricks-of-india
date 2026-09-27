-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260927150105, name fp31_search_path_and_invoker, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- FP3.1 (#273, P0.9 intake): fix two Security Advisor (splinter) findings from
-- the 27 Sep 2026 scan (boi-db-backups\2026-09-27-fp3.0\splinter_after_2026-09-27.csv).
--
-- 1. anon/authenticated_security_definer_function_executable:
--    public.get_distinct_themes() was SECURITY DEFINER and executable by anon and
--    authenticated via /rest/v1/rpc/get_distinct_themes. Nothing needs the
--    elevation: it only reads public.sets, which has a public-read RLS policy for
--    anon ("Public read sets"; anon sees all 422 themes as itself), and both real
--    callers (src/app/sets/page.tsx, scripts/technical-hygiene.mjs) use the
--    service role. -> SECURITY INVOKER, pinned search_path, and PUBLIC's default
--    EXECUTE revoked; the explicit anon/authenticated/service_role grants stay.
--    Note: the sets policy covers anon only, so an `authenticated` caller would
--    now get an empty list; no such caller exists (auth unused). Revisit with
--    the accounts work.
--
-- 2. function_search_path_mutable (13 more functions): each gets an explicit
--    search_path. `public, pg_temp` is the minimal path they need: every table
--    and function their bodies reference is in public (checked statically:
--    sets, store_prices, video_posts, quiet_panic_posts, content_rejections,
--    news_articles, reviews, guides, blog_posts, content_quality_issues,
--    compute_index_tier); none uses an extension function. pg_temp is listed
--    LAST so temporary objects can never shadow them. (`''` would require
--    rewriting all 13 bodies to schema-qualify every reference.)
--
-- Backup first: boi-db-backups\2026-09-27-fp3.1\functions_before.sql (all 14
-- definitions) and functions_acl_before.json. Applied with psql in one
-- transaction with assertions, then recorded in schema_migrations (same G7
-- exception as FP3.0/FP5.7, #197).
--
-- Rollback:
--   CREATE OR REPLACE FUNCTION public.get_distinct_themes()
--     RETURNS TABLE(theme text) LANGUAGE sql STABLE SECURITY DEFINER AS $$
--     SELECT DISTINCT s.theme FROM sets s WHERE s.theme IS NOT NULL AND s.theme <> '' ORDER BY s.theme; $$;
--   GRANT EXECUTE ON FUNCTION public.get_distinct_themes() TO PUBLIC;
--   ALTER FUNCTION <each of the 13 below> RESET search_path;

CREATE OR REPLACE FUNCTION public.get_distinct_themes()
 RETURNS TABLE(theme text)
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path = public, pg_temp
AS $function$
  SELECT DISTINCT s.theme
  FROM   sets s
  WHERE  s.theme IS NOT NULL
    AND  s.theme <> ''
  ORDER  BY s.theme;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_distinct_themes() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_distinct_themes() TO anon, authenticated, service_role;

ALTER FUNCTION public.update_updated_at()                                   SET search_path = public, pg_temp;
ALTER FUNCTION public.reconcile_page_load_errors()                          SET search_path = public, pg_temp;
ALTER FUNCTION public.classify_rejection_reason(text)                       SET search_path = public, pg_temp;
ALTER FUNCTION public.reject_video_post(uuid, text)                         SET search_path = public, pg_temp;
ALTER FUNCTION public.clear_regeneration_priority_on_requeue()              SET search_path = public, pg_temp;
ALTER FUNCTION public.compute_index_tier(text, text, integer, boolean)      SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_index_tier_for_set(text)                         SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_sync_index_tier_on_sets()                         SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_sync_index_tier_on_store_prices()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_sync_index_tier_on_store_prices_delete()          SET search_path = public, pg_temp;
ALTER FUNCTION public.assign_quiet_panic_sequence_number()                  SET search_path = public, pg_temp;
ALTER FUNCTION public.check_video_posts_title_consistency()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.check_qp_posts_title_consistency()                    SET search_path = public, pg_temp;

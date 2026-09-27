-- Explicit Data API grants for every table this repo's migrations create
-- (issue #182, 2026-09-24).
--
-- Why: from 2026-10-30 Supabase stops auto-granting anon/authenticated/
-- service_role on NEW public tables -- including tables re-created by
-- `supabase db reset` and preview branches from these migrations. None of
-- the 16 CREATE TABLEs below carried a GRANT; they all relied on the default
-- privileges. On production this migration is a no-op (every grant below
-- already exists via those defaults, verified 2026-09-24); it exists so a
-- replay of this directory produces tables the Data API can still reach.
--
-- Grants follow each table's RLS intent as it exists live (policies checked
-- 2026-09-24), never blanket anon access:
--   * public-read tables (anon SELECT policy): SELECT to anon + authenticated
--   * everything else: service_role only (RLS on, no anon/auth policy, or a
--     policy gated on auth.role() = 'service_role')
--
-- Deliberately NOT done here: revoking the broader default privileges anon/
-- authenticated currently hold on production. RLS already blocks them, and
-- removing table privileges is a real permission change with its own review
-- -- tracked separately, not folded into a grants backfill.

-- Public read (SELECT) ---------------------------------------------------------
GRANT SELECT ON TABLE public.guides               TO anon, authenticated;
GRANT SELECT ON TABLE public.cmf_figures          TO anon, authenticated;
GRANT SELECT ON TABLE public.community_spotlights TO anon, authenticated;

-- service_role (server-side scripts, admin, pipelines) on all 16 ---------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.pending_drafts,
  public.raw_signals,
  public.posted_sets,
  public.guides,
  public.community_spotlights,
  public.content_quality_issues,
  public.content_image_registry,
  public.content_fix_log,
  public.cmf_figures,
  public.social_automation_heartbeat,
  public.generator_runs,
  public.video_posts,
  public.content_rejections,
  public.content_rejection_reminders,
  public.quiet_panic_posts,
  public.catalog_coverage_trend
TO service_role;

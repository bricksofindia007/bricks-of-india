-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260809065224, name nav_content_overhaul_schema, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Nav & Content Overhaul (2026-08-09)
-- Schema changes supporting §5 (Guides weekly pipeline), §6 (Opinion
-- fortnightly cadence), §4 (featured_videos). Data migration (blog_posts
-- copy, featured_videos seed, image backfill) is a separate, immediately-
-- following execute_sql pass in the same session.

-- 1. pending_drafts.draft_format CHECK constraint never included 'guide' --
--    a hard blocker for §5 (confirmed live before this migration: the
--    'guide' word-count target, prompt template, and resolveTarget() publish
--    routing all already existed from WEB-05, but no pending_drafts row
--    could ever be inserted with draft_format='guide' until now).
alter table pending_drafts drop constraint pending_drafts_draft_format_check;
alter table pending_drafts add constraint pending_drafts_draft_format_check
  check (draft_format = any (array['news'::text, 'review'::text, 'opinion'::text, 'guide'::text]));

-- 2. Opinion fortnightly cadence fallback-path flag (see draft-prompt.ts
--    buildUserPrompt / opinion-cadence.js).
alter table pending_drafts add column opinion_forced_take boolean not null default false;

-- 3. Guide-format category override -- resolveTarget() alone would collapse
--    every guide into category='Guide', which matches none of /guides' 5
--    real filter chips (lego-101/Buying Guides/How-To/Gift Guides/Value
--    Picks). queue-weekly-guide.js populates this from guide-topics.js.
alter table pending_drafts add column draft_category text;

-- 4. Opinion cadence audit log -- same instinct as
--    social_automation_heartbeat's consecutive_skip_days: tracks which path
--    fired each fortnightly cycle (keyword_match / fallback / no_candidate)
--    so a fallback-dominant trend is visible without digging through GH
--    Actions logs. Internal/backend-only table -- RLS enabled, no policies,
--    matching the existing convention for generator_runs/content_rejections/
--    image_repair_queue/social_automation_heartbeat (service role bypasses
--    RLS; nothing client-side ever needs to read this).
create table opinion_cadence_log (
  id bigint generated always as identity primary key,
  cycle_date date not null unique,
  path text not null check (path in ('keyword_match', 'fallback', 'no_candidate')),
  source_url text,
  pending_draft_id uuid,
  created_at timestamptz not null default now()
);
alter table opinion_cadence_log enable row level security;

-- 5. Featured Videos (§4) -- replaces the hardcoded 3-video array in
--    YouTubeSection.tsx. Public-read (homepage queries it via the anon
--    client, same as reviews/news_articles/guides), matching the
--    established "Public read <table>" policy convention.
create table featured_videos (
  id bigint generated always as identity primary key,
  youtube_video_id text not null,
  title text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  added_at timestamptz not null default now()
);
alter table featured_videos enable row level security;
create policy "Public read featured_videos" on featured_videos for select to anon using (true);

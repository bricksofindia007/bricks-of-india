-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260809121648, name growth_engine_phase0_schema, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

create schema if not exists growth;

create table growth.platform_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('youtube','instagram','reddit','website')),
  metric_date date not null,
  followers_or_subs integer,
  views bigint,
  watch_hours numeric,
  reach bigint,
  engagement bigint,
  raw jsonb,
  pulled_at timestamptz not null default now(),
  unique (platform, metric_date)
);

create table growth.content_performance (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  content_ref text not null,        -- loose reference to video_posts/quiet_panic_posts id, no cross-schema FK
  content_theme text,
  content_format text,
  metric_date date not null,
  views bigint,
  completion_rate numeric,
  engagement bigint,
  pulled_at timestamptz not null default now()
);

create table growth.forecasts (
  id uuid primary key default gen_random_uuid(),
  track_type text not null check (track_type in ('platform_gated','owned_channel')),
  platform text,
  metric text not null,             -- e.g. 'youtube_watch_hours', 'ig_followers', 'affiliate_revenue'
  current_value numeric,
  target_value numeric,
  projected_date date,
  confidence text check (confidence in ('low','medium','high')),
  evidence_weeks integer,
  computed_at timestamptz not null default now()
);

create table growth.insights (
  id uuid primary key default gen_random_uuid(),
  category text not null,           -- 'format_performance','platform_forecast','reddit_opportunity', etc.
  metric_fact jsonb not null,       -- pulled numbers only, never interpreted
  ai_commentary text,               -- interpretation, kept structurally separate from fact
  confidence text check (confidence in ('low','medium','high')),
  evidence_weeks integer,
  status text not null default 'new' check (status in ('new','reviewed','actioned','dismissed')),
  computed_at timestamptz not null default now()
);

create table growth.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'active' check (status in ('active','unsubscribed','bounced')),
  source text,
  subscribed_at timestamptz not null default now()
);

create table growth.newsletter_drafts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending_approval' check (status in ('pending_approval','approved','sent','rejected')),
  subject text,
  content jsonb not null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  sent_at timestamptz
);

create table growth.reddit_activity (
  id uuid primary key default gen_random_uuid(),
  subreddit text not null,
  post_ref text,
  posted_at timestamptz,
  upvotes integer,
  comments integer,
  referral_clicks integer,
  tracked_at timestamptz not null default now()
);

-- Scoped service role — never use service_role for this system
create role growth_service with login password 'qRBk1cifLUmTQaHS8GBK3uUKjcX5zW4D3PN5NmFGJhko';
grant usage on schema growth to growth_service;
grant select, insert, update on all tables in schema growth to growth_service;
alter default privileges in schema growth grant select, insert, update on tables to growth_service;

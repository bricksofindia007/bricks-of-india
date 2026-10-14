-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260810180730, name phase5_platform_metrics_newsletter, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Phase 5 prompt: "Subscriber count over time: growth.platform_metrics_daily,
-- platform = 'newsletter' -- reuses the existing generalized table rather
-- than creating a new one." platform_metrics_daily_platform_check only
-- allowed youtube/instagram/reddit/website (Phase 0) -- extended to
-- include 'newsletter', the one schema change this reuse actually needs.
-- followers_or_subs is the natural column for "active subscriber count",
-- same semantic as YouTube subs / Instagram followers (a snapshot total).
alter table growth.platform_metrics_daily
  drop constraint platform_metrics_daily_platform_check;
alter table growth.platform_metrics_daily
  add constraint platform_metrics_daily_platform_check
    check (platform in ('youtube', 'instagram', 'reddit', 'website', 'newsletter'));

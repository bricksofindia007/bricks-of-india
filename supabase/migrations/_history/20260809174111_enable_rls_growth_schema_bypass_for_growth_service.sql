-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260809174111, name enable_rls_growth_schema_bypass_for_growth_service, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Confirmed empirically before this migration: the `growth` schema is
-- NOT in PostgREST's exposed-schema list (PGRST106, "Only the following
-- schemas are exposed: public, graphql_public"), so this is
-- defense-in-depth, not closing an active hole. growth_service connects
-- via the Postgres protocol directly, never through PostgREST/anon/
-- authenticated, so it gets BYPASSRLS rather than hand-written "allow
-- all" policies — less surface area to get wrong for a role that was
-- already scoped and isolated from anon/authenticated to begin with.

alter table growth.platform_metrics_daily enable row level security;
alter table growth.content_performance enable row level security;
alter table growth.forecasts enable row level security;
alter table growth.insights enable row level security;
alter table growth.subscribers enable row level security;
alter table growth.newsletter_drafts enable row level security;
alter table growth.reddit_activity enable row level security;

alter role growth_service bypassrls;

-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260810172926, name phase5_newsletter_roles_grants, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- growth_subscriber_sync: the ONE narrow, audited touchpoint allowed to
-- read public.newsletter_subscribers (real subscriber PII/consent data,
-- a different sensitivity class from the "content" enrichment already
-- permitted by README non-negotiable #4). Deliberately its own role,
-- not growth_service, so this specific access is independently
-- grantable/revocable/auditable. SELECT-only on the source table;
-- INSERT/UPDATE on the growth-schema mirror only -- never DELETE
-- anywhere, matching this project's append/upsert-only convention.
create role growth_subscriber_sync with login password '1bVhV4pXJe57FimYhSnT1QdFw4CpZwvI';
grant usage on schema public to growth_subscriber_sync;
grant select on public.newsletter_subscribers to growth_subscriber_sync;
grant usage on schema growth to growth_subscriber_sync;
grant select, insert, update on growth.subscribers to growth_subscriber_sync;

-- growth_service gets read-only, non-blocking access to specific
-- existing "content" tables for real newsletter material -- exactly the
-- class of access README non-negotiable #4 already anticipates
-- ("read-only query for correlation/enrichment... degrade gracefully").
-- Named tables only, never schema-wide; growth_service already has
-- BYPASSRLS (Phase 2 follow-up) so no new RLS policy is needed on these
-- tables for it specifically.
grant usage on schema public to growth_service;
grant select on public.reviews, public.news_articles, public.sets,
  public.store_prices, public.price_history, public.guides
  to growth_service;

-- growth_webhook: the Resend webhook receiver's only credential.
-- INSERT-only on one table, nothing else reachable -- if this leaks it
-- can create engagement-event rows and read nothing, and (per the RLS
-- policy below) can't even do that without a properly shaped row.
create role growth_webhook with login password '483cP1xKoa2fY97oa2823QXS7pP5rrEM';
grant usage on schema growth to growth_webhook;
grant insert on growth.newsletter_events to growth_webhook;

alter table growth.newsletter_events enable row level security;
create policy growth_webhook_insert on growth.newsletter_events
  for insert to growth_webhook
  with check (true);

-- growth_dashboard: extend with the newsletter-drafts review surface,
-- same column-level-grant + USING/WITH CHECK RLS pattern as forecasts
-- (Phase 4), plus read-only visibility into engagement data.
grant select on growth.newsletter_drafts to growth_dashboard;
grant update (status) on growth.newsletter_drafts to growth_dashboard;

create policy growth_dashboard_select_drafts on growth.newsletter_drafts
  for select to growth_dashboard using (true);

create policy growth_dashboard_update_drafts_status on growth.newsletter_drafts
  for update to growth_dashboard
  using (status = 'pending_approval')
  with check (status in ('approved', 'dismissed'));

grant select on growth.newsletter_events to growth_dashboard;
create policy growth_dashboard_select_events on growth.newsletter_events
  for select to growth_dashboard using (true);

grant select on growth.newsletter_issue_summary to growth_dashboard;

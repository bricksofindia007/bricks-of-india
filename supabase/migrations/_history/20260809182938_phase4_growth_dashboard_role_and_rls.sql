-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260809182938, name phase4_growth_dashboard_role_and_rls, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Phase 4: a distinct, narrowly-scoped role for the browser-facing
-- dashboard app -- never growth_service (which has BYPASSRLS and full
-- table access, meant for automated ingestion/forecasting jobs only).
-- If this credential is ever exposed via the web-facing surface, the
-- blast radius must not include growth_service's access.
create role growth_dashboard with login password '9iGq5RhqZ1tiS2AFym0KMwygGxq4qA7fqniXk5n6c0in';
grant usage on schema growth to growth_dashboard;

-- Read: full SELECT on forecasts (needed for both the actionable review
-- queue and the insufficient_evidence summary counts).
grant select on growth.forecasts to growth_dashboard;

-- Write: column-level grant limited to status only -- growth_dashboard
-- cannot UPDATE current_value, target_value, computed_rate, ai_narrative,
-- or any other column even if application code had a bug that tried.
grant update (status) on growth.forecasts to growth_dashboard;

-- growth.forecasts already has RLS enabled (Phase 2 follow-up) with no
-- policies -- growth_service bypasses RLS entirely (BYPASSRLS), so this
-- is the first role that actually needs policies to see/touch anything.

create policy growth_dashboard_select on growth.forecasts
  for select
  to growth_dashboard
  using (true);

-- The actual DB-layer guarantee: USING checks the row's CURRENT status
-- before allowing the update to proceed at all (only pending_approval
-- rows are touchable); WITH CHECK validates the NEW row after the
-- update (status must land on approved or dismissed -- not back to
-- pending_approval, not some other value). This holds even if the
-- application code has a bug, per the prescription's explicit ask.
create policy growth_dashboard_update_status on growth.forecasts
  for update
  to growth_dashboard
  using (status = 'pending_approval')
  with check (status in ('approved', 'dismissed'));

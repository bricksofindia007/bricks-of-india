-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260809182755, name phase4_fix_forecasts_status_vocabulary, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Phase 3 invented the status vocabulary pending_approval/reviewed/dismissed,
-- but Phase 4's prescription explicitly wants two actions: Approve, Dismiss.
-- 'reviewed' doesn't match "Approve" cleanly (a human approving a forecast
-- recommendation is a stronger, more specific claim than "reviewed"). Safe
-- to correct: confirmed via query first that 0 rows currently have any
-- non-pending_approval status, so nothing is renamed out from under real data.
alter table growth.forecasts drop constraint forecasts_status_check;
alter table growth.forecasts add constraint forecasts_status_check
  check (status in ('pending_approval', 'approved', 'dismissed'));

comment on column growth.forecasts.status is
  'Phase 3/4: pending_approval by default. Only the growth_dashboard role (Phase 4), via its RLS policy, may transition a row to approved or dismissed -- no other code path in this system does.';

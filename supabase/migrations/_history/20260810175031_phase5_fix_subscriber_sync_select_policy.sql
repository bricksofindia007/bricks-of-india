-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260810175031, name phase5_fix_subscriber_sync_select_policy, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Found by isolating the failure directly (plain INSERT worked, INSERT
-- ... ON CONFLICT DO UPDATE did not): the missing piece was a SELECT
-- policy. ON CONFLICT DO UPDATE needs to see the existing conflicting
-- row to evaluate the UPDATE policy's USING clause -- table-level SELECT
-- grant alone isn't enough once RLS is enabled with no SELECT policy.
create policy growth_subscriber_sync_select on growth.subscribers
  for select to growth_subscriber_sync using (true);

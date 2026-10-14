-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260811165602, name phase5_fix_growth_webhook_select_policy, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Same lesson as growth_subscriber_sync's earlier fix: a column-level
-- GRANT SELECT alone isn't enough once RLS is enabled -- the previous
-- migration's grant let this get past the raw ACL check
-- (aclcheck_error) but then failed RLS's WITH CHECK enforcement
-- (ExecWithCheckOptions) because no SELECT policy exists for
-- growth_webhook, needed for the ON CONFLICT (svix_id) DO NOTHING
-- conflict-detection read.
create policy growth_webhook_select_events on growth.newsletter_events
  for select to growth_webhook using (true);

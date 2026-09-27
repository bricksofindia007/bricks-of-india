-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260810174820, name phase5_fix_subscriber_sync_rls_visibility, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Bug found by actually running subscriber_sync.py against the live DB
-- (not just deploying and assuming): growth_subscriber_sync had a table-
-- level SELECT grant on public.newsletter_subscribers but RLS on that
-- table only has an anon INSERT policy (CLAUDE.md-documented) -- with no
-- SELECT policy for this role, RLS silently returned zero rows rather
-- than erroring, so the sync "succeeded" with 0/0 synced. Fixed with an
-- explicit SELECT policy, not BYPASSRLS -- narrower than granting this
-- role a blanket bypass-RLS-everywhere attribute, consistent with how
-- growth_webhook/growth_dashboard were scoped with real policies rather
-- than bypass.
create policy growth_subscriber_sync_select on public.newsletter_subscribers
  for select to growth_subscriber_sync using (true);

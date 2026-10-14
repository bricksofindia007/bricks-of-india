-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260810174922, name phase5_fix_subscriber_sync_write_policies, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Same class of bug as the previous migration, caught the same way (a
-- real run, not an assumption): growth.subscribers has had RLS enabled
-- with zero policies since Phase 0 (harmless while growth_service --
-- which has BYPASSRLS -- was the only writer). growth_subscriber_sync
-- has neither BYPASSRLS nor a policy, so its
-- INSERT ... ON CONFLICT DO UPDATE upsert needs both an INSERT and an
-- UPDATE policy (Postgres RLS checks the UPDATE policy for the
-- conflict-resolution path too).
create policy growth_subscriber_sync_insert on growth.subscribers
  for insert to growth_subscriber_sync with check (true);

create policy growth_subscriber_sync_update on growth.subscribers
  for update to growth_subscriber_sync using (true) with check (true);

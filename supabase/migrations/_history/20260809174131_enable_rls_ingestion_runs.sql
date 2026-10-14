-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260809174131, name enable_rls_ingestion_runs, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- growth.ingestion_runs didn't exist when the original 7-table RLS
-- advisory was generated (it was added later in Phase 2), so it wasn't
-- covered by "enable RLS on all 7 growth tables" literally — but
-- leaving an 8th growth table un-hardened while the rest are covered
-- would just show up as a fresh advisory finding. Same reasoning
-- applies: growth_service already has BYPASSRLS, so this closes the gap
-- for anon/authenticated with no behavior change for the actual writer.
alter table growth.ingestion_runs enable row level security;

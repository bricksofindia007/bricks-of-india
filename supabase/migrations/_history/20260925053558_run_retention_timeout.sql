-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260925053558, name run_retention_timeout, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

ALTER FUNCTION public.run_retention(integer, integer, boolean) SET statement_timeout = '55s';
NOTIFY pgrst, 'reload config';

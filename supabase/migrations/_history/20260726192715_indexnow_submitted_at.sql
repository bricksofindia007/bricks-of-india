-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260726192715, name indexnow_submitted_at, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

ALTER TABLE sets ADD COLUMN IF NOT EXISTS indexnow_submitted_at timestamptz;

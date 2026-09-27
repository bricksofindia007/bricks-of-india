-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260807195001, name heartbeat_skip_streak, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

ALTER TABLE public.social_automation_heartbeat
  ADD COLUMN IF NOT EXISTS consecutive_skip_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skip_reason text;

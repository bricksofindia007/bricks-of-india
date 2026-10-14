-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260809121749, name growth_service_revoke_public_schema_default, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Postgres grants USAGE on schema "public" to the PUBLIC pseudo-role by
-- default, so every newly created role (including growth_service)
-- inherits it automatically. That default conflicts with this system's
-- isolation principle (never depend on anything outside the growth
-- schema), so revoke it explicitly for growth_service.
revoke usage on schema public from growth_service;

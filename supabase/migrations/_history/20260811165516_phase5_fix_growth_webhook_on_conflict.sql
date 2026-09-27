-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260811165516, name phase5_fix_growth_webhook_on_conflict, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Found by actually POSTing a real signed webhook through the live
-- route code (not just a hand-rolled INSERT test): growth_webhook had
-- INSERT-only on growth.newsletter_events, but the real query in
-- webhook-db.ts is `INSERT ... ON CONFLICT (svix_id) DO NOTHING` (the
-- real idempotency guard against Resend/Svix webhook retries) -- even
-- DO NOTHING needs to read the svix_id unique index to detect a
-- conflict, which failed with a bare ACL error (42501), not an RLS
-- violation, since growth_webhook has no SELECT at all on this table.
-- Narrow column-level grant, not full-table SELECT -- growth_webhook
-- should still never be able to read recipient_email/raw/etc, only
-- enough to make its own idempotency check work.
grant select (svix_id) on growth.newsletter_events to growth_webhook;

-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260810174315, name phase5_growth_webhook_broadcast_lookup, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- growth_webhook needs to resolve Resend's broadcast_id (from the
-- incoming webhook payload) back to our internal draft id -- narrowly
-- scoped to exactly the two columns needed for that lookup, nothing else
-- on newsletter_drafts (no subject/content/status visibility).
grant select (id, resend_broadcast_id) on growth.newsletter_drafts to growth_webhook;

create policy growth_webhook_select_drafts on growth.newsletter_drafts
  for select to growth_webhook using (true);

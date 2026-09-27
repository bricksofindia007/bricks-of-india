-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260810174206, name phase5_newsletter_webhook_correlation, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Resend's email.* webhook payloads carry data.broadcast_id for
-- broadcast-originated sends (confirmed against Resend's own
-- email.delivered payload example, 2026-08-10) -- this is how the
-- webhook receiver maps an incoming event back to a specific
-- growth.newsletter_drafts row. Stored right after the broadcast is
-- created in send.py, not only at mark_sent, so it's captured even if
-- the process dies between creating the broadcast and finishing.
alter table growth.newsletter_drafts
  add column if not exists resend_broadcast_id text;

create index if not exists idx_newsletter_drafts_broadcast_id
  on growth.newsletter_drafts(resend_broadcast_id);

grant update (resend_broadcast_id) on growth.newsletter_drafts to growth_service;

-- draft_id is nullable: an audience-level unsubscribe (Resend's
-- contact.updated event, fired on the Audience/contact, not on any one
-- email send) isn't inherently tied to a single issue the way
-- delivered/opened/clicked are -- see newsletter/webhook receiver.
alter table growth.newsletter_events alter column draft_id drop not null;

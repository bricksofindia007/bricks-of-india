-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260810172856, name phase5_newsletter_schema, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Phase 5: newsletter pipeline schema.
--
-- growth.subscribers is repurposed as a read-only MIRROR of
-- public.newsletter_subscribers -- confirmed via direct query
-- (2026-08-10) that growth.subscribers held 0 rows while
-- public.newsletter_subscribers holds the site's real, consented
-- signups (fed by src/app/actions/newsletter.ts, the site's actual
-- signup flow -- single opt-in with a welcome email, not a true
-- confirm-click double opt-in, corrected from the Phase 5 prompt's
-- "most likely double opt-in" assumption). Never written back to; the
-- sync direction is one-way, source -> mirror, via a narrowly-scoped
-- growth_subscriber_sync role (below), never growth_service.

alter table growth.subscribers
  add column if not exists source_subscriber_id uuid,
  add column if not exists synced_at timestamptz not null default now();

-- (unique(email) already existed from Phase 0 -- subscribers_email_key)

comment on table growth.subscribers is
  'Read-only mirror of public.newsletter_subscribers (the site''s real signup flow), refreshed by ingestion/subscriber_sync.py via growth_subscriber_sync. status mirrors the source''s is_active only -- actual Resend-driven unsubscribes are tracked separately in growth.newsletter_events and excluded at send-query time, not by mutating this table.';
comment on column growth.subscribers.source is
  'Always ''site_signup_mirror'' -- every row is a synced copy, never an independent signup path of its own.';

-- Status vocabulary correction, matching Phase 4's forecasts correction
-- (pending_approval/approved/dismissed, not rejected) -- plus the two
-- states this phase's send workflow needs: 'sending' (an atomic claim
-- so a retry can't double-send) and 'send_failed' (so a dead send is
-- visible and actionable, not silently stuck, mirroring
-- ingestion_runs' explicit-failure philosophy). Safe: 0 rows exist yet.
alter table growth.newsletter_drafts
  drop constraint newsletter_drafts_status_check;
alter table growth.newsletter_drafts
  add constraint newsletter_drafts_status_check
    check (status in ('pending_approval', 'approved', 'sending', 'sent', 'send_failed', 'dismissed'));

alter table growth.newsletter_drafts
  add column if not exists issue_number integer,
  add column if not exists window_start date,
  add column if not exists window_end date,
  add column if not exists final_html text,
  add column if not exists final_text text,
  add column if not exists sent_count integer;

comment on column growth.newsletter_drafts.content is
  'Structured block data + LLM-generated copy for every section -- the pre-send draft, rendered fresh for dashboard preview. NOT what actually gets sent.';
comment on column growth.newsletter_drafts.final_html is
  'Frozen render of content at the moment of send -- distinct from content because a manual edit could happen between approval and send. NULL until sent.';
comment on column growth.newsletter_drafts.final_text is
  'Plain-text counterpart to final_html, frozen at the same moment.';

-- Event-level engagement, per recipient per issue. Ingested from Resend
-- webhooks (delivered/opened/clicked/bounced/complained/unsubscribed) --
-- deliberately its own table, not a platform_metrics_daily row, since
-- this is event data, not a daily snapshot.
create table if not exists growth.newsletter_events (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references growth.newsletter_drafts(id),
  recipient_email text not null,
  event_type text not null check (event_type in ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed')),
  occurred_at timestamptz not null,
  link_url text,
  resend_email_id text,
  svix_id text unique,
  raw jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create index if not exists idx_newsletter_events_draft on growth.newsletter_events(draft_id);
create index if not exists idx_newsletter_events_recipient on growth.newsletter_events(recipient_email);

comment on column growth.newsletter_events.svix_id is
  'The svix-id header Resend''s webhook delivery carries -- Resend/Svix can retry a webhook delivery, so this is the real idempotency key (unique constraint + ON CONFLICT DO NOTHING on insert), not resend_email_id+event_type, which is not unique for e.g. multiple distinct link clicks in one issue.';

-- Per-issue rollup. security_invoker so it re-checks the querying role's
-- own RLS (growth_dashboard's SELECT policy on newsletter_events) rather
-- than running with the view owner's bypassed privileges -- a plain view
-- would silently expose all rows regardless of the base table's policy.
create or replace view growth.newsletter_issue_summary
  with (security_invoker = true) as
select
  d.id as draft_id,
  d.issue_number,
  d.subject,
  d.sent_at,
  count(*) filter (where e.event_type = 'sent') as sent_count,
  count(*) filter (where e.event_type = 'delivered') as delivered_count,
  count(distinct e.recipient_email) filter (where e.event_type = 'opened') as opened_count,
  count(distinct e.recipient_email) filter (where e.event_type = 'clicked') as clicked_count,
  count(distinct e.recipient_email) filter (where e.event_type = 'unsubscribed') as unsubscribed_count,
  count(*) filter (where e.event_type = 'bounced') as bounced_count,
  count(*) filter (where e.event_type = 'complained') as complained_count
from growth.newsletter_drafts d
left join growth.newsletter_events e on e.draft_id = d.id
where d.status = 'sent'
group by d.id, d.issue_number, d.subject, d.sent_at;

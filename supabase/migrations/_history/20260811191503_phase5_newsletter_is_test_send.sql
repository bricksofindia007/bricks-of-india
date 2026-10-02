-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260811191503, name phase5_newsletter_is_test_send, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Data-integrity fix, not just cosmetic (Abhinav, 2026-08-12): once
-- engagement tracking feeds real decisions (open/click rates informing
-- what future issues prioritize), a test send to a self-checked address
-- must never be indistinguishable from real subscriber behavior in the
-- same rollup. Cheap now (one column + a two-row backfill); expensive
-- to untangle retroactively once real send history exists alongside it.
alter table growth.newsletter_drafts
  add column if not exists is_test_send boolean not null default false;

-- Retroactive backfill: issue #4, the first real send, went to the
-- explicit test list (bhargav.abhinav@gmail.com,
-- [third-party email removed]), not real subscribers.
update growth.newsletter_drafts
  set is_test_send = true
  where id = '83dcd8e9-305e-47cb-bd59-8d463a00b6de';

grant update (is_test_send) on growth.newsletter_drafts to growth_service;

-- Real reporting (and thus the dashboard's "Recent issues" table, which
-- reads this view directly) excludes test sends entirely, per the
-- reasoning above -- an artificially high open rate from a test send
-- you personally opened to verify rendering is not a signal about real
-- subscriber behavior. Test-send rows remain fully queryable directly
-- against newsletter_drafts/newsletter_events for debugging -- nothing
-- is hidden, just excluded from the view real decisions are meant to
-- come from.
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
where d.status = 'sent' and d.is_test_send = false
group by d.id, d.issue_number, d.subject, d.sent_at;

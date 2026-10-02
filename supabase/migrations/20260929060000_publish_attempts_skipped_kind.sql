-- boi:issue 441
-- P12 item 0c (29 Sep 2026): publish_attempts accepts kind='skipped'.
--
-- Why: every video poller run that decides not to post now records why
-- (cadence.record_skip: before slot, already posted today, nothing queued),
-- and the missed-slot alert quotes it. On 28 Sep no poller tick landed in the
-- VID-P4 slot and nothing was recorded, so the alert could only say "the
-- poller never reached it".
--
-- Until this is applied, record_skip falls back to kind='publish',
-- outcome='deferred', detail 'skipped: <reason>' (allowed by the old CHECK),
-- so no skip is lost in between. Pure widening: no existing row can fail it.
--
-- Applied: through the db-migrate job (#404), staging first, then production.
-- Rollback (only after deleting or relabelling kind='skipped' rows):
--   ALTER TABLE public.publish_attempts DROP CONSTRAINT publish_attempts_kind_check;
--   ALTER TABLE public.publish_attempts ADD CONSTRAINT publish_attempts_kind_check
--     CHECK (kind = ANY (ARRAY['publish', 'retry', 'missed_slot_alert', 'error_alert']));

ALTER TABLE public.publish_attempts DROP CONSTRAINT publish_attempts_kind_check;
ALTER TABLE public.publish_attempts ADD CONSTRAINT publish_attempts_kind_check
  CHECK (kind = ANY (ARRAY['publish'::text, 'retry'::text, 'missed_slot_alert'::text, 'error_alert'::text, 'skipped'::text]));

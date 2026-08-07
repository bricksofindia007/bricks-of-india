-- Adds consecutive_skip_days + skip_reason to social_automation_heartbeat.
--
-- WRITTEN FOR REVIEW, NOT YET APPLIED TO THE LIVE DATABASE as of this
-- commit -- per investigation request, this feature branch does not touch
-- production data. db.py's record_heartbeat() already reads/writes these
-- columns; until this migration is applied, that code path will fail
-- (column does not exist) if run against the current live schema.
--
-- consecutive_skip_days: increments each time record_heartbeat() is called
-- with success=None (pipeline ran cleanly, found no eligible candidate that
-- day); resets to 0 on success=True. Distinct from a hard failure
-- (success=False), which does not touch this counter -- see db.py's
-- record_heartbeat() docstring for why those two are kept separate.
--
-- skip_reason: persists the actual reason for the most recent skip (e.g.
-- "no candidate cleared the gallery gate in any tier") instead of
-- discarding it, as the pipeline did before this change.

ALTER TABLE public.social_automation_heartbeat
  ADD COLUMN IF NOT EXISTS consecutive_skip_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skip_reason text;

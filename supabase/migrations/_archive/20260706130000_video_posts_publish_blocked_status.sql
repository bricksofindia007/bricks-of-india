-- VID-P4 Stage 4: add publish_blocked status. Applied directly via Supabase
-- MCP (apply_migration); this file is the local record, matching the
-- repo's existing migration-history convention.
--
-- Distinguishes "a hard guard (gate failure or missing captions) rejected
-- an already-approved row at publish time" from an operator's own
-- 'discarded' action. Needed so the poller moves a row like this OUT of
-- status='approved' (otherwise it would be retried every 15-30 minutes,
-- deterministically failing the same guard and spamming the same alert
-- each time) while still being clearly distinguishable in the data from a
-- normal discard.

ALTER TABLE video_posts DROP CONSTRAINT video_posts_status_check;
ALTER TABLE video_posts ADD CONSTRAINT video_posts_status_check
  CHECK (status IN ('rendered', 'pending_approval', 'approved', 'posted_ig', 'posted_yt', 'posted_both', 'discarded', 'publish_blocked'));

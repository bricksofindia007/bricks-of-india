-- Quiet Panic: rejection-rework loop (briefs/VID-QP-02.md follow-on,
-- operator decision 2026-07-31). Lets a specific, reasoned operator
-- rejection trigger one automated revision attempt instead of just
-- reopening the set for an unrelated fresh take -- that's what
-- 'discarded' already does (added 20260729000000), left unchanged here.

ALTER TABLE quiet_panic_posts ADD COLUMN rejection_reason text;
ALTER TABLE quiet_panic_posts ADD COLUMN reworked boolean NOT NULL DEFAULT false;
ALTER TABLE quiet_panic_posts ADD COLUMN reworked_from uuid REFERENCES quiet_panic_posts(id);

-- 'rejected' is new and deliberately distinct from 'discarded':
-- 'discarded' = operator silently killed this attempt, no reason
-- recorded, set fully reopens for a fresh unrelated candidate pick
-- (select_quiet_panic_candidate.py's existing CLAIMED_STATUSES check,
-- unchanged by this migration). 'rejected' = operator gave a specific
-- rejection_reason; the set stays claimed and is eligible ONLY for a
-- targeted rework addressing that reason, consumed by
-- rework_quiet_panic.py -- never picked up as a fresh unrelated
-- candidate. This requires 'rejected' to ALSO count as claimed in
-- select_quiet_panic_candidate.py's CLAIMED_STATUSES tuple (fixed in the
-- same commit as this migration, scripts/video/select_quiet_panic_
-- candidate.py) -- without that, a set mid-rework would be eligible for
-- a second, unrelated fresh generation attempt at the same time.
ALTER TABLE quiet_panic_posts DROP CONSTRAINT quiet_panic_posts_status_check;
ALTER TABLE quiet_panic_posts ADD CONSTRAINT quiet_panic_posts_status_check
  CHECK (status IN ('pending_approval', 'approved', 'posted_ig', 'posted_yt', 'posted_both', 'discarded', 'publish_blocked', 'rejected'));

-- Rework poller's queue query: status='rejected' AND reworked=false
-- (rejection_reason IS NOT NULL filtered in Python, not indexed here).
CREATE INDEX idx_quiet_panic_posts_rework_queue ON quiet_panic_posts(status, reworked) WHERE status = 'rejected';
CREATE INDEX idx_quiet_panic_posts_reworked_from ON quiet_panic_posts(reworked_from) WHERE reworked_from IS NOT NULL;

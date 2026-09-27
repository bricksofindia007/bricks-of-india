-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260731053256, name quiet_panic_rejection_rework, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

ALTER TABLE quiet_panic_posts ADD COLUMN rejection_reason text;
ALTER TABLE quiet_panic_posts ADD COLUMN reworked boolean NOT NULL DEFAULT false;
ALTER TABLE quiet_panic_posts ADD COLUMN reworked_from uuid REFERENCES quiet_panic_posts(id);

ALTER TABLE quiet_panic_posts DROP CONSTRAINT quiet_panic_posts_status_check;
ALTER TABLE quiet_panic_posts ADD CONSTRAINT quiet_panic_posts_status_check
  CHECK (status IN ('pending_approval', 'approved', 'posted_ig', 'posted_yt', 'posted_both', 'discarded', 'publish_blocked', 'rejected'));

CREATE INDEX idx_quiet_panic_posts_rework_queue ON quiet_panic_posts(status, reworked) WHERE status = 'rejected';
CREATE INDEX idx_quiet_panic_posts_reworked_from ON quiet_panic_posts(reworked_from) WHERE reworked_from IS NOT NULL;

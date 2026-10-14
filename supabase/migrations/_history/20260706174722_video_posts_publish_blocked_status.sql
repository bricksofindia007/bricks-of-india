-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260706174722, name video_posts_publish_blocked_status, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

ALTER TABLE video_posts DROP CONSTRAINT video_posts_status_check;
ALTER TABLE video_posts ADD CONSTRAINT video_posts_status_check
  CHECK (status IN ('rendered', 'pending_approval', 'approved', 'posted_ig', 'posted_yt', 'posted_both', 'discarded', 'publish_blocked'));

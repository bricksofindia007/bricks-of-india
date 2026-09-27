-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260706133722, name video_posts_publish_fields, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

ALTER TABLE video_posts
  ADD COLUMN storage_url      text NULL,
  ADD COLUMN qc_frame_urls    jsonb NULL,
  ADD COLUMN ig_media_id      text NULL,
  ADD COLUMN ig_permalink     text NULL,
  ADD COLUMN ig_raw_response  jsonb NULL,
  ADD COLUMN yt_video_id      text NULL,
  ADD COLUMN yt_url           text NULL,
  ADD COLUMN yt_raw_response  jsonb NULL;

ALTER TABLE video_posts DROP CONSTRAINT video_posts_status_check;
ALTER TABLE video_posts ADD CONSTRAINT video_posts_status_check
  CHECK (status IN ('rendered', 'pending_approval', 'approved', 'posted_ig', 'posted_yt', 'posted_both', 'discarded'));

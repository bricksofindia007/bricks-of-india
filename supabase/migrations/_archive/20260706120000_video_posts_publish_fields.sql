-- VID-P4: add real-publish tracking columns and the cloud approval-flow
-- statuses. Applied directly via Supabase MCP (apply_migration); this file
-- is the local record of that change, matching the repo's existing
-- migration-history convention.

ALTER TABLE video_posts
  ADD COLUMN storage_url      text NULL,     -- public Supabase Storage URL for the rendered video (IG video_url + cloud-approval shareable link)
  ADD COLUMN qc_frame_urls    jsonb NULL,    -- array of public URLs to a few extracted still frames, for quick visual review
  ADD COLUMN ig_media_id      text NULL,     -- real IG media ID returned by media_publish
  ADD COLUMN ig_permalink     text NULL,     -- live IG post URL, fetched back from the Graph API after publish (not just the publish response)
  ADD COLUMN ig_raw_response  jsonb NULL,    -- full raw IG API response on success
  ADD COLUMN yt_video_id      text NULL,     -- real YouTube video ID returned by videos.insert
  ADD COLUMN yt_url           text NULL,     -- live YouTube Shorts URL, fetched back from videos.list after upload
  ADD COLUMN yt_raw_response  jsonb NULL;    -- full raw YouTube API response on success

-- pending_approval: cloud-generated, awaiting operator chat approval (Tue/Wed + the cloud approval flow)
-- approved: operator approved in chat, cloud publish poller will pick it up
ALTER TABLE video_posts DROP CONSTRAINT video_posts_status_check;
ALTER TABLE video_posts ADD CONSTRAINT video_posts_status_check
  CHECK (status IN ('rendered', 'pending_approval', 'approved', 'posted_ig', 'posted_yt', 'posted_both', 'discarded'));

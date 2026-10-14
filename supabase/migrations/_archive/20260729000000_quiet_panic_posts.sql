-- Quiet Panic format: fully independent posts table, deliberately not
-- sharing video_posts. Per operator decision 2026-07-29, this format's
-- publish path (scripts/video/publish_quiet_panic.py) must not import from
-- or share state with engine.py/publish.py -- this table is the DB half of
-- that isolation. See briefs/VID-QP-02.md.

CREATE TABLE quiet_panic_posts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_title         text NOT NULL,
  set_number        text,
  price_inr         numeric,
  script            text NOT NULL,
  video_path        text NOT NULL,
  storage_url       text,
  gate_results      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'pending_approval',
  ig_media_id       text,
  ig_permalink      text,
  ig_raw_response   jsonb,
  yt_video_id       text,
  yt_url            text,
  yt_raw_response   jsonb,
  sequence_number   integer NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  posted_at         timestamptz
);

ALTER TABLE quiet_panic_posts ADD CONSTRAINT quiet_panic_posts_status_check
  CHECK (status IN ('pending_approval', 'approved', 'posted_ig', 'posted_yt', 'posted_both', 'discarded', 'publish_blocked'));

CREATE INDEX idx_quiet_panic_posts_status ON quiet_panic_posts(status);

-- Mirrors video_posts' assign_story_number() trigger (20260707050000) for
-- deterministic publish ordering when more than one row is approved at once.
-- Table is new/empty, so sequence_number can be NOT NULL from the start --
-- no backfill step needed (unlike story_number's original rollout).
CREATE OR REPLACE FUNCTION assign_quiet_panic_sequence_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.sequence_number IS NULL THEN
    SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO NEW.sequence_number FROM quiet_panic_posts;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quiet_panic_posts_sequence_number_trigger
  BEFORE INSERT ON quiet_panic_posts
  FOR EACH ROW EXECUTE FUNCTION assign_quiet_panic_sequence_number();

ALTER TABLE quiet_panic_posts ENABLE ROW LEVEL SECURITY;
-- Admin-table pattern (matches video_posts, content_rejections,
-- generator_runs, pending_drafts): RLS enabled, zero policies. service_role
-- bypasses RLS entirely; anon/authenticated get no access at all, by
-- omission rather than an explicit deny policy.

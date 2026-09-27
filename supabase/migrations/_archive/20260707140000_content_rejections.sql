-- VID-P4: content_rejections -- tracks operator-initiated rejections from
-- the chat-approval review flow (video_posts.status -> 'discarded').
--
-- Deliberately does NOT cover the separate automated gate-failure path
-- (video_posts.status -> 'publish_blocked', set by engine.py's
-- --poll-and-publish when an already-approved row fails a hard guard at
-- publish time). That is a distinct, system-detected condition, not an
-- operator rejection -- flagged back to the operator as a separate,
-- currently-unaddressed case rather than assumed to be the same thing.
--
-- Applied directly via Supabase MCP (apply_migration); this file is the
-- local record, matching the repo's existing migration-history convention.

CREATE TABLE content_rejections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_post_id     uuid REFERENCES video_posts(id),
  set_number        text,
  set_title         text,
  story_number      integer,
  rejected_at       timestamptz NOT NULL DEFAULT now(),
  rejection_reason  text,
  review_status     text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'cleared_for_regeneration', 'permanently_excluded')),
  reviewed_at       timestamptz,
  review_notes      text
);

ALTER TABLE content_rejections ENABLE ROW LEVEL SECURITY;
-- Admin-table pattern (matches video_posts, generator_runs, pending_drafts):
-- RLS enabled, zero policies. service_role bypasses RLS entirely;
-- anon/authenticated get no access at all, by omission rather than an
-- explicit deny policy.

-- DB-enforced so a rejection is recorded regardless of which code path (or
-- out-of-band chat-initiated SQL -- the same mechanism status='approved'
-- already uses) sets status='discarded' -- same precedent as this
-- database's existing video_posts_story_number_trigger: hold the guarantee
-- at the DB layer, not on remembering a second manual insert every time.
-- Only fires on a genuine transition INTO 'discarded' (not a no-op re-save
-- of an already-discarded row), and only for 'discarded' specifically --
-- 'publish_blocked' never triggers this, by construction.
CREATE OR REPLACE FUNCTION create_content_rejection_on_discard() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'discarded' AND (OLD.status IS DISTINCT FROM 'discarded') THEN
    INSERT INTO content_rejections (video_post_id, set_number, set_title, story_number)
    VALUES (NEW.id, NEW.set_number, NEW.set_title, NEW.story_number);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER video_posts_discard_trigger
  AFTER UPDATE OF status ON video_posts
  FOR EACH ROW
  EXECUTE FUNCTION create_content_rejection_on_discard();

-- Singleton row -- durable storage for the biweekly reminder's "last sent"
-- timestamp. A dedicated single-value table rather than a generic
-- key-value settings table, since only one value is needed and this repo
-- has no existing generic settings table to extend.
CREATE TABLE content_rejection_reminders (
  id                    integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_reminder_sent_at timestamptz
);

INSERT INTO content_rejection_reminders (id, last_reminder_sent_at) VALUES (1, NULL);

ALTER TABLE content_rejection_reminders ENABLE ROW LEVEL SECURITY;

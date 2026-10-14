-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260707134551, name content_rejections, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- VID-P4: content_rejections -- tracks operator-initiated rejections from
-- the chat-approval review flow (video_posts.status -> 'discarded').
--
-- Deliberately does NOT cover the separate automated gate-failure path
-- (video_posts.status -> 'publish_blocked', set by engine.py's
-- --poll-and-publish when an already-approved row fails a hard guard at
-- publish time). That is a distinct, system-detected condition, not an
-- operator rejection -- flagged back to the operator as a separate,
-- currently-unaddressed case rather than assumed to be the same thing.

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

-- DB-enforced so a rejection is recorded regardless of which code path (or
-- out-of-band chat-initiated SQL -- the same mechanism status='approved'
-- already uses) sets status='discarded' -- same precedent as this
-- database's existing video_posts_story_number_trigger. Only fires on a
-- genuine transition INTO 'discarded', and only for 'discarded'
-- specifically -- 'publish_blocked' never triggers this, by construction.
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

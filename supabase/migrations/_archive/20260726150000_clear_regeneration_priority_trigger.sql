-- VID-P4 follow-up: enforce "unset regeneration_priority after the set is
-- actually requeued" at the DB level instead of trusting engine.py alone.
--
-- Context: content_rejections.regeneration_priority /  requeued_at
-- (added 20260726120000_video_rejection_workflow.sql) are read by
-- engine.py --suggest to jump a cleared_for_regeneration set to the front
-- of the candidate queue. Confirmed live: nothing in the database itself
-- ever flips regeneration_priority back off -- that step, if it exists at
-- all, lives purely in engine.py's Python logic. Per the schema-of-record
-- principle (live information_schema is canonical, not app code), a
-- manual regen or a future refactor of engine.py could silently skip the
-- flip and leave a stale priority flag forever re-promoting an
-- already-regenerated set. This is the same "logic living in two
-- uncoordinated places" shape as the video_posts_discard_trigger /
-- manual-insert duplicate-row bug fixed in the same prior migration --
-- here the backstop is a DB trigger instead of a single RPC, since the
-- write this trigger reacts to (a new video_posts row) already has exactly
-- one path.
CREATE OR REPLACE FUNCTION clear_regeneration_priority_on_requeue()
RETURNS trigger AS $$
BEGIN
  UPDATE content_rejections
  SET regeneration_priority = false,
      requeued_at = now()
  WHERE set_number = NEW.set_number
    AND review_status = 'cleared_for_regeneration'
    AND regeneration_priority = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- AFTER INSERT (not BEFORE, unlike video_posts_story_number_trigger) --
-- this only needs NEW.set_number, which is set by the client insert itself,
-- not derived by another trigger. Scoped WHERE clause makes this a
-- zero-row no-op for every ordinary video insert that isn't a requeue of a
-- cleared_for_regeneration set -- cheap and safe to run unconditionally.
-- If a set_number somehow matches more than one content_rejections row
-- under this filter, clearing all of them is correct: any of them holding
-- a stale priority flag is equally wrong.
CREATE TRIGGER video_posts_clear_priority_trigger
AFTER INSERT ON video_posts
FOR EACH ROW
EXECUTE FUNCTION clear_regeneration_priority_on_requeue();

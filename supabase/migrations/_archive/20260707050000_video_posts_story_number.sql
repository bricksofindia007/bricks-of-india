-- VID-P4: story_number for the "Story #N" video badge. Applied directly
-- via Supabase MCP (apply_migration); this file is the local record,
-- matching the repo's existing migration-history convention.
--
-- Explicit INTEGER column (not a computed-on-the-fly count) -- immune to
-- any row later being deleted/reordered, per operator's own stated
-- reasoning. Backfilled by created_at order for the 5 existing rows
-- (4 named by the operator + 1 additional row, "Shopping Street" 11371,
-- discovered live at backfill time -- flagged back to the operator, not
-- silently assumed away).
--
-- Future inserts: BEFORE INSERT trigger assigns
-- COALESCE(MAX(story_number), 0) + 1 automatically -- DB-enforced so it
-- holds regardless of which code path performs the insert, not just
-- engine.py's own insert_video_post().

ALTER TABLE video_posts ADD COLUMN story_number integer;

UPDATE video_posts SET story_number = 1 WHERE id = '15ba43f0-7847-4bdd-bfd7-c4ef2294c51d'; -- Minas Tirith
UPDATE video_posts SET story_number = 2 WHERE id = 'd89ef509-445b-4b84-b886-b953b24645b9'; -- N-1 Starfighter
UPDATE video_posts SET story_number = 3 WHERE id = '93c35a97-ef4c-4f7d-84b5-4eca215ffa48'; -- Death Star
UPDATE video_posts SET story_number = 4 WHERE id = '85c161ac-e335-4b63-b383-59a435677ec9'; -- McLaren MCL39 F1
UPDATE video_posts SET story_number = 5 WHERE id = '73b4b102-e0ba-4c13-b673-c74c3fd994ee'; -- Shopping Street 11371 (found at backfill time, not in operator's original list)

ALTER TABLE video_posts ALTER COLUMN story_number SET NOT NULL;

CREATE OR REPLACE FUNCTION assign_story_number() RETURNS trigger AS $$
BEGIN
  IF NEW.story_number IS NULL THEN
    NEW.story_number := COALESCE((SELECT MAX(story_number) FROM video_posts), 0) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER video_posts_story_number_trigger
  BEFORE INSERT ON video_posts
  FOR EACH ROW
  EXECUTE FUNCTION assign_story_number();

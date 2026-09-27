-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260707050932, name video_posts_story_number, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

ALTER TABLE video_posts ADD COLUMN story_number integer;

UPDATE video_posts SET story_number = 1 WHERE id = '15ba43f0-7847-4bdd-bfd7-c4ef2294c51d';
UPDATE video_posts SET story_number = 2 WHERE id = 'd89ef509-445b-4b84-b886-b953b24645b9';
UPDATE video_posts SET story_number = 3 WHERE id = '93c35a97-ef4c-4f7d-84b5-4eca215ffa48';
UPDATE video_posts SET story_number = 4 WHERE id = '85c161ac-e335-4b63-b383-59a435677ec9';
UPDATE video_posts SET story_number = 5 WHERE id = '73b4b102-e0ba-4c13-b673-c74c3fd994ee';

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

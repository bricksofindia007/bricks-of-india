-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260726112038, name clear_regeneration_priority_trigger, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

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

CREATE TRIGGER video_posts_clear_priority_trigger
AFTER INSERT ON video_posts
FOR EACH ROW
EXECUTE FUNCTION clear_regeneration_priority_on_requeue();

-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260822052321, name add_title_set_consistency_guardrail, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).


-- Enable fuzzy text matching for title/name comparison
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tracking columns: video_posts
ALTER TABLE video_posts
  ADD COLUMN IF NOT EXISTS title_number_mismatch boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS title_mismatch_detail text,
  ADD COLUMN IF NOT EXISTS needs_rerender boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rerender_note text;

-- Tracking columns: quiet_panic_posts (same candidate-selection heritage, same risk)
ALTER TABLE quiet_panic_posts
  ADD COLUMN IF NOT EXISTS title_number_mismatch boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS title_mismatch_detail text,
  ADD COLUMN IF NOT EXISTS needs_rerender boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rerender_note text;

-- Trigger function for video_posts
CREATE OR REPLACE FUNCTION check_video_posts_title_consistency() RETURNS trigger AS $$
DECLARE
  canonical_name text;
  norm_title text;
  norm_canonical text;
  is_match boolean;
BEGIN
  SELECT name INTO canonical_name FROM sets WHERE set_number = NEW.set_number LIMIT 1;

  IF canonical_name IS NULL THEN
    NEW.title_number_mismatch := false;
    NEW.title_mismatch_detail := NULL;
  ELSE
    norm_title := lower(regexp_replace(NEW.set_title, '[^a-z0-9]+', '', 'gi'));
    norm_canonical := lower(regexp_replace(canonical_name, '[^a-z0-9]+', '', 'gi'));

    is_match := norm_title LIKE '%' || norm_canonical || '%'
                OR similarity(NEW.set_title, canonical_name) > 0.35;

    IF is_match THEN
      NEW.title_number_mismatch := false;
      NEW.title_mismatch_detail := NULL;
    ELSE
      NEW.title_number_mismatch := true;
      NEW.title_mismatch_detail := format(
        'set_title "%s" does not match master sets.name "%s" for set_number %s',
        NEW.set_title, canonical_name, NEW.set_number
      );
    END IF;
  END IF;

  -- Hard guardrail: block the moment a mismatched or asset-incomplete story is approved
  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved')
     AND (NEW.title_number_mismatch OR NEW.needs_rerender) THEN
    RAISE EXCEPTION 'Cannot approve story_number %: title_number_mismatch=%, needs_rerender=%. Detail: % / %',
      NEW.story_number, NEW.title_number_mismatch, NEW.needs_rerender,
      NEW.title_mismatch_detail, NEW.rerender_note;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_video_posts_title_consistency ON video_posts;
CREATE TRIGGER trg_video_posts_title_consistency
BEFORE INSERT OR UPDATE ON video_posts
FOR EACH ROW EXECUTE FUNCTION check_video_posts_title_consistency();

-- Trigger function for quiet_panic_posts (same logic, different id column for messaging)
CREATE OR REPLACE FUNCTION check_qp_posts_title_consistency() RETURNS trigger AS $$
DECLARE
  canonical_name text;
  norm_title text;
  norm_canonical text;
  is_match boolean;
BEGIN
  SELECT name INTO canonical_name FROM sets WHERE set_number = NEW.set_number LIMIT 1;

  IF canonical_name IS NULL THEN
    NEW.title_number_mismatch := false;
    NEW.title_mismatch_detail := NULL;
  ELSE
    norm_title := lower(regexp_replace(NEW.set_title, '[^a-z0-9]+', '', 'gi'));
    norm_canonical := lower(regexp_replace(canonical_name, '[^a-z0-9]+', '', 'gi'));

    is_match := norm_title LIKE '%' || norm_canonical || '%'
                OR similarity(NEW.set_title, canonical_name) > 0.35;

    IF is_match THEN
      NEW.title_number_mismatch := false;
      NEW.title_mismatch_detail := NULL;
    ELSE
      NEW.title_number_mismatch := true;
      NEW.title_mismatch_detail := format(
        'set_title "%s" does not match master sets.name "%s" for set_number %s',
        NEW.set_title, canonical_name, NEW.set_number
      );
    END IF;
  END IF;

  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved')
     AND (NEW.title_number_mismatch OR NEW.needs_rerender) THEN
    RAISE EXCEPTION 'Cannot approve quiet_panic_posts row (sequence_number %): title_number_mismatch=%, needs_rerender=%. Detail: % / %',
      NEW.sequence_number, NEW.title_number_mismatch, NEW.needs_rerender,
      NEW.title_mismatch_detail, NEW.rerender_note;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_qp_posts_title_consistency ON quiet_panic_posts;
CREATE TRIGGER trg_qp_posts_title_consistency
BEFORE INSERT OR UPDATE ON quiet_panic_posts
FOR EACH ROW EXECUTE FUNCTION check_qp_posts_title_consistency();

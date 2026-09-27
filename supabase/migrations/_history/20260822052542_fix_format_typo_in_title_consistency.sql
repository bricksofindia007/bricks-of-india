-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260822052542, name fix_format_typo_in_title_consistency, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).


CREATE OR REPLACE FUNCTION check_video_posts_title_consistency() RETURNS trigger AS $$
DECLARE
  canonical_name text;
  stopwords text[] := ARRAY['lego','icons','technic','ideas','art','editions','edition','set','sets','kit',
                             'building','model','models','collection','collections','toy','toys','pieces',
                             'piece','gift','sports','for','adults','the','a','of','and','r'];
  title_words text[];
  canon_words text[];
  overlap_count int;
BEGIN
  SELECT name INTO canonical_name FROM sets WHERE set_number = NEW.set_number LIMIT 1;

  IF canonical_name IS NULL THEN
    NEW.title_number_mismatch := false;
    NEW.title_mismatch_detail := NULL;
    IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') AND NEW.needs_rerender THEN
      RAISE EXCEPTION 'Cannot approve story_number %: needs_rerender=true. Detail: %', NEW.story_number, NEW.rerender_note;
    END IF;
    RETURN NEW;
  END IF;

  SELECT array_agg(DISTINCT w) INTO title_words
  FROM unnest(string_to_array(lower(regexp_replace(NEW.set_title, '[^a-zA-Z0-9]+', ' ', 'g')), ' ')) w
  WHERE w <> '' AND length(w) >= 3 AND w !~ '^[0-9]+$' AND NOT (w = ANY(stopwords));

  SELECT array_agg(DISTINCT w) INTO canon_words
  FROM unnest(string_to_array(lower(regexp_replace(canonical_name, '[^a-zA-Z0-9]+', ' ', 'g')), ' ')) w
  WHERE w <> '' AND length(w) >= 3 AND w !~ '^[0-9]+$' AND NOT (w = ANY(stopwords));

  SELECT count(*) INTO overlap_count FROM unnest(title_words) t WHERE t = ANY(canon_words);

  IF overlap_count > 0 OR canon_words IS NULL THEN
    NEW.title_number_mismatch := false;
    NEW.title_mismatch_detail := NULL;
  ELSE
    NEW.title_number_mismatch := true;
    NEW.title_mismatch_detail := format(
      'set_title "%s" shares no distinctive words with master sets.name "%s" for set_number %s',
      NEW.set_title, canonical_name, NEW.set_number
    );
  END IF;

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

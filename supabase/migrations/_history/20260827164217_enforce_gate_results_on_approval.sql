-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260827164217, name enforce_gate_results_on_approval, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).


ALTER TABLE video_posts
  ADD COLUMN IF NOT EXISTS gate_override boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gate_override_reason text;

ALTER TABLE quiet_panic_posts
  ADD COLUMN IF NOT EXISTS gate_override boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gate_override_reason text;

CREATE OR REPLACE FUNCTION check_video_posts_title_consistency() RETURNS trigger AS $$
DECLARE
  canonical_name text;
  stopwords text[] := ARRAY['lego','icons','technic','ideas','art','editions','edition','set','sets','kit',
                             'building','model','models','collection','collections','toy','toys','pieces',
                             'piece','gift','sports','for','adults','the','a','of','and','r'];
  title_words text[];
  canon_words text[];
  overlap_count int;
  failed_gates text;
BEGIN
  IF NEW.mismatch_override THEN
    NEW.title_number_mismatch := false;
    IF NEW.title_mismatch_detail IS NULL OR NEW.title_mismatch_detail NOT LIKE 'Manually cleared:%' THEN
      NEW.title_mismatch_detail := COALESCE('Manually cleared: ' || NEW.override_reason, 'Manually cleared by human review.');
    END IF;
  ELSE
    SELECT name INTO canonical_name FROM sets WHERE set_number = NEW.set_number LIMIT 1;

    IF canonical_name IS NULL THEN
      NEW.title_number_mismatch := false;
      NEW.title_mismatch_detail := NULL;
    ELSE
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
    END IF;
  END IF;

  -- NEW: check gate_results itself for any real failure, unless explicitly overridden
  IF NOT NEW.gate_override AND NEW.gate_results IS NOT NULL THEN
    SELECT string_agg(key, ', ') INTO failed_gates
    FROM jsonb_each(NEW.gate_results) AS g(key, value)
    WHERE value ? 'pass' AND (value->>'pass')::boolean = false;
  ELSE
    failed_gates := NULL;
  END IF;

  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved')
     AND (NEW.title_number_mismatch OR NEW.needs_rerender OR failed_gates IS NOT NULL) THEN
    RAISE EXCEPTION 'Cannot approve story_number %: title_number_mismatch=%, needs_rerender=%, failed_gates=%. Detail: % / %',
      NEW.story_number, NEW.title_number_mismatch, NEW.needs_rerender, failed_gates,
      NEW.title_mismatch_detail, NEW.rerender_note;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_qp_posts_title_consistency() RETURNS trigger AS $$
DECLARE
  canonical_name text;
  stopwords text[] := ARRAY['lego','icons','technic','ideas','art','editions','edition','set','sets','kit',
                             'building','model','models','collection','collections','toy','toys','pieces',
                             'piece','gift','sports','for','adults','the','a','of','and','r'];
  title_words text[];
  canon_words text[];
  overlap_count int;
  failed_gates text;
BEGIN
  IF NEW.mismatch_override THEN
    NEW.title_number_mismatch := false;
    IF NEW.title_mismatch_detail IS NULL OR NEW.title_mismatch_detail NOT LIKE 'Manually cleared:%' THEN
      NEW.title_mismatch_detail := COALESCE('Manually cleared: ' || NEW.override_reason, 'Manually cleared by human review.');
    END IF;
  ELSE
    SELECT name INTO canonical_name FROM sets WHERE set_number = NEW.set_number LIMIT 1;

    IF canonical_name IS NULL THEN
      NEW.title_number_mismatch := false;
      NEW.title_mismatch_detail := NULL;
    ELSE
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
    END IF;
  END IF;

  IF NOT NEW.gate_override AND NEW.gate_results IS NOT NULL THEN
    SELECT string_agg(key, ', ') INTO failed_gates
    FROM jsonb_each(NEW.gate_results) AS g(key, value)
    WHERE value ? 'pass' AND (value->>'pass')::boolean = false;
  ELSE
    failed_gates := NULL;
  END IF;

  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved')
     AND (NEW.title_number_mismatch OR NEW.needs_rerender OR failed_gates IS NOT NULL) THEN
    RAISE EXCEPTION 'Cannot approve quiet_panic_posts row (sequence_number %): title_number_mismatch=%, needs_rerender=%, failed_gates=%. Detail: % / %',
      NEW.sequence_number, NEW.title_number_mismatch, NEW.needs_rerender, failed_gates,
      NEW.title_mismatch_detail, NEW.rerender_note;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

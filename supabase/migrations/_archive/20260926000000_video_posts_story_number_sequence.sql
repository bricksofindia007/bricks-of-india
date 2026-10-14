-- Reserve VID-P4 story numbers up front (issue #201, 2026-09-26).
--
-- Before: story_number was assigned by the BEFORE INSERT trigger
-- assign_story_number() as COALESCE(MAX(story_number), 0) + 1, so a number
-- existed only once the row did. engine.py --cloud-generate therefore
-- inserted the row as 'rendered' first (it needed the number for the Story
-- badge), then uploaded. A run killed in between left a stranded row with no
-- video (Story #73, 2026-09-24).
--
-- After: a real sequence. engine.py reserves a number with
-- reserve_story_number() (nextval), badges and uploads, and inserts the row
-- only after the upload succeeds. A killed run leaves only a gap in the
-- numbering. The trigger stays as the fallback for any insert that does not
-- supply a number (local/manual paths) and now draws from the same sequence,
-- so the two paths can never hand out the same number. UNIQUE enforces it.
--
-- DB size impact: one sequence + one unique index over 74 rows (~16 KB).

CREATE SEQUENCE IF NOT EXISTS public.video_posts_story_number_seq AS integer;
ALTER SEQUENCE public.video_posts_story_number_seq OWNED BY public.video_posts.story_number;
-- Next value = current max + 1 (74 -> 75 at time of writing).
SELECT setval('public.video_posts_story_number_seq',
              COALESCE((SELECT MAX(story_number) FROM public.video_posts), 0) + 1,
              false);

CREATE OR REPLACE FUNCTION public.assign_story_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.story_number IS NULL THEN
    NEW.story_number := nextval('public.video_posts_story_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.video_posts
  ADD CONSTRAINT video_posts_story_number_key UNIQUE (story_number);

CREATE OR REPLACE FUNCTION public.reserve_story_number()
RETURNS integer
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT nextval('public.video_posts_story_number_seq')::integer;
$$;

-- Explicit grants (default privileges no longer grant anon/authenticated
-- anything -- #188). service_role inserts rows (trigger calls nextval) and
-- calls reserve_story_number() via RPC.
REVOKE ALL ON SEQUENCE public.video_posts_story_number_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.video_posts_story_number_seq TO service_role;
REVOKE ALL ON FUNCTION public.reserve_story_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_story_number() TO service_role;

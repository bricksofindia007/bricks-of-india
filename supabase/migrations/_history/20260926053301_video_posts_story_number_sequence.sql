-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260926053301, name video_posts_story_number_sequence, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Repo file: supabase/migrations/20260926000000_video_posts_story_number_sequence.sql (issue #201)
CREATE SEQUENCE IF NOT EXISTS public.video_posts_story_number_seq AS integer;
ALTER SEQUENCE public.video_posts_story_number_seq OWNED BY public.video_posts.story_number;
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

REVOKE ALL ON SEQUENCE public.video_posts_story_number_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.video_posts_story_number_seq TO service_role;
REVOKE ALL ON FUNCTION public.reserve_story_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_story_number() TO service_role;

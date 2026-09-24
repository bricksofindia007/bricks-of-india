-- Posting cadence (issue #178, 2026-09-24). Rule (Abhinav): max 1 post per
-- day per pipeline per platform; approved rows drain one per slot; nothing
-- skipped silently.
--
-- 1. approved_at on video_posts / quiet_panic_posts, set by trigger whenever
--    status moves to 'approved' (approvals are out-of-band SQL/chat updates,
--    not app code -- a trigger is the only place that catches every path).
--    Historical rows stay NULL; nothing is back-filled or guessed.
-- 2. ig_posted_at / yt_posted_at: per-platform go-live timestamps, so a
--    missing-platform retry can count against that platform's daily cap
--    (posted_at is row-level and was never set by retries).
-- 3. publish_attempts: append-only audit of every publish/retry outcome and
--    missed-slot alert, read by the missed-slot watchdog for the "reason".
--
-- Explicit GRANTs throughout (Supabase Data API grants change effective
-- 2026-10-30, issue #182): service_role only; anon/authenticated get nothing.

ALTER TABLE public.video_posts
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS ig_posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS yt_posted_at timestamptz;

ALTER TABLE public.quiet_panic_posts
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS ig_posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS yt_posted_at timestamptz;

COMMENT ON COLUMN public.video_posts.approved_at IS 'Set by trg_set_approved_at whenever status moves to approved (issue #178). NULL for rows approved before 2026-09-24 -- not back-filled.';
COMMENT ON COLUMN public.quiet_panic_posts.approved_at IS 'Set by trg_set_approved_at whenever status moves to approved (issue #178). NULL for rows approved before 2026-09-24 -- not back-filled.';
COMMENT ON COLUMN public.video_posts.ig_posted_at IS 'When the Instagram post went live (publish or retry). Issue #178.';
COMMENT ON COLUMN public.video_posts.yt_posted_at IS 'When the YouTube post went live (publish or retry). Issue #178.';
COMMENT ON COLUMN public.quiet_panic_posts.ig_posted_at IS 'When the Instagram post went live (publish or retry). Issue #178.';
COMMENT ON COLUMN public.quiet_panic_posts.yt_posted_at IS 'When the YouTube post went live (publish or retry). Issue #178.';

CREATE OR REPLACE FUNCTION public.set_approved_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_approved_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_set_approved_at ON public.video_posts;
CREATE TRIGGER trg_set_approved_at
  BEFORE INSERT OR UPDATE OF status ON public.video_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_approved_at();

DROP TRIGGER IF EXISTS trg_set_approved_at ON public.quiet_panic_posts;
CREATE TRIGGER trg_set_approved_at
  BEFORE INSERT OR UPDATE OF status ON public.quiet_panic_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_approved_at();

CREATE TABLE IF NOT EXISTS public.publish_attempts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pipeline     text NOT NULL CHECK (pipeline IN ('vidp4', 'vidqp')),
  row_id       uuid,
  row_number   integer,
  kind         text NOT NULL CHECK (kind IN ('publish', 'retry', 'missed_slot_alert', 'error_alert')),
  platform     text CHECK (platform IS NULL OR platform IN ('ig', 'yt')),
  outcome      text NOT NULL CHECK (outcome IN ('posted', 'partial', 'failed', 'blocked', 'deferred', 'alerted')),
  detail       text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS publish_attempts_pipeline_time_idx
  ON public.publish_attempts (pipeline, attempted_at DESC);

COMMENT ON TABLE public.publish_attempts IS 'Append-only audit of video publish/retry outcomes and cadence alerts (issue #178). Read by the missed-slot watchdog. service_role only.';

-- PROCESS-RLS-01: RLS on, no policies => no anon/authenticated access.
ALTER TABLE public.publish_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.publish_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.publish_attempts TO service_role;

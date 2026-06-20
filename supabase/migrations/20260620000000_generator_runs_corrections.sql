-- PR-2b-3.5: generator_runs schema corrections
--
-- 1. Rename total_attempted → drafts_attempted (consistent drafts_* prefix for
--    future analytics columns added in PR-2b-4 monitors).
-- 2. Add "trigger" column to distinguish cron vs manual invocations.
-- 3. Replace the USING(false) FOR ALL policy with an explicit service_role allow.
--    The original policy had no TO clause, so it applied to all roles including
--    service_role. Service role has BYPASSRLS in default Supabase projects, but
--    an explicit policy is clearer and removes any ambiguity.

ALTER TABLE generator_runs RENAME COLUMN total_attempted TO drafts_attempted;

ALTER TABLE generator_runs ADD COLUMN IF NOT EXISTS "trigger" text NOT NULL DEFAULT 'manual';

DROP POLICY IF EXISTS "service role only" ON generator_runs;

CREATE POLICY "service role full access" ON generator_runs
  TO service_role
  USING (true)
  WITH CHECK (true);

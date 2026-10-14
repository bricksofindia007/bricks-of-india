-- Ensure RLS is enabled and only anon INSERT is permitted on newsletter_subscribers.
-- SELECT / UPDATE / DELETE are intentionally excluded for anon role.
-- This migration is idempotent — safe to re-run.

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'newsletter_subscribers'
      AND policyname = 'anon insert only'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "anon insert only"
        ON newsletter_subscribers
        FOR INSERT
        TO anon
        WITH CHECK (true)
    $policy$;
  END IF;
END $$;

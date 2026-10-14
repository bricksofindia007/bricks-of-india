-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260829084210, name video_posts_escalation_note, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

ALTER TABLE video_posts
  ADD COLUMN IF NOT EXISTS escalation_note jsonb;

COMMENT ON COLUMN video_posts.escalation_note IS 'Gate Remediation Architecture (2026-08-29): structured, pre-diagnosed note for a reviewer -- null for a clean story (every gate passed, or a failure was fully auto-remediated); populated only when an unresolved gate failure reaches pending_approval after remediation was attempted. Shape: {gates: [{gate, what_it_caught, technical_reason}], remediation_attempted, decision_needed}. See engine.py build_escalation_note().';

-- PR-2b-3 / PR-2b-3.6: Failover infrastructure + schema reconciliation
-- Adds provider tracking, manual review flag, lint result to pending_drafts.
-- Creates generator_runs table matching live schema as of 2026-06-20.
--
-- NOTE: The original migration file contained fantasy column names
-- (total_attempted, gemini_ok, cerebras_ok, failed, skipped, finished_at)
-- that never matched the live DB. This file is rewritten to reflect the
-- actual live schema. See 20260620120000_phase_b_reconciliation.sql for
-- the ALTER TABLE statements that brought the live DB to this state.

-- ── pending_drafts additions ──────────────────────────────────────────────────

ALTER TABLE pending_drafts
  ADD COLUMN IF NOT EXISTS provider                  text,
  ADD COLUMN IF NOT EXISTS requires_manual_approval  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lint_result               jsonb;

COMMENT ON COLUMN pending_drafts.provider IS 'LLM provider: gemini | cerebras | null (not yet generated)';
COMMENT ON COLUMN pending_drafts.requires_manual_approval IS 'True during Cerebras probation — auto-publish skipped, operator must publish manually';
COMMENT ON COLUMN pending_drafts.lint_result IS 'Serialised LintResult from the last generation run (diagnostic, nullable)';

-- ── generator_runs — live schema as of 2026-06-20 ────────────────────────────

CREATE TABLE IF NOT EXISTS generator_runs (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at               timestamptz NOT NULL DEFAULT now(),
  ended_at                 timestamptz,
  trigger                  text        NOT NULL,
  drafts_attempted         integer     NOT NULL DEFAULT 0,
  drafts_succeeded         integer     NOT NULL DEFAULT 0,
  drafts_lint_failed       integer     NOT NULL DEFAULT 0,
  drafts_deferred          integer     NOT NULL DEFAULT 0,
  drafts_routed_to_review  integer     NOT NULL DEFAULT 0,
  drafts_failed            integer     NOT NULL DEFAULT 0,
  provider_stats           jsonb,
  notes                    text
);

ALTER TABLE generator_runs ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. This policy blocks anon/authenticated access.
CREATE POLICY "service role only" ON generator_runs USING (false);

-- PR-2b-3: Failover infrastructure
-- Adds provider tracking, manual review flag, lint result to pending_drafts.
-- Creates generator_runs table for cron health monitoring.

-- ── pending_drafts additions ──────────────────────────────────────────────────

ALTER TABLE pending_drafts
  ADD COLUMN IF NOT EXISTS provider                  text,
  ADD COLUMN IF NOT EXISTS requires_manual_approval  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lint_result               jsonb;

COMMENT ON COLUMN pending_drafts.provider IS 'LLM provider: gemini | cerebras | null (not yet generated)';
COMMENT ON COLUMN pending_drafts.requires_manual_approval IS 'True during Cerebras probation — auto-publish skipped, operator must publish manually';
COMMENT ON COLUMN pending_drafts.lint_result IS 'Serialised LintResult from the last generation run (diagnostic, nullable)';

-- ── generator_runs ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS generator_runs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  total_attempted  int         NOT NULL DEFAULT 0,
  gemini_ok        int         NOT NULL DEFAULT 0,
  cerebras_ok      int         NOT NULL DEFAULT 0,
  failed           int         NOT NULL DEFAULT 0,
  skipped          int         NOT NULL DEFAULT 0,
  notes            text
);

ALTER TABLE generator_runs ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. This policy blocks anon/authenticated access.
CREATE POLICY "service role only" ON generator_runs USING (false);

-- Adds provider + token + cost tracking to video_posts and quiet_panic_posts,
-- matching the pattern pending_drafts already has (provider column, added
-- 20260619000000_failover_infrastructure.sql). Added 2026-08-19 after the
-- Aug 5-6 Cerebras token spike investigation couldn't be fully reconciled
-- from GitHub Actions logs alone -- video_posts/quiet_panic_posts had no
-- persisted record of which provider served a given generation, or how
-- many tokens it cost.

ALTER TABLE video_posts
  ADD COLUMN IF NOT EXISTS provider              text,
  ADD COLUMN IF NOT EXISTS input_tokens           integer,
  ADD COLUMN IF NOT EXISTS output_tokens          integer,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd     numeric;

COMMENT ON COLUMN video_posts.provider IS 'LLM provider that produced the script: gemini | groq | cerebras | null (legacy rows predating this column)';
COMMENT ON COLUMN video_posts.input_tokens IS 'Prompt token count for the successful generation call (system + user prompt). Null if the provider API did not return usage data.';
COMMENT ON COLUMN video_posts.output_tokens IS 'Completion token count for the successful generation call. Null if the provider API did not return usage data.';
COMMENT ON COLUMN video_posts.estimated_cost_usd IS 'Estimated cost in USD for the successful generation call, computed from input/output tokens at the provider''s published rate. Free-tier providers (Groq, Cerebras free) record 0.';

ALTER TABLE quiet_panic_posts
  ADD COLUMN IF NOT EXISTS provider              text,
  ADD COLUMN IF NOT EXISTS input_tokens           integer,
  ADD COLUMN IF NOT EXISTS output_tokens          integer,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd     numeric;

COMMENT ON COLUMN quiet_panic_posts.provider IS 'LLM provider that produced the script: gemini | groq | cerebras | null (legacy rows predating this column)';
COMMENT ON COLUMN quiet_panic_posts.input_tokens IS 'Prompt token count for the successful generation call (system + user prompt). Null if the provider API did not return usage data.';
COMMENT ON COLUMN quiet_panic_posts.output_tokens IS 'Completion token count for the successful generation call. Null if the provider API did not return usage data.';
COMMENT ON COLUMN quiet_panic_posts.estimated_cost_usd IS 'Estimated cost in USD for the successful generation call, computed from input/output tokens at the provider''s published rate. Free-tier providers (Groq, Cerebras free) record 0.';

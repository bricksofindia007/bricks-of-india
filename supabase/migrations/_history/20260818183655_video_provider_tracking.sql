-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260818183655, name video_provider_tracking, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

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

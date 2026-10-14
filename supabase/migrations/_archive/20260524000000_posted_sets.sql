-- Migration 20260524000000 — posted_sets for social automation pipeline
-- Apply via: Supabase Dashboard → SQL Editor → paste and run.
-- Tracks which sets have been posted to each social platform.
-- All IF NOT EXISTS guards make this safe to re-run.

CREATE TABLE IF NOT EXISTS posted_sets (
  id              bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  set_num         text        UNIQUE NOT NULL,
  set_name        text,
  posted_at       timestamptz DEFAULT now(),
  ig_feed_posted  boolean     DEFAULT false,
  ig_reels_posted boolean     DEFAULT false,
  yt_shorts_posted boolean    DEFAULT false
);

-- Fast dedup lookups by set number
CREATE INDEX IF NOT EXISTS idx_posted_sets_set_num
  ON posted_sets (set_num);

-- ── RLS (PROCESS-RLS-01) ───────────────────────────────────────────────────
-- Internal pipeline tracking table. No anonymous access.
-- Service role bypasses RLS implicitly — no explicit policy needed.
ALTER TABLE posted_sets ENABLE ROW LEVEL SECURITY;

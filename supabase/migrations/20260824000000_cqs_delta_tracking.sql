-- BOI Fix Brief (2026-08-24), Phase 0.2 — real delta-tracking for
-- content_quality_issues.
--
-- Root cause found: content-linter.mjs has always done a blind INSERT of
-- every currently-detected issue on every run, with no upsert/dedup
-- against already-open rows for the same (article_slug, check_name).
-- Since the linter runs daily and never stops re-flagging an unresolved
-- issue, this means the SAME real problem accumulates a fresh row every
-- single day it stays open. Verified live: 19,288 open (resolved=false)
-- rows collapse to just 1,154 distinct (article_slug, check_name) pairs
-- across 464 articles -- a ~16.7x duplication factor, accumulated since
-- the linter's first run (2026-05-28).
--
-- This, combined with content-quality-report.mjs reading both "New
-- issues today" and "Total open (all time)" via plain .select() (no
-- {count:'exact'}), meant BOTH numbers were silently capped at
-- PostgREST's default 1000-row limit -- explaining why the Aug 23 CQS
-- report showed identical "1000"/"1000" figures that summed exactly to
-- 587+374+39. The real total open was 19,288, not 1,000.
--
-- Fix, in two parts:
-- 1. This migration: add first_seen_at, dedupe the existing backlog down
--    to one canonical (oldest) open row per real issue -- marking
--    duplicates resolved rather than deleting them, since
--    content_fix_log.issue_id may reference any of them -- then add a
--    partial unique index so the new upsert logic (content-linter.mjs)
--    can enforce "at most one open row per real issue" going forward.
-- 2. content-linter.mjs switches from blind INSERT to upsert-by-
--    (article_slug, check_name): a recurring issue touches checked_at
--    only (first_seen_at stays put); a genuinely new issue gets a fresh
--    first_seen_at; anything no longer detected gets auto-resolved.
--    content-quality-report.mjs switches "New issues today" to
--    first_seen_at-based (genuinely new) and both open-issue counts to
--    real {count:'exact', head:true} queries instead of capped arrays.

ALTER TABLE content_quality_issues
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz;

-- Backfill every row's first_seen_at from its own checked_at as a
-- starting point (refined for canonical open rows below).
UPDATE content_quality_issues
SET first_seen_at = checked_at
WHERE first_seen_at IS NULL;

-- For every (article_slug, check_name) currently open in more than one
-- row, the canonical (oldest) row's first_seen_at becomes the TRUE
-- earliest detection across the whole duplicate group -- not just its
-- own checked_at, which for most of these rows is actually some
-- mid-history re-flag, not the original detection.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY article_slug, check_name ORDER BY checked_at ASC) AS rn,
         MIN(checked_at) OVER (PARTITION BY article_slug, check_name) AS earliest_checked_at
  FROM content_quality_issues
  WHERE resolved = false
)
UPDATE content_quality_issues cqi
SET first_seen_at = ranked.earliest_checked_at
FROM ranked
WHERE cqi.id = ranked.id AND ranked.rn = 1;

-- Every other duplicate in the group: mark resolved (not deleted -- FK
-- from content_fix_log.issue_id may point at any of them), with a note
-- explaining why, distinct from a real content fix.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY article_slug, check_name ORDER BY checked_at ASC) AS rn
  FROM content_quality_issues
  WHERE resolved = false
)
UPDATE content_quality_issues cqi
SET resolved = true,
    resolved_at = now(),
    fix_detail = trim(both ' ' from COALESCE(fix_detail, '') || ' [deduped 2026-08-24: superseded by canonical open row for the same article_slug+check_name -- see BOI Fix Brief Phase 0.2]')
FROM ranked
WHERE cqi.id = ranked.id AND ranked.rn > 1;

-- Now safe: at most one resolved=false row per (article_slug, check_name).
CREATE UNIQUE INDEX IF NOT EXISTS content_quality_issues_open_unique
  ON content_quality_issues (article_slug, check_name)
  WHERE resolved = false;

CREATE INDEX IF NOT EXISTS content_quality_issues_first_seen_at_idx
  ON content_quality_issues (first_seen_at);

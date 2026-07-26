-- VID-P4: rejection-exception workflow -- root-cause triage, auto-fix
-- routing, and priority requeue. Applied directly via Supabase MCP
-- (apply_migration); this file is the local record, matching the repo's
-- existing migration-history convention.
--
-- Context: story #16 (set 71837, NINJAGO City Workshops) was rejected
-- 2026-07-26 for wrong pricing -- root cause was sets.lego_mrp_inr holding
-- an unverified international-price conversion estimate instead of the
-- real India MRP. That specific fix was done manually via direct Supabase
-- access. This migration makes the *next* one of these self-triaging
-- instead of a fresh manual investigation each time.

-- ── 0. Fix duplicate content_rejections rows ────────────────────────────────
-- Root cause: video_posts_discard_trigger (added 20260707140000) fires
-- unconditionally on any transition to status='discarded', inserting a
-- content_rejections row with rejection_reason left NULL (not in its insert
-- column list). Chat Claude's separate manual insert (carrying the
-- operator's real reason) then created a SECOND row for the same event.
-- Confirmed live 2026-07-26 on story #16 (set 71837): two rows existed, the
-- null-reason one manually deleted to clean up.
--
-- Fix: single reject_video_post() RPC that does both writes (status update
-- + rejection insert, with the real reason) in one transaction. Trigger
-- removed entirely -- chat Claude (and any future terminal path) must call
-- this RPC, not a raw UPDATE on video_posts.status, to reject a row.
DROP TRIGGER IF EXISTS video_posts_discard_trigger ON video_posts;
DROP FUNCTION IF EXISTS create_content_rejection_on_discard();

-- ── 1. Root-cause classification ────────────────────────────────────────────
-- Simple keyword rule, no LLM call -- cheap and sufficient for a coarse
-- routing signal. Checked in a fixed priority order since a real reason can
-- mention more than one thing at once (e.g. story #16's actual reason,
-- "Set details and pricing are wrong. Rework needed." -- matches both
-- pricing and set_details keywords; pricing wins by being checked first,
-- matching this migration's own example ordering).
CREATE OR REPLACE FUNCTION classify_rejection_reason(p_reason text)
RETURNS text AS $$
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RETURN 'other';
  END IF;

  IF p_reason ~* '(price|pricing|mrp|cost|rupee)' THEN
    RETURN 'pricing';
  ELSIF p_reason ~* '(piece count|piece|pieces|part count|parts)' THEN
    RETURN 'piece_count';
  ELSIF p_reason ~* '(wrong set|set number|theme|title|set name|set detail)' THEN
    RETURN 'set_details';
  ELSIF p_reason ~* '(voice|audio|tts|narrat|pronoun)' THEN
    RETURN 'voice_quality';
  ELSE
    RETURN 'other';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE content_rejections ADD COLUMN IF NOT EXISTS rejection_category text;
ALTER TABLE content_rejections
  ADD CONSTRAINT content_rejections_category_check
  CHECK (rejection_category IS NULL OR rejection_category IN
    ('pricing', 'piece_count', 'set_details', 'voice_quality', 'other'));

-- Backfill classification for existing rows with a real reason -- pure
-- labeling, no side effects, safe to run against history. Deliberately does
-- NOT re-run the §2 MRP auto-flag logic below against these rows -- several
-- (including story #16 itself) have already been manually root-caused and
-- re-verified; re-flagging them now would wrongly reopen an already-closed
-- case.
UPDATE content_rejections
SET rejection_category = classify_rejection_reason(rejection_reason)
WHERE rejection_category IS NULL AND rejection_reason IS NOT NULL;

-- ── 3. Priority requeue columns (used by reject_video_post() below and by
-- engine.py's get_candidates()/insert_video_post()) ─────────────────────────
ALTER TABLE content_rejections ADD COLUMN IF NOT EXISTS regeneration_priority boolean NOT NULL DEFAULT true;
ALTER TABLE content_rejections ADD COLUMN IF NOT EXISTS requeued_at timestamptz;
-- Gate is always review_status='cleared_for_regeneration' AND
-- regeneration_priority=true together (see engine.py) -- a 'pending' row
-- defaulting to regeneration_priority=true is inert until it's also cleared,
-- so no trigger is needed just to set this at clear-time.

-- ── 2. Single write-path RPC: reject + classify + MRP-reverify flag ─────────
-- Combines the status update, the rejection insert (with real reason and
-- category), and the sets-table re-verification flag into one transaction
-- and one call site, replacing both the old trigger and the old two-write
-- pattern. Row-locks the video_posts row (FOR UPDATE) and refuses a second
-- call against an already-discarded row -- the same guarantee the old
-- trigger held, now enforced without depending on two independent writers
-- not stepping on each other.
CREATE OR REPLACE FUNCTION reject_video_post(p_video_id uuid, p_reason text)
RETURNS uuid AS $$
DECLARE
  v_current_status text;
  v_set_number     text;
  v_set_title      text;
  v_story_number   integer;
  v_rejection_id   uuid;
  v_category       text;
BEGIN
  SELECT status, set_number, set_title, story_number
    INTO v_current_status, v_set_number, v_set_title, v_story_number
    FROM video_posts
    WHERE id = p_video_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'video_posts row % not found', p_video_id;
  END IF;

  IF v_current_status = 'discarded' THEN
    RAISE EXCEPTION 'video_posts row % is already discarded -- call reject_video_post exactly once per rejection', p_video_id;
  END IF;

  UPDATE video_posts SET status = 'discarded' WHERE id = p_video_id;

  v_category := classify_rejection_reason(p_reason);

  INSERT INTO content_rejections
    (video_post_id, set_number, set_title, story_number, rejection_reason, rejection_category)
  VALUES
    (p_video_id, v_set_number, v_set_title, v_story_number, p_reason, v_category)
  RETURNING id INTO v_rejection_id;

  -- §2 auto-verification routing: for the three catalog-data-adjacent
  -- categories, flag the set for re-verification via the existing MRP-audit
  -- queue (sets.mrp_verified/mrp_review_reason) rather than building a
  -- separate re-verification surface. Only if mrp_verified was previously
  -- true -- a row already false/'unverified_estimate' is already correctly
  -- queued, and this must not clobber a more specific existing reason (e.g.
  -- 'cmf_box_ambiguity'). Does NOT touch the price itself -- that still
  -- requires a live retailer lookup by a human or chat/terminal Claude.
  IF v_category IN ('pricing', 'piece_count', 'set_details') AND v_set_number IS NOT NULL THEN
    UPDATE sets
    SET mrp_verified = false,
        mrp_review_reason = 'operator_flagged_incorrect'
    WHERE set_number = v_set_number
      AND mrp_verified = true;
  END IF;

  RETURN v_rejection_id;
END;
$$ LANGUAGE plpgsql;

-- Admin-only, same posture as the tables it touches (RLS enabled, zero
-- anon/authenticated policies) -- explicit REVOKE/GRANT rather than relying
-- on Postgres's PUBLIC-EXECUTE-by-default behavior for new functions.
REVOKE ALL ON FUNCTION reject_video_post(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reject_video_post(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION classify_rejection_reason(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION classify_rejection_reason(text) TO service_role;

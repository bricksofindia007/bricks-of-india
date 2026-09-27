-- Reviews table rating/verdict decoupling (2026-07-09).
-- rating was previously always derived from verdict at publish time
-- (VERDICT_TO_RATING map in publish-draft.ts) -- confirmed across all 18
-- existing reviews rows, rating tracked verdict with essentially no
-- independent variation. The model now outputs an independent RATING in
-- its structured response (see draft-prompt.ts RATING CRITERIA), persisted
-- here so it survives between the "Generate Article" and "Publish" admin
-- actions, which run as separate steps.

ALTER TABLE pending_drafts ADD COLUMN IF NOT EXISTS draft_rating integer;

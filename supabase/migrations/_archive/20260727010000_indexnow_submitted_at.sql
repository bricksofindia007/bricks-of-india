-- Recrawl acceleration, replacing the dead Google sitemap ping
-- (deprecated June 2023, confirmed live via a real ping returning 404 --
-- see BOI_MASTER_TRACKER.md §Recrawl acceleration). IndexNow needs a way
-- to know which sets have already been submitted so the ongoing sync
-- script (scripts/indexnow-sync-sets.ts) only submits new/changed rows,
-- not the entire tier1/tier2 pool every run.
ALTER TABLE sets ADD COLUMN IF NOT EXISTS indexnow_submitted_at timestamptz;

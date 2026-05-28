-- Fix pending_drafts.draft_verdict constraint to match Gemini prompt rewrite
-- Old values: 'BUY', 'WAIT FOR SALE', 'IMPORT ONLY', 'SKIP'
-- New values: 'BUY NOW', 'WAIT', 'IMPORT ONLY', 'AVOID'
-- Must DROP constraint before UPDATEs — constraint rejects new values on write

-- 1. Drop old constraint first
ALTER TABLE pending_drafts DROP CONSTRAINT IF EXISTS pending_drafts_draft_verdict_check;

-- 2. Migrate existing rows with old verdict values
UPDATE pending_drafts SET draft_verdict = 'BUY NOW' WHERE draft_verdict = 'BUY';
UPDATE pending_drafts SET draft_verdict = 'WAIT'    WHERE draft_verdict = 'WAIT FOR SALE';
UPDATE pending_drafts SET draft_verdict = 'AVOID'   WHERE draft_verdict = 'SKIP';
-- 'IMPORT ONLY' is unchanged

-- 3. Add new constraint matching current Gemini prompt output
ALTER TABLE pending_drafts
  ADD CONSTRAINT pending_drafts_draft_verdict_check
  CHECK (draft_verdict IN ('BUY NOW', 'WAIT', 'IMPORT ONLY', 'AVOID'));

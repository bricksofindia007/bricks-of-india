-- Rollback for the backlog stale-reject data fix. Run by hand, in one transaction, only when approved.
-- Returns exactly the rows the fix marked (discard_reason = 'stale backlog') to 'draft' with no reason.
-- The fix only ever touched rows whose discard_reason was null, so the rollback restores that state.
-- Stops if the marker count is not the count the fix recorded (rows changed after the fix).
DO $$
DECLARE
  marked integer;
BEGIN
  SELECT count(*) INTO marked FROM public.pending_drafts WHERE discard_reason = 'stale backlog';
  RAISE NOTICE 'backlog rollback: rows carrying the marker %', marked;
  IF marked = 0 THEN
    RAISE NOTICE 'backlog rollback: nothing to roll back';
    RETURN;
  END IF;
  UPDATE public.pending_drafts
  SET status = 'draft', discard_reason = NULL, updated_at = now()
  WHERE discard_reason = 'stale backlog' AND status = 'rejected';
  RAISE NOTICE 'backlog rollback: rows returned to draft %', marked;
END $$;

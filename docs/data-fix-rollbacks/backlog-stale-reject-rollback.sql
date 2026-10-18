-- Rollback for the backlog stale-reject data fix. Run by hand, in one transaction, only when approved.
-- Restores, for exactly the marker rows, the status, discard_reason, approved_at and approved_by saved by the fix
-- in boi_backups.public__pending_drafts__backlog. Nothing is set to NULL and no value is invented.
-- updated_at is not restored: the trigger on pending_drafts rewrites it on every update.
-- Stops (rolls back) if the number of rows restored is not the number of marker rows.
DO $$
DECLARE
  marked integer;
  restored integer;
BEGIN
  IF to_regclass('boi_backups.public__pending_drafts__backlog') IS NULL THEN
    RAISE EXCEPTION 'backlog rollback: no saved copy (boi_backups.public__pending_drafts__backlog); nothing rolled back';
  END IF;
  SELECT count(*) INTO marked FROM public.pending_drafts WHERE discard_reason = 'stale backlog';
  RAISE NOTICE 'backlog rollback: rows carrying the marker %', marked;

  UPDATE public.pending_drafts p
  SET status = b.status, discard_reason = b.discard_reason, approved_at = b.approved_at, approved_by = b.approved_by
  FROM boi_backups.public__pending_drafts__backlog b
  WHERE b.id = p.id
    AND p.discard_reason = 'stale backlog';
  GET DIAGNOSTICS restored = ROW_COUNT;

  IF restored <> marked THEN
    RAISE EXCEPTION 'backlog rollback: restored % rows but % carry the marker; rolled back', restored, marked;
  END IF;
  RAISE NOTICE 'backlog rollback: rows restored to their saved values %', restored;
END $$;

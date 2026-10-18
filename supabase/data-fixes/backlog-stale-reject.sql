-- boi:issue backlog-stale-reject
-- boi:backup-tables public.pending_drafts
-- Status change only: stale draft rows are set to 'rejected' with a visible marker. Nothing is deleted.
-- Cutoffs are fixed: news drafts created before 2026-10-04 03:54 UTC; review drafts created before 2026-09-18 03:54 UTC.
-- Guard: the whole change stops (rolls back) unless the news count is within 3 of 184 and the review count is exactly 7.
-- Rollback: supabase/data-fix-rollbacks (docs/data-fix-rollbacks/backlog-stale-reject-rollback.sql).
DO $$
DECLARE
  news_n integer;
  review_n integer;
  marked_before integer;
BEGIN
  SELECT count(*) INTO marked_before FROM public.pending_drafts WHERE discard_reason = 'stale backlog';
  IF marked_before <> 0 THEN
    RAISE EXCEPTION 'backlog fix: % rows already carry the marker; stopped', marked_before;
  END IF;

  SELECT count(*) INTO news_n FROM public.pending_drafts
  WHERE status = 'draft' AND draft_format = 'news' AND created_at < '2026-10-04 03:54:00+00';
  SELECT count(*) INTO review_n FROM public.pending_drafts
  WHERE status = 'draft' AND draft_format = 'review' AND created_at < '2026-09-18 03:54:00+00';
  RAISE NOTICE 'backlog fix: news rows to reject %, review rows to reject %', news_n, review_n;

  IF abs(news_n - 184) > 3 OR review_n <> 7 THEN
    RAISE EXCEPTION 'backlog fix: counts outside the agreed guard (news %, expected 184 +/- 3; reviews %, expected 7); stopped', news_n, review_n;
  END IF;

  UPDATE public.pending_drafts
  SET status = 'rejected', discard_reason = 'stale backlog', updated_at = now()
  WHERE status = 'draft'
    AND ((draft_format = 'news' AND created_at < '2026-10-04 03:54:00+00')
      OR (draft_format = 'review' AND created_at < '2026-09-18 03:54:00+00'));
  RAISE NOTICE 'backlog fix: rows rejected %', news_n + review_n;
END $$;

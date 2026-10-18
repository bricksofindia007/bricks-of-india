-- boi:issue 625
-- boi:backup-tables public.pending_drafts
-- boi:expect-before select count(*) from public.pending_drafts where status = 'draft' and ((draft_format = 'news' and created_at < '2026-10-04 03:54:00+00') or (draft_format = 'review' and created_at < '2026-09-18 03:54:00+00')) = 191
-- boi:expect-after select count(*) from public.pending_drafts where discard_reason = 'stale backlog' = 191
-- Sets status to rejected, with a visible reason, on draft rows created before two fixed cutoffs. Nothing is deleted.
-- Guard: stops unless the news and review counts are within the agreed range. The original values are saved first.
-- updated_at is set by the table trigger.
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

  -- Save the original values first. Fails if the table already exists (a second run must not overwrite the first copy).
  CREATE TABLE boi_backups.public__pending_drafts__backlog AS
    SELECT id, status, discard_reason, approved_at, approved_by
    FROM public.pending_drafts
    WHERE status = 'draft'
      AND ((draft_format = 'news' AND created_at < '2026-10-04 03:54:00+00')
        OR (draft_format = 'review' AND created_at < '2026-09-18 03:54:00+00'));

  UPDATE public.pending_drafts
  SET status = 'rejected', discard_reason = 'stale backlog', updated_at = now()
  WHERE id IN (SELECT id FROM boi_backups.public__pending_drafts__backlog);
  RAISE NOTICE 'backlog fix: rows rejected %', news_n + review_n;
END $$;

-- Rollback for data fix 586 (standard line on unlisted reviews).
-- Kept out of the fixes folder so it is not applied as a fix. Run by hand, in one transaction, only when approved.
-- Removes exactly the block the fix added ("blank line + standard line") from rows that had no line in the pre-fix backup.
-- Rows that already had a line before the fix are not touched. Running it twice changes nothing the second time.
-- Uses the most recent public.reviews backup in boi_backups (made by the fix run before it applied anything).
DO $$
DECLARE
  bt text;
  n integer;
  wait_line text := 'Standard disclaimer: if you''re rich, you can skip the verdict and just buy it. The rest of us will be here doing math before we hit checkout.';
  buy_line text := 'Standard disclaimer: if you''ve got the money, obviously buy it — that''s what the verdict says too, for once we all agree.';
BEGIN
  SELECT table_name INTO bt
  FROM information_schema.tables
  WHERE table_schema = 'boi_backups' AND table_name LIKE 'public__reviews__%'
  ORDER BY table_name DESC
  LIMIT 1;
  IF bt IS NULL THEN
    RAISE EXCEPTION 'no public.reviews backup found in boi_backups; nothing rolled back';
  END IF;

  -- Each block must touch exactly the rows the fix added (52 WAIT, 6 BUY NOW); anything else stops the rollback.
  EXECUTE format($f$
    UPDATE public.reviews r
    SET content = replace(r.content, E'\n\n' || %L, '')
    FROM boi_backups.%I b
    WHERE b.id = r.id
      AND position('Standard disclaimer:' in b.content) = 0
      AND position(%L in r.content) > 0
  $f$, wait_line, bt, wait_line);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 52 THEN
    RAISE EXCEPTION 'rollback touched % WAIT rows, expected 52; rolled back', n;
  END IF;

  EXECUTE format($f$
    UPDATE public.reviews r
    SET content = replace(r.content, E'\n\n' || %L, '')
    FROM boi_backups.%I b
    WHERE b.id = r.id
      AND position('Standard disclaimer:' in b.content) = 0
      AND position(%L in r.content) > 0
  $f$, buy_line, bt, buy_line);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 6 THEN
    RAISE EXCEPTION 'rollback touched % BUY NOW rows, expected 6; rolled back', n;
  END IF;
END
$$;

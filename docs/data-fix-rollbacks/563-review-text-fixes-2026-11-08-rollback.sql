-- Rollback for data fix 563 (review text fixes: piece counts, 40912 price, marker B). Order 1580 item 3.
-- Kept out of the fixes folder so it is not applied as a fix. Run by hand, in one transaction, only when approved.
-- Restores the content of exactly the rows the fix changed, from the most recent public.reviews backup in boi_backups
-- (the fix run makes that backup before it applies anything). Every other row is left alone.
-- Target rows: the five slugs of the text fixes, and every review that now holds the marker (the marker rows were the
-- published reviews with no source_retailer). Rows with no difference from the backup are not touched, so a second run changes nothing.
DO $$
DECLARE
  bt text;
  n integer;
  marker text := '*Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today''s.*';
BEGIN
  SELECT table_name INTO bt
  FROM information_schema.tables
  WHERE table_schema = 'boi_backups' AND table_name LIKE 'public__reviews__%'
  ORDER BY table_name DESC
  LIMIT 1;
  IF bt IS NULL THEN
    RAISE EXCEPTION 'no public.reviews backup found in boi_backups; nothing rolled back';
  END IF;

  EXECUTE format($f$
    UPDATE public.reviews r
    SET content = b.content
    FROM boi_backups.%I b
    WHERE b.id = r.id
      AND r.content IS DISTINCT FROM b.content
      AND (
        r.slug IN (
          'lego-dragon-stone-shrine-71819-worth-11899',
          'lego-heartlake-city-grand-hotel-42704-worth-15999',
          'lego-heartlake-city-grand-hotel-42704-worth-15999-2',
          'lego-kakamora-barge-43258-worth-10999',
          'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag'
        )
        OR position(%L in r.content) > 0
      )
  $f$, bt, marker);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'rollback 563 restored % row(s) from %', n, bt;
END
$$;

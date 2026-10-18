-- Rollback for data fix A1 (standard line on four reviews: three IMPORT ONLY, one HUNT IT).
-- Kept out of the fixes folder so it is not applied as a fix. Run by hand, in one transaction, only when approved.
-- Removes exactly the block A1 added ("blank line + standard line") from the four slugs, and only where the
-- pre-fix backup had no line. Running it twice changes nothing the second time.
-- Uses the most recent public.reviews backup in boi_backups (made by the fix run before it applied anything).
DO $$
DECLARE
  bt text;
  n integer;
  import_line text := 'Standard disclaimer: if you''re rich, you can import it and skip the wait. The rest of us will be here checking whether an Indian store ever stocks it, and doing the sums first. If you''re determined enough to import this one, do the maths on freight and customs first.';
  hunt_line text := 'Standard disclaimer: if you''re rich, you can skip the hunt and just buy it. The rest of us will be out looking for a better deal before we check out.';
BEGIN
  SELECT table_name INTO bt
  FROM information_schema.tables
  WHERE table_schema = 'boi_backups' AND table_name LIKE 'public__reviews__%'
  ORDER BY table_name DESC
  LIMIT 1;
  IF bt IS NULL THEN
    RAISE EXCEPTION 'no public.reviews backup found in boi_backups; nothing rolled back';
  END IF;

  -- Each block must touch exactly the rows A1 added (3 IMPORT ONLY, 1 HUNT IT); anything else stops the rollback.
  EXECUTE format($f$
    UPDATE public.reviews r
    SET content = replace(r.content, E'\n\n' || %L, '')
    FROM boi_backups.%I b
    WHERE b.id = r.id
      AND r.slug IN ('lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag', 'lego-darth-vaders-lightsaber-40897-worth-the-import-price', 'lego-tribute-to-leonardo-da-vinci-40902-worth-19600')
      AND position('Standard disclaimer:' in b.content) = 0
      AND position(%L in r.content) > 0
  $f$, import_line, bt, import_line);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN
    RAISE EXCEPTION 'rollback touched % IMPORT ONLY rows, expected 3; rolled back', n;
  END IF;

  EXECUTE format($f$
    UPDATE public.reviews r
    SET content = replace(r.content, E'\n\n' || %L, '')
    FROM boi_backups.%I b
    WHERE b.id = r.id
      AND r.slug = 'lego-daily-bugle-76178-worth-39999'
      AND position('Standard disclaimer:' in b.content) = 0
      AND position(%L in r.content) > 0
  $f$, hunt_line, bt, hunt_line);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'rollback touched % HUNT IT rows, expected 1; rolled back', n;
  END IF;
END
$$;

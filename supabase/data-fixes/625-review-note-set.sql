-- boi:issue 625
-- boi:backup-tables public.reviews
-- boi:expect-before select case when (select count(*) from public.reviews where slug in ('lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag', 'lego-darth-vaders-lightsaber-40897-worth-the-import-price', 'lego-tribute-to-leonardo-da-vinci-40902-worth-19600', 'lego-daily-bugle-76178-worth-39999') and position('Standard disclaimer:' in content) = 0) = 4 and (select left(md5(string_agg(id::text || ':' || content, ',' order by id)), 12) from public.reviews where slug in ('lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag', 'lego-darth-vaders-lightsaber-40897-worth-the-import-price', 'lego-tribute-to-leonardo-da-vinci-40902-worth-19600', 'lego-daily-bugle-76178-worth-39999')) = '2552dda3844e' then 1 else 0 end = 1
-- boi:expect-after select count(*) from public.reviews where slug in ('lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag', 'lego-darth-vaders-lightsaber-40897-worth-the-import-price', 'lego-tribute-to-leonardo-da-vinci-40902-worth-19600', 'lego-daily-bugle-76178-worth-39999') and position('Standard disclaimer:' in content) = 0 = 0
-- Adds one fixed line after the last verdict line of four reviews (three import-only, one hunt). Nothing else changes.
-- Rows that already carry the line are not touched, so a second run finds no targets.
UPDATE public.reviews
SET content = regexp_replace(content, '^(.*Verdict: IMPORT ONLY\.[^\n]*)', '\1' || chr(10) || chr(10) || 'Standard disclaimer: if you''re rich, you can import it and skip the wait. The rest of us will be here checking whether an Indian store ever stocks it, and doing the sums first. If you''re determined enough to import this one, do the maths on freight and customs first.')
WHERE slug IN (
  'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag',
  'lego-darth-vaders-lightsaber-40897-worth-the-import-price',
  'lego-tribute-to-leonardo-da-vinci-40902-worth-19600'
)
  AND position('Standard disclaimer:' in content) = 0;

UPDATE public.reviews
SET content = regexp_replace(content, '^(.*Verdict: HUNT IT\.[^\n]*)', '\1' || chr(10) || chr(10) || 'Standard disclaimer: if you''re rich, you can skip the hunt and just buy it. The rest of us will be out looking for a better deal before we check out.')
WHERE slug = 'lego-daily-bugle-76178-worth-39999'
  AND position('Standard disclaimer:' in content) = 0;

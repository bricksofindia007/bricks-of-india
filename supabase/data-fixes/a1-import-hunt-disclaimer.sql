-- boi:issue A1
-- boi:backup-tables public.reviews
-- boi:expect-before select case when (select count(*) from public.reviews where slug in ('lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag', 'lego-darth-vaders-lightsaber-40897-worth-the-import-price', 'lego-tribute-to-leonardo-da-vinci-40902-worth-19600', 'lego-daily-bugle-76178-worth-39999') and position('Standard disclaimer:' in content) = 0) = 4 and (select left(md5(string_agg(id::text || ':' || content, ',' order by id)), 12) from public.reviews where slug in ('lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag', 'lego-darth-vaders-lightsaber-40897-worth-the-import-price', 'lego-tribute-to-leonardo-da-vinci-40902-worth-19600', 'lego-daily-bugle-76178-worth-39999')) = 'PIN_AT_RELEASE' then 1 else 0 end = 1
-- boi:expect-after select count(*) from public.reviews where slug in ('lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag', 'lego-darth-vaders-lightsaber-40897-worth-the-import-price', 'lego-tribute-to-leonardo-da-vinci-40902-worth-19600', 'lego-daily-bugle-76178-worth-39999') and position('Standard disclaimer:' in content) = 0 = 0
-- Content fingerprint: left(md5(string_agg(id::text || ':' || content, ',' order by id)), 12) over the four rows.
-- It is a content check (did the text change since it was read), not a credential. Twelve hex characters are
-- enough to catch any change to these four rows. The value PIN_AT_RELEASE is a placeholder: the runner stops on it.
-- At release, read the fingerprint from production with the same query and put it in place of PIN_AT_RELEASE.
-- Adds the approved standard line (owner approved option B on 17 Oct 2026) after the last "Verdict:" line of
-- four reviews: three IMPORT ONLY and one HUNT IT. Nothing else in any review is changed.
-- Rows that already carry "Standard disclaimer:" are not touched. Idempotent: a second run finds no targets.
-- Rollback: docs/data-fix-rollbacks/a1-import-hunt-disclaimer-rollback.sql.
UPDATE public.reviews
SET content = regexp_replace(content, '^(.*Verdict: IMPORT ONLY\.[^\n]*)', '\1' || chr(10) || chr(10) || 'Standard disclaimer: if you''re rich, you can import it and skip the wait. The rest of us will be here checking whether an Indian store ever stocks it, and doing the sums first.')
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

-- boi:issue 586
-- boi:backup-tables public.reviews
-- boi:expect-before select case when (select count(*) from public.reviews where source_retailer is null and verdict = 'WAIT' and position('Standard disclaimer:' in content) = 0) = 52 and (select count(*) from public.reviews where source_retailer is null and verdict = 'BUY NOW' and position('Standard disclaimer:' in content) = 0) = 6 and (select md5(string_agg(id::text || ':' || md5(content), ',' order by id)) from public.reviews where source_retailer is null and verdict = 'WAIT' and position('Standard disclaimer:' in content) = 0) = '7e6ef037701873bdc353b195dbc66e39' and (select md5(string_agg(id::text || ':' || md5(content), ',' order by id)) from public.reviews where source_retailer is null and verdict = 'BUY NOW' and position('Standard disclaimer:' in content) = 0) = '7fece1ae5e2d0cd6fa481023f8ba0956' then 1 else 0 end = 1
-- boi:expect-after select count(*) from public.reviews where source_retailer is null and verdict in ('WAIT', 'BUY NOW') and position('Standard disclaimer:' in content) = 0 = 0
-- Adds the standard closing line to published reviews that have no store recorded and lack it.
-- Targets: no store, verdict WAIT or BUY NOW, and no "Standard disclaimer:" in the text. The before-assert is 52 WAIT and 6 BUY NOW,
-- with a content guard for each set (md5 over id and content, in id order). If the live data differs, nothing is applied.
-- The line goes after the LAST "Verdict: X." line, with a blank line before it. An earlier verdict line in the same review is not
-- changed, and the blank line after the last verdict line is kept. Nothing else in any review is changed.
-- The after-assert expects no such review without the line.
-- Idempotent: a second run finds no targets, so the before-assert fails and the run rolls back.
-- Rollback: docs/data-fix-rollbacks/586-review-standard-line-rollback.sql.

UPDATE public.reviews
SET content = regexp_replace(content, '^(.*Verdict: WAIT\.[^\n]*)', '\1' || chr(10) || chr(10) || 'Standard disclaimer: if you''re rich, you can skip the verdict and just buy it. The rest of us will be here doing math before we hit checkout.')
WHERE source_retailer is null
  AND verdict = 'WAIT'
  AND position('Standard disclaimer:' in content) = 0;

UPDATE public.reviews
SET content = regexp_replace(content, '^(.*Verdict: BUY NOW\.[^\n]*)', '\1' || chr(10) || chr(10) || 'Standard disclaimer: if you''ve got the money, obviously buy it — that''s what the verdict says too, for once we all agree.')
WHERE source_retailer is null
  AND verdict = 'BUY NOW'
  AND position('Standard disclaimer:' in content) = 0;

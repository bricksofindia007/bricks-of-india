-- boi:issue 586
-- boi:backup-tables public.reviews
-- boi:expect-before select case when (select count(*) from public.reviews where source_retailer is null and verdict = 'WAIT' and position('Standard disclaimer:' in content) = 0 and char_length(content) - char_length(replace(content, 'Verdict: WAIT.', '')) = char_length('Verdict: WAIT.')) = 49 and (select count(*) from public.reviews where source_retailer is null and verdict = 'BUY NOW' and position('Standard disclaimer:' in content) = 0 and char_length(content) - char_length(replace(content, 'Verdict: BUY NOW.', '')) = char_length('Verdict: BUY NOW.')) = 5 and (select md5(string_agg(id::text || ':' || md5(content), ',' order by id)) from public.reviews where source_retailer is null and verdict = 'WAIT' and position('Standard disclaimer:' in content) = 0 and char_length(content) - char_length(replace(content, 'Verdict: WAIT.', '')) = char_length('Verdict: WAIT.')) = 'bcbcc77821ee3c01516161fe4db1a5f2' and (select md5(string_agg(id::text || ':' || md5(content), ',' order by id)) from public.reviews where source_retailer is null and verdict = 'BUY NOW' and position('Standard disclaimer:' in content) = 0 and char_length(content) - char_length(replace(content, 'Verdict: BUY NOW.', '')) = char_length('Verdict: BUY NOW.')) = 'e0bc5faf36466284b12c7f03f669fb46' then 1 else 0 end = 1
-- boi:expect-after select case when (select count(*) from public.reviews where source_retailer is null and verdict = 'WAIT' and position('Standard disclaimer: if you''re rich, you can skip the verdict and just buy it. The rest of us will be here doing math before we hit checkout.' in content) > 0) = 49 and (select count(*) from public.reviews where source_retailer is null and verdict in ('WAIT', 'BUY NOW') and position('Standard disclaimer:' in content) = 0) = 4 then 1 else 0 end = 1
-- Adds the standard closing line to published reviews that have no store recorded and lack it.
-- Targets are chosen by condition: no store, verdict WAIT or BUY NOW, no "Standard disclaimer:" in the text, and exactly one
-- "Verdict: X." line. The before-assert is 49 WAIT and 5 BUY NOW, with a content guard for each set (md5 over id and content, in id order).
-- Four reviews without a single verdict line are not targets and are left as they are; the after-assert expects exactly those four still without a line.
-- The line goes after the verdict paragraph, with a blank line before it. Nothing else in any review is changed.
-- Idempotent: a second run finds no targets, so the before-assert fails and the run rolls back.
-- Rollback: docs/data-fix-rollbacks/586-review-standard-line-rollback.sql.

UPDATE public.reviews
SET content = regexp_replace(content, '(Verdict: WAIT\.[^\n]*)', '\1' || chr(10) || chr(10) || 'Standard disclaimer: if you''re rich, you can skip the verdict and just buy it. The rest of us will be here doing math before we hit checkout.')
WHERE source_retailer is null
  AND verdict = 'WAIT'
  AND position('Standard disclaimer:' in content) = 0
  AND char_length(content) - char_length(replace(content, 'Verdict: WAIT.', '')) = char_length('Verdict: WAIT.');

UPDATE public.reviews
SET content = regexp_replace(content, '(Verdict: BUY NOW\.[^\n]*)', '\1' || chr(10) || chr(10) || 'Standard disclaimer: if you''ve got the money, obviously buy it — that''s what the verdict says too, for once we all agree.')
WHERE source_retailer is null
  AND verdict = 'BUY NOW'
  AND position('Standard disclaimer:' in content) = 0
  AND char_length(content) - char_length(replace(content, 'Verdict: BUY NOW.', '')) = char_length('Verdict: BUY NOW.');

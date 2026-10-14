-- boi:issue 586
-- boi:backup-tables public.reviews
-- boi:expect-before select (select count(*) from public.reviews where source_retailer is null and verdict = 'WAIT' and position('Standard disclaimer:' in content) = 0 and char_length(content) - char_length(replace(content, 'Verdict: WAIT.', '')) = char_length('Verdict: WAIT.')) * 1000 + (select count(*) from public.reviews where source_retailer is null and verdict = 'BUY NOW' and position('Standard disclaimer:' in content) = 0 and char_length(content) - char_length(replace(content, 'Verdict: BUY NOW.', '')) = char_length('Verdict: BUY NOW.')) = 51006
-- boi:expect-after select count(*) from public.reviews where source_retailer is null and verdict in ('WAIT', 'BUY NOW') and position('Standard disclaimer:' in content) = 0 = 0
-- Adds the standard closing line to published reviews that have no store recorded and lack it.
-- Targets are chosen by condition: no store, verdict WAIT or BUY NOW, no "Standard disclaimer:" in the text, and exactly one
-- "Verdict: X." line. The before-assert is 51 WAIT x 1000 + 6 BUY NOW = 51006; if the counts differ, nothing is applied.
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

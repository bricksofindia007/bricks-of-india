-- boi:issue 568
-- boi:backup-tables public.reviews
-- boi:expect-before select count(*) from public.reviews where (slug, md5(content)) in (values ('lego-arcade-machine-40805-worth-4549','abc22ba3b927446e48542caaab08a51e')) = 1
-- boi:expect-after  select count(*) from public.reviews where slug = 'lego-arcade-machine-40805-worth-4549' and content like '%has an EMI option.%' and content not like '%has an EMI option..%' = 1
-- Changes two full stops to one at the end of one sentence in 1 review.
DO $$ BEGIN RAISE EXCEPTION 'HOLD: do not run.'; END $$;
update public.reviews
set content = replace(content, 'has an EMI option..', 'has an EMI option.')
where (slug, md5(content)) in (values ('lego-arcade-machine-40805-worth-4549','abc22ba3b927446e48542caaab08a51e'))
  and (length(content) - length(replace(content, 'has an EMI option..', ''))) = length('has an EMI option..');

-- boi:issue 568
-- boi:backup-tables public.reviews
-- boi:expect-before select count(*) from public.reviews where (id::text, md5(content)) in (values ('0ba67c44-a59e-47a8-b219-12ef317813f0','1550ad8fb4ac5ab00a4edb337d6b66c9')) = 1
-- boi:expect-after  select count(*) from public.reviews where id::text = '0ba67c44-a59e-47a8-b219-12ef317813f0' and content like '%but at review, it was priced at ₹29,999 on LEGO.in.%' and content not like '%LEGO.in confirmed live stock for ₹29,999.%' = 1
-- Changes one sentence in 1 review: 'LEGO.in confirmed live stock for ₹29,999.' becomes 'at review, it was priced at ₹29,999 on LEGO.in.'.
DO $$ BEGIN RAISE EXCEPTION 'HOLD: do not run.'; END $$;
update public.reviews
set content = replace(content, 'LEGO.in confirmed live stock for ₹29,999.', 'at review, it was priced at ₹29,999 on LEGO.in.')
where (id::text, md5(content)) in (values ('0ba67c44-a59e-47a8-b219-12ef317813f0','1550ad8fb4ac5ab00a4edb337d6b66c9'))
  and (length(content) - length(replace(content, 'LEGO.in confirmed live stock for ₹29,999.', ''))) = length('LEGO.in confirmed live stock for ₹29,999.');

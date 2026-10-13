-- HOLD (b). Wording approved by chat (P21b final, 13 Oct 2026). Guard filled from md5-guards-2026-10-13.txt. RAISE below stays until the staging rehearsal passes.
-- Change only: "LEGO.in confirmed live stock for ₹29,999." -> "at review, it was priced at ₹29,999 on LEGO.in." in reviews.content.
-- Review id from chat: 0ba67c44-a59e-47a8-b219-12ef317813f0.
-- The sentence sits on the live page for lego-gustav-klimt-the-kiss-31221-worth-29999 (the id-to-slug link is not verified; check in the DB pull).
-- Result sentence: "The source lists this set as backordered, but at review, it was priced at ₹29,999 on LEGO.in."
-- Published review: G16 needs a dated correction note, chat to say whether this edit needs one.
-- boi:issue 568
-- boi:backup-tables public.reviews
-- boi:expect-before select count(*) from public.reviews where (id::text, md5(content)) in (values ('0ba67c44-a59e-47a8-b219-12ef317813f0','1550ad8fb4ac5ab00a4edb337d6b66c9')) = 1
-- boi:expect-after  select count(*) from public.reviews where id::text = '0ba67c44-a59e-47a8-b219-12ef317813f0' and content like '%but at review, it was priced at ₹29,999 on LEGO.in.%' and content not like '%LEGO.in confirmed live stock for ₹29,999.%' = 1

DO $$ BEGIN RAISE EXCEPTION 'HOLD (b): awaiting chat confirmation. Do not run.'; END $$;

update public.reviews
set content = replace(content, 'LEGO.in confirmed live stock for ₹29,999.', 'at review, it was priced at ₹29,999 on LEGO.in.')
where (id::text, md5(content)) in (values ('0ba67c44-a59e-47a8-b219-12ef317813f0','1550ad8fb4ac5ab00a4edb337d6b66c9'))
  and (length(content) - length(replace(content, 'LEGO.in confirmed live stock for ₹29,999.', ''))) = length('LEGO.in confirmed live stock for ₹29,999.');

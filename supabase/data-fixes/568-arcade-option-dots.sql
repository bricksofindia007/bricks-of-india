-- HOLD (c). Wording approved by chat (P21b final, 13 Oct 2026). Guard filled from md5-guards-2026-10-13.txt. RAISE below stays until the staging rehearsal passes. The 40805 variant decision is still open and is NOT part of this change.
-- Change only: "has an EMI option.." -> "has an EMI option." in the review's content.
-- Review: lego-arcade-machine-40805-worth-4549 (verdict WAIT). The id was not given; the expect guard uses the slug and md5.
-- The line is the legacy disclaimer on this page (see 568-buy-now-disclaimer.sql, the 40805 block). This change does not set the variant.
-- Published review: G16 needs a dated correction note, chat to say whether this edit needs one.
-- boi:issue 568
-- boi:backup-tables public.reviews
-- boi:expect-before select count(*) from public.reviews where (slug, md5(content)) in (values ('lego-arcade-machine-40805-worth-4549','abc22ba3b927446e48542caaab08a51e')) = 1
-- boi:expect-after  select count(*) from public.reviews where slug = 'lego-arcade-machine-40805-worth-4549' and content like '%has an EMI option.%' and content not like '%has an EMI option..%' = 1

DO $$ BEGIN RAISE EXCEPTION 'HOLD (c): awaiting chat confirmation. Do not run.'; END $$;

update public.reviews
set content = replace(content, 'has an EMI option..', 'has an EMI option.')
where (slug, md5(content)) in (values ('lego-arcade-machine-40805-worth-4549','abc22ba3b927446e48542caaab08a51e'))
  and (length(content) - length(replace(content, 'has an EMI option..', ''))) = length('has an EMI option..');

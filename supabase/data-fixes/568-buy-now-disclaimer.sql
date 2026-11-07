-- boi:issue 568
-- boi:backup-tables public.reviews
-- boi:expect-before select count(*) from public.reviews where (slug, md5(content)) in (values ('lego-77059-timmy-tommys-fun-day-out-worth-5400','10743f9cc75e8176c67564bfda77b77c'), ('lego-creative-build-and-play-box-11044-worth-5449','0ebeb342aab2d7eee5da14a202df416d'), ('lego-don-donkey-kong-arcade-72051-worth-25700','fcb5c2a8f5b5ce1eee415ed918b9ed6c'), ('lego-eiffel-tower-10307-worth-65999','6f5190d14b98dc09a576b15eac6a9a29'), ('lego-olivia-rodrigos-dual-guitar-43031-worth-15400','dcee96398fe7830f80057ed624d8a486'), ('lego-rontu-the-master-dragon-71842-worth-4999','0b87d9cf9b6989319fcad843fd897893')) = 6
-- boi:expect-after  select count(*) from public.reviews where slug in ('lego-77059-timmy-tommys-fun-day-out-worth-5400','lego-creative-build-and-play-box-11044-worth-5449','lego-don-donkey-kong-arcade-72051-worth-25700','lego-eiffel-tower-10307-worth-65999','lego-olivia-rodrigos-dual-guitar-43031-worth-15400','lego-rontu-the-master-dragon-71842-worth-4999') and verdict_disclaimer_variant = 'buy' and content like '%Standard disclaimer: if you''ve got the money, obviously buy it%' = 6
-- Adds the standard disclaimer line to 6 buy-verdict review pages with no retailer link, and sets their variant.
DO $$ BEGIN RAISE EXCEPTION 'HOLD: do not run.'; END $$;
update public.reviews
set content = regexp_replace(
      content,
      '(^|\n\n)(Verdict: BUY NOW\.)(\n\n|$)',
      E'\\1\\2\n\n' || $d$Standard disclaimer: if you've got the money, obviously buy it — that's what the verdict says too, for once we all agree.$d$ || E'\\3'
    ),
    verdict_disclaimer_variant = 'buy'
where (slug, md5(content)) in (values
  ('lego-77059-timmy-tommys-fun-day-out-worth-5400','10743f9cc75e8176c67564bfda77b77c'),
  ('lego-creative-build-and-play-box-11044-worth-5449','0ebeb342aab2d7eee5da14a202df416d'),
  ('lego-don-donkey-kong-arcade-72051-worth-25700','fcb5c2a8f5b5ce1eee415ed918b9ed6c'),
  ('lego-eiffel-tower-10307-worth-65999','6f5190d14b98dc09a576b15eac6a9a29'),
  ('lego-olivia-rodrigos-dual-guitar-43031-worth-15400','dcee96398fe7830f80057ed624d8a486'),
  ('lego-rontu-the-master-dragon-71842-worth-4999','0b87d9cf9b6989319fcad843fd897893')
);
-- update public.reviews set verdict_disclaimer_variant = 'wait_mybrickhouse'
--   where slug = 'lego-arcade-machine-40805-worth-4549' and verdict_disclaimer_variant is null and md5(content) = 'abc22ba3b927446e48542caaab08a51e';

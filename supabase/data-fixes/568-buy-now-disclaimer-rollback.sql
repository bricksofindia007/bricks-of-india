-- boi:issue 568
-- boi:expect-before select count(*) from public.reviews where (slug, md5(content)) in (values ('lego-77059-timmy-tommys-fun-day-out-worth-5400','MD5_AFTER_TBD_77059'), ('lego-creative-build-and-play-box-11044-worth-5449','MD5_AFTER_TBD_11044'), ('lego-don-donkey-kong-arcade-72051-worth-25700','MD5_AFTER_TBD_72051'), ('lego-eiffel-tower-10307-worth-65999','MD5_AFTER_TBD_10307'), ('lego-olivia-rodrigos-dual-guitar-43031-worth-15400','MD5_AFTER_TBD_43031'), ('lego-rontu-the-master-dragon-71842-worth-4999','MD5_AFTER_TBD_71842')) = 6
-- boi:expect-after  select count(*) from public.reviews r join boi_backups.reviews b on b.id = r.id where r.slug in ('lego-77059-timmy-tommys-fun-day-out-worth-5400','lego-creative-build-and-play-box-11044-worth-5449','lego-don-donkey-kong-arcade-72051-worth-25700','lego-eiffel-tower-10307-worth-65999','lego-olivia-rodrigos-dual-guitar-43031-worth-15400','lego-rontu-the-master-dragon-71842-worth-4999') and r.content = b.content and r.verdict_disclaimer_variant is not distinct from b.verdict_disclaimer_variant = 6
-- Restores the 6 buy-verdict review pages to their saved content and variant.
DO $$ BEGIN RAISE EXCEPTION 'HOLD: rollback not approved. Do not run.'; END $$;
update public.reviews r
set content = b.content,
    verdict_disclaimer_variant = b.verdict_disclaimer_variant
from boi_backups.reviews b
where b.id = r.id
  and (r.slug, md5(r.content)) in (values
    ('lego-77059-timmy-tommys-fun-day-out-worth-5400','MD5_AFTER_TBD_77059'),
    ('lego-creative-build-and-play-box-11044-worth-5449','MD5_AFTER_TBD_11044'),
    ('lego-don-donkey-kong-arcade-72051-worth-25700','MD5_AFTER_TBD_72051'),
    ('lego-eiffel-tower-10307-worth-65999','MD5_AFTER_TBD_10307'),
    ('lego-olivia-rodrigos-dual-guitar-43031-worth-15400','MD5_AFTER_TBD_43031'),
    ('lego-rontu-the-master-dragon-71842-worth-4999','MD5_AFTER_TBD_71842')
  );

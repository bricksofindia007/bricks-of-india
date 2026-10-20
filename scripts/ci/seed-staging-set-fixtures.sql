-- Staging only. Adds two fixture rows to public.sets, so the blank-theme data fixes (706 and 709) can run
-- their real assertions on staging, which does not hold these set numbers.
--
-- * Inserts a row only where set_number is absent. An existing row is never updated or deleted.
-- * If a row with the same set_number already exists and differs from the fixture in name, year, theme,
--   noindex_override or the marker, the whole run is refused (nothing written).
-- * Every fixture row carries the marker 'FIXTURE STAGING ONLY' in description, so it can be found and removed.
-- * Idempotent: a second run inserts nothing.
-- * Every other sets column keeps its table default. No price, store or image data is written.
begin;

do $$
declare
  f record;
  n integer;
  existing record;
begin
  for f in
    select * from (values
      ('854338', 'Lloyd''s Sword with Sheath', 2026),
      ('854335', 'Mateo''s Z-Blob Sword', 2026)
    ) as v(set_number, name, year)
  loop
    select count(*) into n from public.sets where set_number = f.set_number;
    if n > 1 then
      raise exception 'seed: % rows exist for set %; stopped, nothing written', n, f.set_number;
    end if;
    if n = 1 then
      select name, year, theme, noindex_override, description into existing
      from public.sets where set_number = f.set_number;
      if existing.name is distinct from f.name
         or existing.year is distinct from f.year
         or existing.theme is distinct from ''
         or existing.noindex_override is distinct from false
         or existing.description is distinct from 'FIXTURE STAGING ONLY' then
        raise exception 'seed: set % already exists with different data; stopped, nothing written', f.set_number;
      end if;
    end if;
  end loop;
end $$;

insert into public.sets (set_number, name, year, theme, noindex_override, description)
select v.set_number, v.name, v.year, '', false, 'FIXTURE STAGING ONLY'
from (values
  ('854338', 'Lloyd''s Sword with Sheath', 2026),
  ('854335', 'Mateo''s Z-Blob Sword', 2026)
) as v(set_number, name, year)
where not exists (select 1 from public.sets s where s.set_number = v.set_number);

commit;

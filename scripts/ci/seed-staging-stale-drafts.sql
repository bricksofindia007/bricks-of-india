-- Staging only. Puts exactly 191 fixture drafts on a database that has none, so the stale-backlog data fix
-- (supabase/data-fixes/625-stale-draft-reject.sql) can be rehearsed with its real assertions.
--
-- * Refuses to run if any real draft matches the fix's eligibility rule (no fixture row). It never reads,
--   copies or changes a row that is not a fixture row, and it never reads production.
-- * Removes only its own rows (source_url prefix below), then inserts 184 news and 7 review drafts. Running
--   it again leaves exactly 191 fixture rows, so it is idempotent.
-- * The counts follow the fix's guard: news 184 (within 3), reviews 7, both created before the cutoffs.
-- * Fixture rows use the reserved .invalid domain. No real title, body, link or person is used.
--
-- Run with psql against the staging database only, after the staging migrations are applied.
begin;

do $$
declare
  other integer;
begin
  select count(*) into other
  from public.pending_drafts
  where status = 'draft'
    and source_url not like 'https://fixture.invalid/stale-backlog/%'
    and ((draft_format = 'news' and created_at < '2026-10-04 03:54:00+00')
      or (draft_format = 'review' and created_at < '2026-09-18 03:54:00+00'));
  if other <> 0 then
    raise exception 'seed: % real eligible draft(s) exist on this database; stopped, nothing written', other;
  end if;
end $$;

delete from public.pending_drafts where source_url like 'https://fixture.invalid/stale-backlog/%';

insert into public.pending_drafts (source_url, source_title, draft_title, draft_body, draft_format, status, created_at, updated_at)
select 'https://fixture.invalid/stale-backlog/news/' || g,
       'Fixture news draft ' || g,
       'Fixture news draft ' || g,
       'Fixture body. Staging only.',
       'news', 'draft',
       '2026-09-10 00:00:00+00', '2026-09-10 00:00:00+00'
from generate_series(1, 184) as g;

insert into public.pending_drafts (source_url, source_title, draft_title, draft_body, draft_format, status, created_at, updated_at)
select 'https://fixture.invalid/stale-backlog/review/' || g,
       'Fixture review draft ' || g,
       'Fixture review draft ' || g,
       'Fixture body. Staging only.',
       'review', 'draft',
       '2026-09-10 00:00:00+00', '2026-09-10 00:00:00+00'
from generate_series(1, 7) as g;

-- Checks: the eligible count must be exactly 191 and no marker row may exist.
do $$
declare
  eligible integer;
  markers integer;
begin
  select count(*) into eligible
  from public.pending_drafts
  where status = 'draft'
    and ((draft_format = 'news' and created_at < '2026-10-04 03:54:00+00')
      or (draft_format = 'review' and created_at < '2026-09-18 03:54:00+00'));
  select count(*) into markers from public.pending_drafts where discard_reason = 'stale backlog';
  if eligible <> 191 or markers <> 0 then
    raise exception 'seed: expected 191 eligible and 0 markers, found % and %; rolled back', eligible, markers;
  end if;
  raise notice 'seed: % eligible drafts, % markers', eligible, markers;
end $$;

commit;

-- boi:issue 822
-- Owner-only daily visit totals per page group (order 0050; plan t2-0045-visitor-counter-plan.md).
-- One row per day per page class. No IP, user agent, cookie, session, referrer, path or slug is stored.
-- Row level security on; no grant to anon, authenticated or public; service role only (G8).
-- NOT APPLIED: staging rehearsal first; production only in the bundle window.
-- Rollback: supabase/rollbacks/20261027120000_visit_daily.down.sql

create table if not exists public.visit_daily (
  day        date    not null,
  page_class text    not null check (page_class in ('set', 'theme', 'review', 'news', 'guide', 'lab', 'other')),
  views      integer not null default 0 check (views >= 0),
  primary key (day, page_class)
);

alter table public.visit_daily enable row level security;

-- Explicit grants (G8): nothing for anon, authenticated or public.
revoke all on public.visit_daily from public, anon, authenticated;
grant select, insert, update, delete on public.visit_daily to service_role;

-- Self-check: the table is closed to browser roles and has RLS on. Fails the migration if not.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.visit_daily'::regclass) then
    raise exception 'visit_daily: row level security is not on';
  end if;
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'visit_daily'
      and upper(grantee) in ('ANON', 'AUTHENTICATED', 'PUBLIC')
  ) then
    raise exception 'visit_daily: anon, authenticated or public has a grant';
  end if;
end
$$;

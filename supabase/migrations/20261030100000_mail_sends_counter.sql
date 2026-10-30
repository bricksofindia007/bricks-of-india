-- boi:issue 186
-- Mail-send counter (issue 186): one row per mail attempt, written BEFORE the provider call, so a crash cannot go over the daily cap.
-- Holds route codes and a day only: no address, no name and no message text are stored.
-- Row level security is on. No policy is created for anon or authenticated: only the service role reads or writes (G8).
-- NOT APPLIED: staging rehearsal and owner review first (G7).
--
-- Rollback: supabase/rollbacks/20261030100000_mail_sends_counter.rollback.sql

create table if not exists public.mail_sends (
  send_id uuid primary key default gen_random_uuid(),
  day_key date not null,
  route_code text not null check (route_code in ('contact', 'newsletter', 'operator')),
  created_at timestamptz not null default now()
);

create index if not exists mail_sends_day_route on public.mail_sends (day_key, route_code);

alter table public.mail_sends enable row level security;

-- Explicit grants (G8): nothing for anon, authenticated or public.
revoke all on public.mail_sends from public, anon, authenticated;
grant select, insert, delete on public.mail_sends to service_role;

-- Self-check: no browser role or PUBLIC holds any privilege on the table. Fails the migration if one does.
do $$
declare extra text;
begin
  select string_agg(distinct grantee || ':' || privilege_type, ', ') into extra
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'mail_sends'
    and upper(grantee) in ('ANON', 'AUTHENTICATED', 'PUBLIC');
  if extra is not null then
    raise exception 'mail_sends: a browser role or PUBLIC holds a privilege: %', extra;
  end if;
end
$$;

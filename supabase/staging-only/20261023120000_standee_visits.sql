-- STAGING ONLY. Not applied. This folder is outside supabase/migrations and supabase/data-fixes, so the
-- production migration job never reads it. Apply to the staging database only, after the owner's approval.
-- Rollback: 20261023120000_standee_visits.down.sql

create table if not exists public.standee_visits (
  tag        text primary key check (tag in ('standee_qr')),
  visits     bigint not null default 0 check (visits >= 0),
  updated_at timestamptz not null default now()
);

alter table public.standee_visits enable row level security;
revoke all on public.standee_visits from anon, authenticated;

create or replace function public.record_standee_visit(p_tag text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tag is null or p_tag not in ('standee_qr') then
    raise exception 'unknown tag';
  end if;
  insert into public.standee_visits (tag, visits) values (p_tag, 1)
  on conflict (tag) do update set visits = public.standee_visits.visits + 1, updated_at = now();
end;
$$;

revoke all on function public.record_standee_visit(text) from public, anon, authenticated;
grant execute on function public.record_standee_visit(text) to service_role;

-- Account storage for collections and wishlists (pillar H, flag off). NOT APPLIED: staging rehearsal and review first (G7).
-- No email column yet: the sign-in identifier is an open question for Chat, so it is not decided here.
-- Row level security is on for every table. No policy is created for anon or authenticated: only the service role reads or writes.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  deleted_at timestamptz
);
alter table public.accounts enable row level security;

create table if not exists public.saved_sets (
  account_id uuid not null references public.accounts(id) on delete cascade,
  list text not null check (list in ('collection', 'wishlist')),
  set_number text not null check (set_number ~ '^[0-9]{3,7}(-[0-9]{1,2})?$'),
  qty integer not null default 1 check (qty between 1 and 999),
  added_at timestamptz not null default now(),
  primary key (account_id, list, set_number)
);
alter table public.saved_sets enable row level security;

create table if not exists public.saved_figures (
  account_id uuid not null references public.accounts(id) on delete cascade,
  list text not null check (list in ('collection', 'wishlist')),
  figure_id text not null check (char_length(figure_id) between 1 and 40),
  added_at timestamptz not null default now(),
  primary key (account_id, list, figure_id)
);
alter table public.saved_figures enable row level security;

-- At most 500 sets per list per account (agreed 18 Oct). The count is checked before each insert.
create or replace function public.saved_sets_limit() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.saved_sets where account_id = new.account_id and list = new.list) >= 500 then
    raise exception 'list is full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists saved_sets_limit on public.saved_sets;
create trigger saved_sets_limit before insert on public.saved_sets
for each row execute function public.saved_sets_limit();

-- Explicit grants (G8): nothing for anon, authenticated or public.
revoke all on public.accounts, public.saved_sets, public.saved_figures from public, anon, authenticated;
grant select, insert, update, delete on public.accounts, public.saved_sets, public.saved_figures to service_role;

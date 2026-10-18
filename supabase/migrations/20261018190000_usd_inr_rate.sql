-- boi:issue 679
-- One stored USD to INR rate, with its value date, its source and the time of the last attempt. One row only (id = 1).
-- Written by the daily rate job with the service role. Read by the server only, through the function below.
-- No browser role can read or write the table or the function.
create table if not exists public.usd_inr_rate (
  id              smallint primary key default 1 check (id = 1),
  rate            numeric(8,4) not null check (rate > 0),
  value_date      date not null,
  source          text not null,
  fetched_at      timestamptz not null,
  last_attempt_at timestamptz not null default now()
);

alter table public.usd_inr_rate enable row level security;

create policy usd_inr_rate_service_only on public.usd_inr_rate
  for all to service_role using (true) with check (true);

revoke all on public.usd_inr_rate from public, anon, authenticated;
grant select, insert, update on public.usd_inr_rate to service_role;

create or replace function public.get_usd_inr_rate()
returns table (rate numeric, value_date date, source text, fetched_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.rate, r.value_date, r.source, r.fetched_at
  from public.usd_inr_rate r
  where r.id = 1
$$;

-- Same grant as the existing price read functions: public revoked; anon, authenticated and service role may execute.
-- The function returns only the rate, its value date, its source and the fetch time. The table itself stays closed.
revoke all on function public.get_usd_inr_rate() from public;
grant execute on function public.get_usd_inr_rate() to anon, authenticated, service_role;

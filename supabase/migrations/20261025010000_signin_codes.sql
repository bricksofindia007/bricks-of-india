-- boi:issue 752
-- Sign-in by emailed code and account sessions (pillar H, flag off). NOT APPLIED: staging rehearsal and review first (G7).
-- Codes and sends are keyed by a keyed hash of the address, never the address itself. The address lives only in
-- public.accounts.email (owner decision, 24 Oct 2026). A session is stored as a hash of its token; the token is only in the cookie.
-- Row level security is on for every table. No policy is created for anon or authenticated: only the service role reads or writes.

create table if not exists public.sign_in_codes (
  id text primary key check (char_length(id) between 16 and 64),
  email_hash text not null check (char_length(email_hash) = 64),
  code_hash text not null check (char_length(code_hash) = 64),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  consumed_at timestamptz
);
create index if not exists sign_in_codes_email_issued on public.sign_in_codes (email_hash, issued_at desc);
alter table public.sign_in_codes enable row level security;

-- One row per mail the site intends to send. A row is released (released_at set) only after a clear refusal from the provider.
create table if not exists public.sign_in_sends (
  send_id text primary key check (char_length(send_id) between 16 and 64),
  day_key text not null check (day_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  reserved_at timestamptz not null default now(),
  released_at timestamptz
);
create index if not exists sign_in_sends_day_open on public.sign_in_sends (day_key) where released_at is null;
alter table public.sign_in_sends enable row level security;

create table if not exists public.account_sessions (
  token_hash text primary key check (char_length(token_hash) = 64),
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists account_sessions_account on public.account_sessions (account_id);
alter table public.account_sessions enable row level security;

-- Explicit grants (G8): nothing for anon, authenticated or public.
revoke all on public.sign_in_codes, public.sign_in_sends, public.account_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.sign_in_codes, public.sign_in_sends, public.account_sessions to service_role;

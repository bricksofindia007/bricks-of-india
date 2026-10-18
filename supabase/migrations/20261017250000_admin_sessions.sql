-- Admin sessions (B6a): one row per admin sign-in, so logout and revocation end a session on the server.
-- Only the server (full-access role) reads or writes this table. Anonymous and signed-in roles get nothing.
-- Rollback: supabase/rollbacks/20261017250000_admin_sessions.down.sql (dropping it ends every open admin session).
create table if not exists public.admin_sessions (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.admin_sessions enable row level security;

revoke all on public.admin_sessions from anon, authenticated;
grant select, insert, update on public.admin_sessions to service_role;

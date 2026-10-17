-- Throwaway rehearsal setup. Runs only inside the rehearsal job's service container.
-- Creates the roles and the minimal storage and auth objects the repo migrations expect.
-- Not Supabase's real definitions: only the names the migrations use.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'backup_reader') then create role backup_reader nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'ci_readonly') then create role ci_readonly nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'growth_dashboard') then create role growth_dashboard nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'growth_service') then create role growth_service nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'growth_subscriber_sync') then create role growth_subscriber_sync nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'growth_webhook') then create role growth_webhook nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'growth_brief') then create role growth_brief nologin; end if;
end $$;

create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key, name text, owner uuid, public boolean, file_size_limit bigint,
  allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create or replace function auth.uid() returns uuid language sql stable as 'select null::uuid';
create or replace function auth.role() returns text language sql stable as 'select ''anon''::text';

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, name text, statements text[]);

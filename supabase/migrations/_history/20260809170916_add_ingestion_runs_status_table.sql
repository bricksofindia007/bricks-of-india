-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260809170916, name add_ingestion_runs_status_table, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Phase 2: per-run, per-platform ingestion status record. Did not exist
-- before Phase 2 — Phase 0's schema had no run/job status table. This is
-- the sharpest lesson from Phase 0/1: a failed API call must never be
-- silently reported as success, so every ingestion attempt (nightly or
-- backfill) writes exactly one row here, win or lose.
create table growth.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('nightly', 'backfill')),
  platform text not null check (platform in ('youtube', 'instagram', 'reddit', 'website')),
  target_date date not null,         -- the metric_date this attempt targeted
  status text not null check (status in ('success', 'partial', 'failure')),
  rows_written integer not null default 0,
  error_message text,                -- the real error, never a swallowed/generic one
  started_at timestamptz not null,
  finished_at timestamptz not null default now()
);

create index ingestion_runs_platform_date_idx on growth.ingestion_runs (platform, target_date, finished_at desc);

grant select, insert, update on growth.ingestion_runs to growth_service;

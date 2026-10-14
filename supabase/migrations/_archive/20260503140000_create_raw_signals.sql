-- Migration 20260503140000 — raw_signals
-- Apply via: Supabase Dashboard → SQL Editor → paste and run.
-- Purpose: RADAR-01 ingestion staging table. Every fetched signal lands
-- here with dedup_status='pending'. RADAR-02 deduper then classifies rows.

create table public.raw_signals (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_tier int not null check (source_tier between 1 and 5),
  source_type text not null check (source_type in ('rss','api','scrape','reddit','youtube')),
  external_id text,
  url text not null,
  url_hash text not null,
  title text not null,
  title_hash text not null,
  body text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  raw_payload jsonb,
  dedup_status text not null default 'pending' check (dedup_status in ('pending','unique','duplicate','cross_source_primary','cross_source_secondary')),
  dedup_group_id uuid,
  created_at timestamptz not null default now()
);

create index raw_signals_url_hash_idx on public.raw_signals (url_hash);
create index raw_signals_title_hash_idx on public.raw_signals (title_hash);
create index raw_signals_dedup_status_idx on public.raw_signals (dedup_status);
create index raw_signals_fetched_at_idx on public.raw_signals (fetched_at desc);
create index raw_signals_dedup_group_idx on public.raw_signals (dedup_group_id) where dedup_group_id is not null;

alter table public.raw_signals enable row level security;

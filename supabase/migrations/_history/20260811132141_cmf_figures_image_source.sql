-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260811132141, name cmf_figures_image_source, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

alter table public.cmf_figures
  add column if not exists image_source text
    check (image_source in ('brickset', 'rebrickable'));

comment on column public.cmf_figures.image_source is
  'Which source populated image_url for this row -- brickset (preferred, higher-res) or rebrickable (fallback where Brickset has no image for this exact figure number). See scripts/sync-cmf-figure-images-brickset.mjs.';

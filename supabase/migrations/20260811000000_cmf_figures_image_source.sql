-- Minifig HQ rebuild (2026-08-11): cmf_figures.image_url has always come
-- from Rebrickable's set_img_url only (scripts/sync-cmf-figures.mjs) --
-- small thumbnails. Brickset is already this pipeline's preferred image
-- source elsewhere (scripts/populate-article-images.mjs,
-- images.brickset.com in next.config.mjs remotePatterns); checked
-- Brickset's coverage for individual CMF figure numbers directly
-- (HEAD requests against https://images.brickset.com/sets/images/{figure_number}.jpg
-- for a sample spanning Series 1 (2010) through Series 29 (2026)) before
-- writing this migration -- full 200 coverage on every figure tested.
--
-- image_source records which source actually populated image_url, so a
-- future re-run of the sync script only overwrites what it needs to and
-- this stays auditable rather than silent.
alter table public.cmf_figures
  add column if not exists image_source text
    check (image_source in ('brickset', 'rebrickable'));

comment on column public.cmf_figures.image_source is
  'Which source populated image_url for this row -- brickset (preferred, higher-res) or rebrickable (fallback where Brickset has no image for this exact figure number). See scripts/sync-cmf-figure-images-brickset.mjs.';

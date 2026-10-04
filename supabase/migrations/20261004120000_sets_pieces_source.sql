-- boi:issue 390
-- boi:backup-tables public.sets
-- P6 Step 3 / P5 Step 1b (28 Sep 2026; shipped round 11, 4 Oct 2026, from draft branch data/246-batch1 as 20260928110000): record where a catalogue piece count came from, so a correction
-- or a write-back of a missing (0) value always carries its source (Decision 1). Nullable; existing rows
-- keep NULL (= original import). Written only by approved data fixes and the Gate 14 write-back.
-- Rollback: ALTER TABLE public.sets DROP COLUMN pieces_source, DROP COLUMN pieces_source_checked_at;
ALTER TABLE public.sets ADD COLUMN IF NOT EXISTS pieces_source text;
ALTER TABLE public.sets ADD COLUMN IF NOT EXISTS pieces_source_checked_at timestamptz;
COMMENT ON COLUMN public.sets.pieces_source IS 'Where pieces came from when not the original import, e.g. "Brickset+Rebrickable agree (28 Sep 2026)"';

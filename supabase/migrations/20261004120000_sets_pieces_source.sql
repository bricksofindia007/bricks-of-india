-- boi:issue 390
-- boi:backup-tables public.sets
-- Adds two optional columns to sets recording how a piece count was confirmed and when.
-- Existing rows keep NULL.
-- Rollback: ALTER TABLE public.sets DROP COLUMN pieces_source, DROP COLUMN pieces_source_checked_at;
ALTER TABLE public.sets ADD COLUMN IF NOT EXISTS pieces_source text;
ALTER TABLE public.sets ADD COLUMN IF NOT EXISTS pieces_source_checked_at timestamptz;
COMMENT ON COLUMN public.sets.pieces_source IS 'How the piece count was confirmed';

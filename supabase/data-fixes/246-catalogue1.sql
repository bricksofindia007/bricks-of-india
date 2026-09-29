-- boi:issue 246
-- boi:backup-tables public.sets
-- boi:expect-before select count(*) from public.sets where (set_number = '71819' and pieces = 708) or (set_number = '40897' and coalesce(pieces, 0) = 0) = 2
-- boi:expect-after select count(*) from public.sets where (set_number = '71819' and pieces = 1212 and pieces_source is not null) or (set_number = '40897' and pieces = 174 and pieces_source is not null) = 2
-- Catalogue corrections from #246 batch 1 (Decision 1):
--   71819: catalogue 708 differs from Brickset 1,212 AND Rebrickable 1,212 (they agree) -> corrected, source recorded.
--          The name ("... Influencer Box") is NOT changed: it drives the set page URL, and G16 retires no URL.
--   40897: catalogue 0 (missing) -> Brickset 174 (Rebrickable has no count); write-back of a missing value only.
-- Needs migration 20260928110000_sets_pieces_source (applied earlier in the same job run).
UPDATE public.sets SET pieces = 1212, pieces_source = 'Brickset+Rebrickable agree: 1,212 (checked 28 Sep 2026; was 708)', pieces_source_checked_at = now(), updated_at = now()
 WHERE set_number = '71819' AND pieces = 708;
UPDATE public.sets SET pieces = 174, pieces_source = 'Brickset: 174 (Rebrickable has no count; checked 28 Sep 2026; was 0)', pieces_source_checked_at = now(), updated_at = now()
 WHERE set_number = '40897' AND coalesce(pieces, 0) = 0;

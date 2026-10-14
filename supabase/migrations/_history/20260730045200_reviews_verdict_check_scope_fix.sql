-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260730045200, name reviews_verdict_check_scope_fix, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Fix reviews_verdict_no_import_check: the original CHECK was unconditional,
-- blocking legacy RADAR-sourced reviews (source_retailer IS NULL) from ever
-- using IMPORT ONLY -- which is still a legitimate verdict for that source
-- (a set with no India retail presence). The restriction to BUY NOW/WAIT/
-- AVOID must only apply to reviews sourced from the retailer pipeline
-- (source_retailer IS NOT NULL), where IMPORT ONLY is structurally
-- impossible by construction (listing on MyBrickHouse/Toycra is the entry
-- condition), not to the whole table.
ALTER TABLE reviews DROP CONSTRAINT reviews_verdict_no_import_check;

ALTER TABLE reviews
  ADD CONSTRAINT reviews_verdict_no_import_check
  CHECK (source_retailer IS NULL OR verdict IN ('BUY NOW', 'WAIT', 'AVOID'))
  NOT VALID;

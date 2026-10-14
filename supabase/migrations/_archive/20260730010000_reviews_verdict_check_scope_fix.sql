-- Fix reviews_verdict_no_import_check (shipped unconditional in
-- 20260730000000_reviews_source_pipeline.sql, same day). Caught before any
-- legacy RADAR-sourced review actually needed to write IMPORT ONLY, but the
-- bug was real: as originally written, the CHECK applied to every row in
-- `reviews`, not just ones sourced from the MyBrickHouse/Toycra retailer
-- pipeline — which would have silently rejected every future INSERT/UPDATE
-- of a legacy RADAR-sourced review (source_retailer IS NULL) carrying
-- verdict = 'IMPORT ONLY', even though that verdict is still legitimate for
-- that source (a set genuinely absent from India retail). The restriction
-- must only bind reviews sourced from this pipeline, where IMPORT ONLY is
-- structurally impossible by construction (listing on MyBrickHouse/Toycra
-- is the entry condition to even enter the pipeline).

ALTER TABLE reviews DROP CONSTRAINT reviews_verdict_no_import_check;

ALTER TABLE reviews
  ADD CONSTRAINT reviews_verdict_no_import_check
  CHECK (source_retailer IS NULL OR verdict IN ('BUY NOW', 'WAIT', 'AVOID'))
  NOT VALID;

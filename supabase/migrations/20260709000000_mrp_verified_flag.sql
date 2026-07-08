-- MRP verification flag (2026-07-09).
-- Root cause: sets.lego_mrp_inr was populated by populate-mrp.js as Brickset
-- US retail price x USD/INR forex rate, rounded to 100 -- a currency-
-- converted US estimate, not the actual India MRP. Confirmed systemically
-- wrong via direct-scrape audit against Toycra's own labeled "MRP" field
-- (476 of 646 cross-checkable sets disagreed). Only sets with a live,
-- retailer-labeled MRP confirmation are mrp_verified = true; every other
-- populated lego_mrp_inr is suspect by default until independently checked.
--
-- mrp_review_reason distinguishes WHY a row is unverified:
--   'unverified_estimate'  -- Brickset-forex estimate, no retailer confirmation yet
--   'cmf_box_ambiguity'    -- Collectible Minifigures: sets.lego_mrp_inr may reflect
--                             a sealed-box-of-N price for what is structurally a
--                             single-figure entry (or vice versa) -- see
--                             cmf_figures table. Needs a human check per series,
--                             not a blind price overwrite.

ALTER TABLE sets ADD COLUMN IF NOT EXISTS mrp_verified boolean NOT NULL DEFAULT false;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS mrp_review_reason text;

CREATE INDEX IF NOT EXISTS idx_sets_mrp_verified ON sets(mrp_verified);

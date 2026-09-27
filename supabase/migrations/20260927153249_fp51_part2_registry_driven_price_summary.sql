-- FP5.1 part 2 (#280): set_price_summary reads the retailer registry.
--
-- (a) stores.anchor_policy: HOW a store's listing anchors MRP. Today's two
--     stores anchor differently, so rank alone cannot reproduce the view:
--       mybrickhouse  compare_at_or_listed            (compare-at if above the listed price, else listed)
--       toycra        compare_at_capped_by_catalogue  (same, but a compare-at above a VERIFIED catalogue
--                                                       MRP is capped to that catalogue MRP; source 'catalogue')
--     Tier 2 only, exactly like mrp_anchor_rank: stores_guard_anchor_rank now
--     also rejects any anchor_policy change unless boi.tier2_change='on'.
-- (b) set_price_summary: `cur` keeps only display_enabled stores, and the
--     hardcoded mbh/toy CTEs are replaced by "the lowest mrp_anchor_rank with
--     a fresh row, anchored by that store's anchor_policy". Everything else
--     (live, best_stores, discount, deal tiers R2-R6) is unchanged. The swap
--     happens in the same transaction as a row-for-row EXCEPT diff against
--     the pre-swap output, and RAISEs (rolling everything back) unless the
--     diff is 0 both ways. Pre-check (P3 Step 6, #280): 1,047 rows, 0/0.
-- (d) drop store_prices_store_id_check (hardcoded toycra/mybrickhouse/jaiman):
--     the stores FK (part 1) supersedes it, and new retailers are added as
--     registry rows, not by editing a CHECK.
-- Also: mybrickhouse.site_url -> https://lego.mybrickhouse.com (its LEGO
-- storefront, per CLAUDE.md; the only display use is /lab/which-set, which
-- already linked there).
--
-- The view stays security_invoker: anon reads stores via "Public read enabled
-- stores" (enabled rows only -- the same filter the view applies).
--
-- Rollback: restore the previous definition (boi-db-backups\2026-09-27-fp5.1\
-- set_price_summary_before.sql, CREATE OR REPLACE VIEW), then
--   ALTER TABLE public.stores DROP COLUMN anchor_policy;
--   ALTER TABLE public.store_prices ADD CONSTRAINT store_prices_store_id_check
--     CHECK (store_id = ANY (ARRAY['toycra','mybrickhouse','jaiman']));
--   (and the part-1 version of stores_guard_anchor_rank / its trigger column list)

-- (a) anchor_policy + guard
ALTER TABLE public.stores ADD COLUMN anchor_policy text NULL
  CHECK (anchor_policy IN ('compare_at_or_listed', 'compare_at_capped_by_catalogue'));
ALTER TABLE public.stores ADD CONSTRAINT stores_anchor_rank_needs_policy
  CHECK (mrp_anchor_rank IS NULL OR anchor_policy IS NOT NULL) NOT VALID;
COMMENT ON COLUMN public.stores.anchor_policy IS
  'TIER 2 ONLY. How this store''s listing becomes the MRP anchor in set_price_summary. Changing it changes deals, badges and '
  'discounts site-wide; the stores_guard_anchor_rank trigger rejects any change unless SET LOCAL boi.tier2_change = ''on''.';

CREATE OR REPLACE FUNCTION public.stores_guard_anchor_rank()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND (NEW.mrp_anchor_rank IS DISTINCT FROM OLD.mrp_anchor_rank
                            OR NEW.anchor_policy IS DISTINCT FROM OLD.anchor_policy))
     OR (TG_OP = 'INSERT' AND (NEW.mrp_anchor_rank IS NOT NULL OR NEW.anchor_policy IS NOT NULL)) THEN
    IF coalesce(current_setting('boi.tier2_change', true), '') <> 'on' THEN
      RAISE EXCEPTION 'stores.mrp_anchor_rank / anchor_policy are Tier 2 only (they move every MRP anchor, deal and badge). Set boi.tier2_change=on inside an approved Tier 2 migration.';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER stores_guard_anchor_rank ON public.stores;
CREATE TRIGGER stores_guard_anchor_rank
  BEFORE INSERT OR UPDATE OF mrp_anchor_rank, anchor_policy ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.stores_guard_anchor_rank();

SET LOCAL boi.tier2_change = 'on';
UPDATE public.stores SET anchor_policy = 'compare_at_or_listed'           WHERE id = 'mybrickhouse';
UPDATE public.stores SET anchor_policy = 'compare_at_capped_by_catalogue' WHERE id = 'toycra';
RESET boi.tier2_change;
ALTER TABLE public.stores VALIDATE CONSTRAINT stores_anchor_rank_needs_policy;

UPDATE public.stores SET site_url = 'https://lego.mybrickhouse.com' WHERE id = 'mybrickhouse';

-- (b) registry-driven set_price_summary, with the zero-drift gate
CREATE TEMP TABLE _sps_before ON COMMIT DROP AS SELECT * FROM public.set_price_summary;

CREATE OR REPLACE VIEW public.set_price_summary WITH (security_invoker = true) AS
WITH cur AS (
  SELECT sp.set_id, sp.store_id, sp.price_inr, sp.compare_at_price_inr, sp.in_stock, sp.scraped_at
  FROM public.store_prices sp
  JOIN public.stores st ON st.id = sp.store_id AND st.display_enabled
  WHERE sp.price_inr IS NOT NULL AND sp.scraped_at > (now() - '12:00:00'::interval)
), anchor_row AS (
  SELECT DISTINCT ON (c.set_id) c.set_id, c.store_id, c.price_inr, c.compare_at_price_inr AS ca, st.anchor_policy
  FROM cur c
  JOIN public.stores st ON st.id = c.store_id AND st.mrp_anchor_rank IS NOT NULL
  ORDER BY c.set_id, st.mrp_anchor_rank
), live AS (
  SELECT cur.set_id, min(cur.price_inr) AS best_price_inr, count(DISTINCT cur.store_id) AS in_stock_store_count
  FROM cur WHERE cur.in_stock GROUP BY cur.set_id
), best_stores AS (
  SELECT c.set_id, array_agg(c.store_id ORDER BY c.store_id) AS best_store_ids, max(c.scraped_at) AS best_scraped_at
  FROM cur c JOIN live l_1 ON l_1.set_id = c.set_id AND c.in_stock AND c.price_inr = l_1.best_price_inr
  GROUP BY c.set_id
), anchored AS (
  SELECT s.set_number AS set_id,
    CASE
      WHEN a.set_id IS NOT NULL THEN
        CASE
          WHEN a.anchor_policy = 'compare_at_capped_by_catalogue' AND a.ca::numeric > a.price_inr
               AND s.mrp_verified AND s.lego_mrp_inr IS NOT NULL AND a.ca > s.lego_mrp_inr THEN s.lego_mrp_inr::numeric
          WHEN a.ca::numeric > a.price_inr THEN a.ca::numeric
          ELSE a.price_inr
        END
      WHEN s.mrp_verified AND s.lego_mrp_inr IS NOT NULL THEN s.lego_mrp_inr::numeric
      ELSE NULL::numeric
    END AS anchor_mrp_inr,
    CASE
      WHEN a.set_id IS NOT NULL THEN
        CASE
          WHEN a.anchor_policy = 'compare_at_capped_by_catalogue' AND a.ca::numeric > a.price_inr
               AND s.mrp_verified AND s.lego_mrp_inr IS NOT NULL AND a.ca > s.lego_mrp_inr THEN 'catalogue'::text
          ELSE a.store_id
        END
      WHEN s.mrp_verified AND s.lego_mrp_inr IS NOT NULL THEN 'catalogue'::text
      ELSE NULL::text
    END AS anchor_source
  FROM public.sets s
  LEFT JOIN anchor_row a ON a.set_id = s.set_number
)
SELECT a.set_id,
  a.anchor_mrp_inr,
  a.anchor_source,
  l.best_price_inr,
  b.best_store_ids,
  b.best_scraped_at,
  COALESCE(l.in_stock_store_count, 0::bigint)::integer AS in_stock_store_count,
  CASE
    WHEN a.anchor_mrp_inr > 0::numeric AND l.best_price_inr IS NOT NULL THEN round((1::numeric - l.best_price_inr / a.anchor_mrp_inr) * 100::numeric, 1)
    ELSE NULL::numeric
  END AS discount_pct,
  CASE
    WHEN a.anchor_mrp_inr > 0::numeric AND l.best_price_inr <= (a.anchor_mrp_inr * 0.80) THEN 'hot'::text
    WHEN a.anchor_mrp_inr > 0::numeric AND l.best_price_inr <= (a.anchor_mrp_inr * 0.90) THEN 'deal'::text
    ELSE NULL::text
  END AS deal_tier
FROM anchored a
LEFT JOIN live l ON l.set_id = a.set_id
LEFT JOIN best_stores b ON b.set_id = a.set_id
WHERE a.anchor_mrp_inr IS NOT NULL OR l.best_price_inr IS NOT NULL;

DO $$
DECLARE only_before bigint; only_after bigint; n_before bigint; n_after bigint;
BEGIN
  SELECT count(*) INTO n_before FROM _sps_before;
  SELECT count(*) INTO n_after  FROM public.set_price_summary;
  SELECT count(*) INTO only_before FROM (SELECT * FROM _sps_before EXCEPT SELECT * FROM public.set_price_summary) x;
  SELECT count(*) INTO only_after  FROM (SELECT * FROM public.set_price_summary EXCEPT SELECT * FROM _sps_before) x;
  IF only_before <> 0 OR only_after <> 0 OR n_before <> n_after THEN
    RAISE EXCEPTION 'set_price_summary drift: before % rows, after % rows, only-before %, only-after % -- rolling back', n_before, n_after, only_before, only_after;
  END IF;
  RAISE NOTICE 'set_price_summary swap: % rows before, % after, 0 drift', n_before, n_after;
END $$;

-- (d) the old hardcoded store list
ALTER TABLE public.store_prices DROP CONSTRAINT store_prices_store_id_check;

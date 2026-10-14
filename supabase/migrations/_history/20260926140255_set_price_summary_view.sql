-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260926140255, name set_price_summary_view, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

CREATE OR REPLACE VIEW public.set_price_summary
WITH (security_invoker = true) AS
WITH cur AS (
  SELECT set_id, store_id, price_inr, compare_at_price_inr, in_stock, scraped_at
  FROM public.store_prices
  WHERE price_inr IS NOT NULL
    AND scraped_at > now() - interval '12 hours'
),
mbh AS (
  SELECT set_id,
         CASE WHEN compare_at_price_inr > price_inr THEN compare_at_price_inr ELSE price_inr END AS mrp
  FROM cur WHERE store_id = 'mybrickhouse'
),
toy AS (
  SELECT set_id, price_inr, compare_at_price_inr AS ca
  FROM cur WHERE store_id = 'toycra'
),
live AS (
  SELECT set_id,
         min(price_inr)                                    AS best_price_inr,
         count(DISTINCT store_id)                          AS in_stock_store_count
  FROM cur WHERE in_stock
  GROUP BY set_id
),
best_stores AS (
  SELECT c.set_id,
         array_agg(c.store_id ORDER BY c.store_id)         AS best_store_ids,
         max(c.scraped_at)                                 AS best_scraped_at
  FROM cur c JOIN live l ON l.set_id = c.set_id AND c.in_stock AND c.price_inr = l.best_price_inr
  GROUP BY c.set_id
),
anchored AS (
  SELECT s.set_number AS set_id,
         CASE
           WHEN m.set_id IS NOT NULL THEN m.mrp
           WHEN t.set_id IS NOT NULL THEN
             CASE
               WHEN t.ca > t.price_inr AND s.mrp_verified AND s.lego_mrp_inr IS NOT NULL AND t.ca > s.lego_mrp_inr
                 THEN s.lego_mrp_inr
               WHEN t.ca > t.price_inr THEN t.ca
               ELSE t.price_inr
             END
           WHEN s.mrp_verified AND s.lego_mrp_inr IS NOT NULL THEN s.lego_mrp_inr
         END AS anchor_mrp_inr,
         CASE
           WHEN m.set_id IS NOT NULL THEN 'mybrickhouse'
           WHEN t.set_id IS NOT NULL THEN
             CASE WHEN t.ca > t.price_inr AND s.mrp_verified AND s.lego_mrp_inr IS NOT NULL AND t.ca > s.lego_mrp_inr
                  THEN 'catalogue' ELSE 'toycra' END
           WHEN s.mrp_verified AND s.lego_mrp_inr IS NOT NULL THEN 'catalogue'
         END AS anchor_source
  FROM public.sets s
  LEFT JOIN mbh m ON m.set_id = s.set_number
  LEFT JOIN toy t ON t.set_id = s.set_number
)
SELECT a.set_id,
       a.anchor_mrp_inr,
       a.anchor_source,
       l.best_price_inr,
       b.best_store_ids,
       b.best_scraped_at,
       coalesce(l.in_stock_store_count, 0)::int           AS in_stock_store_count,
       CASE WHEN a.anchor_mrp_inr > 0 AND l.best_price_inr IS NOT NULL
            THEN round((1 - l.best_price_inr::numeric / a.anchor_mrp_inr) * 100, 1) END AS discount_pct,
       CASE
         WHEN a.anchor_mrp_inr > 0 AND l.best_price_inr <= a.anchor_mrp_inr * 0.80 THEN 'hot'
         WHEN a.anchor_mrp_inr > 0 AND l.best_price_inr <= a.anchor_mrp_inr * 0.90 THEN 'deal'
       END AS deal_tier
FROM anchored a
LEFT JOIN live l        ON l.set_id = a.set_id
LEFT JOIN best_stores b ON b.set_id = a.set_id
WHERE a.anchor_mrp_inr IS NOT NULL OR l.best_price_inr IS NOT NULL;

COMMENT ON VIEW public.set_price_summary IS
  'Locked pricing rules R2 (MRP anchor, ruling C + Toycra safeguard) and R3 (deal tiers) per set. Read by /deals, /, /sets/[slug], /lab/deals. See migration 20260926020000.';

REVOKE ALL ON public.set_price_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.set_price_summary TO service_role;

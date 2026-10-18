-- Widen the freshness window of public.set_price_summary to 30 hours. The 26-hour health check and watchdog still alarm first, with about 4 hours in hand.
-- Same view as 20260927153249, with only the window changed.
-- G7: rehearse on staging and take a backup first. Rollback: supabase/rollbacks/20261017260000_price_summary_window_30h.down.sql (restores the 12-hour window).

CREATE OR REPLACE VIEW public.set_price_summary WITH (security_invoker = true) AS
WITH cur AS (
  SELECT sp.set_id, sp.store_id, sp.price_inr, sp.compare_at_price_inr, sp.in_stock, sp.scraped_at
  FROM public.store_prices sp
  JOIN public.stores st ON st.id = sp.store_id AND st.display_enabled
  WHERE sp.price_inr IS NOT NULL AND sp.scraped_at > (now() - '30:00:00'::interval)
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


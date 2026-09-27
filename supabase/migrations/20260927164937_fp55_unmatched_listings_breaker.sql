-- FP5.5 + FP5.3 support (P4 Step 4d, #284 / #282): additive only.
--
-- 1. public.unmatched_listings -- the queue for retailer listings the FP5.4
--    identity ladder refuses to guess (G6): reason codes include
--    condition:box_damage (D28), sku_handle_conflict, sku_name_mismatch,
--    multi_set_listing, cmf_box, no_catalogue_match. One row per
--    (store, product_key); a re-seen listing bumps last_seen_at/times_seen.
--    A human resolves it (resolved_set_number) or ignores it. Nothing writes
--    here until the contract scraper goes live (FP5.8); the dry run only reads.
-- 2. public.unmatched_listings_weekly -- the weekly review list for the ops
--    digest: open rows seen in the last 7 days, grouped by store/reason.
-- 3. public.stores_record_breaker_trip(store, reason) -- FP5.3's atomic trip
--    record: increments breaker_trips and, on the 2nd CONSECUTIVE trip, sets
--    display_enabled=false + disabled_reason in the SAME statement.
-- 4. Seeds stores.scraper_config robots_sha256 / agents_sha256 with the hashes
--    the FP5.2 policy check recorded on 27 Sep 2026 ~16:45 UTC (dry run), so a
--    later change to either file aborts the run (write nothing, alert).
--
-- RLS on, service_role only (no anon/authenticated access; G8). Backup: none
-- needed (new objects + a jsonb merge on 2 rows; before-values in
-- boi-db-backups\2026-09-27-fp5.1\stores_before_part2.json + this header).
-- Applied with psql in one transaction with assertions, then recorded in
-- schema_migrations (same G7 exception as FP3.0/FP5.7/FP3.1/FP5.1, #197).
--
-- Rollback:
--   DROP VIEW IF EXISTS public.unmatched_listings_weekly;
--   DROP TABLE IF EXISTS public.unmatched_listings;
--   DROP FUNCTION IF EXISTS public.stores_record_breaker_trip(text, text);
--   UPDATE public.stores SET scraper_config = scraper_config - 'robots_sha256' - 'agents_sha256';

CREATE TABLE public.unmatched_listings (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id            text NOT NULL REFERENCES public.stores(id),
  product_key         text NOT NULL,                 -- handle / product id / URL path
  title               text NOT NULL,
  skus                text[] NOT NULL DEFAULT '{}',
  url                 text NULL,
  price_inr           numeric(12,2) NULL,            -- exact, paise kept (D27)
  in_stock            boolean NULL,
  reason              text NOT NULL CHECK (reason IN ('condition:box_damage','sku_handle_conflict','sku_name_mismatch',
                                                      'multi_set_listing','cmf_box','no_catalogue_match','ambiguous_numbers','invalid_parse')),
  detail              text NULL,
  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  times_seen          integer NOT NULL DEFAULT 1,
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','ignored')),
  resolved_set_number text NULL REFERENCES public.sets(set_number),
  resolved_by         text NULL,
  resolved_at         timestamptz NULL,
  UNIQUE (store_id, product_key),
  CHECK (status <> 'resolved' OR resolved_set_number IS NOT NULL)
);
CREATE INDEX unmatched_listings_open_idx ON public.unmatched_listings (status, last_seen_at DESC);
ALTER TABLE public.unmatched_listings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.unmatched_listings FROM anon, authenticated;
GRANT ALL ON TABLE public.unmatched_listings TO service_role;

CREATE VIEW public.unmatched_listings_weekly WITH (security_invoker = true) AS
SELECT store_id, reason, count(*) AS listings, max(last_seen_at) AS last_seen,
       (array_agg(title ORDER BY last_seen_at DESC))[1:10] AS example_titles
FROM public.unmatched_listings
WHERE status = 'open' AND last_seen_at > now() - interval '7 days'
GROUP BY store_id, reason
ORDER BY listings DESC;
REVOKE ALL ON TABLE public.unmatched_listings_weekly FROM anon, authenticated;
GRANT SELECT ON TABLE public.unmatched_listings_weekly TO service_role;

CREATE FUNCTION public.stores_record_breaker_trip(p_store text, p_reason text)
RETURNS TABLE (breaker_trips smallint, display_enabled boolean)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  UPDATE public.stores s
     SET breaker_trips        = s.breaker_trips + 1,
         last_breaker_trip_at = now(),
         display_enabled      = CASE WHEN s.breaker_trips + 1 >= 2 THEN false ELSE s.display_enabled END,
         disabled_reason      = CASE WHEN s.breaker_trips + 1 >= 2 THEN 'circuit breaker: ' || p_reason ELSE s.disabled_reason END
   WHERE s.id = p_store
  RETURNING s.breaker_trips, s.display_enabled;
$$;
REVOKE ALL ON FUNCTION public.stores_record_breaker_trip(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stores_record_breaker_trip(text, text) TO service_role;

UPDATE public.stores SET scraper_config = scraper_config || jsonb_build_object(
  'robots_sha256', 'a27f6b8a535c9d00c8298de7ec53ed7045c152004dd80b91b7b47eb8a0948f56',
  'agents_sha256', 'ecdf25c613d3ae18e7cde4626e924cc28f306a517dd337736b8091bd02a3c6d8',
  'policy_baselined_at', '2026-09-27')
WHERE id = 'mybrickhouse';
UPDATE public.stores SET scraper_config = scraper_config || jsonb_build_object(
  'robots_sha256', '920581eb40e1e4671e7410d17a144415817bc695b30fa12b04a56eb164e8aec4',
  'agents_sha256', 'ea70ad00292e27f890db9d37956c6f606e5edd2187d34362e8dbbdb6e50a99b6',
  'policy_baselined_at', '2026-09-27')
WHERE id = 'toycra';

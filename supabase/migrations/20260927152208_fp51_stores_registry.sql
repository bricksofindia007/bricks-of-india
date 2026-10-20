-- FP5.1 part 1 (#280): retailer registry -- schema + backfill ONLY; plus drop
-- the dead legacy `prices` table. Design: docs/plans/FP5.1_retailer_registry_design.md.
--
-- Scope (P3 Step 5, Abhinav): add `stores`, seed it from the store_id text
-- values in use, tie store_prices/price_history to it with foreign keys. NOTHING
-- reads `stores` yet: set_price_summary and the ~12 store-specific code paths
-- are unchanged (part 2, after a row-for-row comparison and sign-off), so the
-- site and scrapers behave exactly as before.
--
-- Circuit-breaker state lives HERE (breaker_trips, last_breaker_trip_at,
-- disabled_reason): the breaker's only action is flipping display_enabled on the
-- same retailer's row, so trip count and switch in one row make "2nd trip ->
-- display off" a single atomic UPDATE. Per-run history (what tripped, when)
-- belongs to FP5.6's run/match-audit log, not this table.
--
-- Seeded: the two retailers that exist today. Hamleys / FirstCry / Jaiman get
-- rows at onboarding with display_enabled=false and mrp_anchor_rank NULL, and
-- are enabled only by G-RET(n).
--
-- Legacy `prices`: 5,964 rows (Toycra, FirstCry, MyBrickHouse, Hamleys India x
-- 1,491), price_inr NULL on every row, last write 2026-05-10; no inbound FKs,
-- views, functions or triggers; one reader (technical-hygiene 13g existence
-- check, removed in the same PR). Backup: boi-db-backups\2026-09-27-fp5.1\
-- prices_full.dump + prices_full.sql.gz (plain COPY count 5,964 verified).
--
-- Applied with psql in one transaction with assertions, then recorded in
-- schema_migrations (same G7 exception as FP3.0/FP5.7/FP3.1, #197).
--
-- Rollback:
--   ALTER TABLE public.price_history DROP CONSTRAINT IF EXISTS price_history_store_id_fkey;
--   ALTER TABLE public.store_prices  DROP CONSTRAINT IF EXISTS store_prices_store_id_fkey;
--   DROP TABLE IF EXISTS public.stores;          -- drops its triggers too
--   DROP FUNCTION IF EXISTS public.stores_guard_anchor_rank();
--   -- prices: pg_restore --dbname=... boi-db-backups\2026-09-27-fp5.1\prices_full.dump

CREATE TABLE public.stores (
  id                   text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]+$'),
  name                 text NOT NULL,
  site_url             text NOT NULL CHECK (site_url ~ '^https://'),
  display_enabled      boolean NOT NULL DEFAULT false,
  display_order        smallint NOT NULL DEFAULT 100,
  affiliate_note       text NULL,
  mrp_anchor_rank      smallint NULL CHECK (mrp_anchor_rank IS NULL OR mrp_anchor_rank >= 1),
  price_precision      smallint NOT NULL DEFAULT 0 CHECK (price_precision BETWEEN 0 AND 2),
  scraper_kind         text NOT NULL CHECK (scraper_kind IN ('shopify_json','fynd_html','firstcry_html','manual')),
  scraper_config       jsonb NOT NULL DEFAULT '{}'::jsonb,
  robots_checked_at    timestamptz NULL,
  breaker_trips        smallint NOT NULL DEFAULT 0 CHECK (breaker_trips >= 0),
  last_breaker_trip_at timestamptz NULL,
  disabled_reason      text NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- One store per anchor rank.
CREATE UNIQUE INDEX stores_mrp_anchor_rank_key ON public.stores (mrp_anchor_rank) WHERE mrp_anchor_rank IS NOT NULL;

COMMENT ON TABLE  public.stores IS 'FP5.1 retailer registry (G4: retailers are data). display_enabled is the one switch every consumer filters on.';
COMMENT ON COLUMN public.stores.mrp_anchor_rank IS
  'TIER 2 ONLY. Which store''s listed/compare-at price anchors MRP in set_price_summary (1 = first choice; NULL = never an anchor). '
  'Changing it changes every deal, badge and discount on the site. Never a routine update: the stores_guard_anchor_rank trigger '
  'rejects any change unless the session runs SET LOCAL boi.tier2_change = ''on'' inside an approved Tier 2 migration.';
COMMENT ON COLUMN public.stores.breaker_trips IS 'FP5.3 consecutive circuit-breaker trips; the 2nd sets display_enabled=false + disabled_reason (runbook).';
COMMENT ON COLUMN public.stores.price_precision IS 'D27: decimal places displayed (FirstCry 2 for paise; others 0).';

-- Tier-2 guard on mrp_anchor_rank (the "check" asked for in P3 Step 5).
CREATE FUNCTION public.stores_guard_anchor_rank()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.mrp_anchor_rank IS DISTINCT FROM OLD.mrp_anchor_rank)
     OR (TG_OP = 'INSERT' AND NEW.mrp_anchor_rank IS NOT NULL) THEN
    IF coalesce(current_setting('boi.tier2_change', true), '') <> 'on' THEN
      RAISE EXCEPTION 'stores.mrp_anchor_rank is Tier 2 only (it moves every MRP anchor, deal and badge). Set boi.tier2_change=on inside an approved Tier 2 migration.';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.stores_guard_anchor_rank() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER stores_guard_anchor_rank
  BEFORE INSERT OR UPDATE OF mrp_anchor_rank ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.stores_guard_anchor_rank();

CREATE TRIGGER stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS + explicit grants (G8, lint-migration-grants): anon reads enabled stores only.
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read enabled stores" ON public.stores FOR SELECT TO anon USING (display_enabled);
GRANT SELECT ON TABLE public.stores TO anon;
GRANT ALL    ON TABLE public.stores TO service_role;

-- Seed = backfill from the store_id text values in use (store_prices: mybrickhouse 1,034, toycra 850;
-- price_history: mybrickhouse 101,123, toycra 74,381 on 27 Sep). Ranks set under the Tier 2 flag.
SET LOCAL boi.tier2_change = 'on';
INSERT INTO public.stores (id, name, site_url, display_enabled, display_order, affiliate_note, mrp_anchor_rank, price_precision, scraper_kind, scraper_config) VALUES
  ('mybrickhouse', 'MyBrickHouse', 'https://mybrickhouse.com', true, 10, NULL, 1, 0, 'shopify_json',
     '{"domain": "lego.mybrickhouse.com", "path": "/products.json"}'::jsonb),
  ('toycra',       'Toycra',       'https://www.toycra.com',  true, 20,
     'ABHINAV12 gives 12% off at Toycra; we earn a commission.', 2, 0, 'shopify_json',
     '{"domain": "www.toycra.com", "path": "/collections/lego/products.json"}'::jsonb);
RESET boi.tier2_change;

-- Every store_id in use must now be a registered store.
ALTER TABLE public.store_prices  ADD CONSTRAINT store_prices_store_id_fkey  FOREIGN KEY (store_id) REFERENCES public.stores(id) NOT VALID;
ALTER TABLE public.price_history ADD CONSTRAINT price_history_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) NOT VALID;
ALTER TABLE public.store_prices  VALIDATE CONSTRAINT store_prices_store_id_fkey;
ALTER TABLE public.price_history VALIDATE CONSTRAINT price_history_store_id_fkey;

-- Legacy `prices`: dead since 2026-05-10, every price NULL (see header).
DROP TABLE public.prices;

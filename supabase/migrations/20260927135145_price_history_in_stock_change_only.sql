-- FP5.7 (#286) / I19 (#368): record stock state with each price observation,
-- and write history ONLY on change (Option B of
-- docs/plans/FP5.7_price_history_stock_design.md, chosen by Abhinav, P2 Step 6).
--
-- Before: scripts/scrape-now.mjs appended every matched listing on every run
-- (~1,500 rows/run, ~6,100/day; ~99.5% repeats; ~32 real price changes/day
-- measured over 7 days to 27 Sep 2026). Stock state was never recorded.
--
-- After: an AFTER INSERT OR UPDATE OF price_inr, in_stock trigger on
-- store_prices writes one price_history row when:
--   * a listing is first observed (INSERT), or
--   * its price_inr or in_stock actually changes (UPDATE; the upsert's SET list
--     always names both columns, so the function compares OLD vs NEW itself).
-- Rows with price_inr NULL are never written (unchanged from the old writer).
-- recorded_at = the run's scraped_at, except a stock-only reconcile flip
-- (#140: scraped_at left unchanged), which gets now().
-- The scrape-now.mjs history-append block is removed in the same PR.
--
-- in_stock is NULL for every pre-migration row: that state was never
-- observed, and backfilling it would be a guess (G6). D26 labels such
-- history "listed price (stock not recorded)".
--
-- Backup first: boi-db-backups\2026-09-27-fp5.7\ (price_history 175,504 rows,
-- store_prices 1,884 rows; custom + plain dumps, plain COPY counts verified).
-- Applied with psql in one transaction with assertions, then recorded in
-- supabase_migrations.schema_migrations (same G7 exception as FP3.0, #197).
--
-- SECURITY INVOKER: runs as the writing role (service_role, which already
-- INSERTs into price_history today and bypasses RLS). search_path pinned.
-- The optional composite index from the design is deferred to the chart work;
-- nothing reads history per (set, store) on the write path now.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_price_history_on_change ON public.store_prices;
--   DROP FUNCTION IF EXISTS public.price_history_on_change();
--   ALTER TABLE public.price_history DROP COLUMN IF EXISTS in_stock;
--   (and revert the scrape-now.mjs commit so the append block returns)

ALTER TABLE public.price_history ADD COLUMN IF NOT EXISTS in_stock boolean NULL;

COMMENT ON COLUMN public.price_history.in_stock IS
  'Stock state at this observation. NULL = not recorded (all rows before FP5.7, 2026-09-27).';

CREATE OR REPLACE FUNCTION public.price_history_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.price_inr IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT'
     OR NEW.price_inr IS DISTINCT FROM OLD.price_inr
     OR NEW.in_stock  IS DISTINCT FROM OLD.in_stock THEN
    INSERT INTO public.price_history (set_id, store_id, price_inr, in_stock, recorded_at)
    VALUES (
      NEW.set_id, NEW.store_id, NEW.price_inr, NEW.in_stock,
      CASE
        WHEN TG_OP = 'UPDATE' AND NEW.scraped_at IS NOT DISTINCT FROM OLD.scraped_at THEN now()
        ELSE COALESCE(NEW.scraped_at, now())
      END
    );
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.price_history_on_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_price_history_on_change ON public.store_prices;
CREATE TRIGGER trg_price_history_on_change
  AFTER INSERT OR UPDATE OF price_inr, in_stock ON public.store_prices
  FOR EACH ROW EXECUTE FUNCTION public.price_history_on_change();

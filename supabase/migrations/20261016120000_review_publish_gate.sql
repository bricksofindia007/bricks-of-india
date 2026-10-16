-- boi:issue 599
-- Publish gate for public.reviews (interim, until the shared review-writer module is in place).
-- A review is refused when it is inserted or published unless it has a confirmed retailer source
-- (source_retailer, source_price_inr, source_checked_at) and its set has a store_prices row.
-- A review is refused when its verdict becomes BUY NOW unless its set has an in-stock store_prices row.
-- Ordinary content updates do not fire the gate, and existing rows are not changed.
-- The error uses the default code (P0001), not a class-23 integrity code, so the generator
-- treats a refusal as a retry, not a permanent rejection.
-- Rollback: docs/data-fix-rollbacks/review-publish-gate-rollback.sql

CREATE OR REPLACE FUNCTION public.review_publish_gate() RETURNS trigger
  LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  set_num text;
  is_publish boolean;
  becomes_buy boolean;
BEGIN
  -- store_prices is keyed by set number (text); reviews point at sets by uuid.
  SELECT s.set_number INTO set_num FROM public.sets s WHERE s.id = NEW.set_id;

  is_publish := TG_OP = 'INSERT' OR (OLD.published_at IS NULL AND NEW.published_at IS NOT NULL);
  becomes_buy := NEW.verdict = 'BUY NOW' AND (TG_OP = 'INSERT' OR OLD.verdict IS DISTINCT FROM 'BUY NOW');

  IF is_publish THEN
    IF NEW.source_retailer IS NULL OR NEW.source_price_inr IS NULL OR NEW.source_checked_at IS NULL THEN
      RAISE EXCEPTION 'review % has no confirmed retailer source; not published', NEW.slug;
    END IF;
    IF set_num IS NULL OR NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id = set_num) THEN
      RAISE EXCEPTION 'review % is for a set with no store listing; not published', NEW.slug;
    END IF;
  END IF;

  IF becomes_buy THEN
    IF set_num IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.store_prices sp WHERE sp.set_id = set_num AND sp.in_stock
    ) THEN
      RAISE EXCEPTION 'review % cannot be BUY NOW: its set has no in-stock store listing', NEW.slug;
    END IF;
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.review_publish_gate() FROM PUBLIC;

CREATE TRIGGER review_publish_gate
  BEFORE INSERT OR UPDATE OF published_at, verdict ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.review_publish_gate();

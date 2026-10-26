-- Rehearsal for the held price-history cleanup change (migration 20261026100000). STAGING ONLY.
-- Run with: psql "$STAGING_URL" -X -v ON_ERROR_STOP=1 -f scripts/rehearsal/retention-stock-state.sql
-- One transaction that always rolls back: no row stays on the database. It fails loudly if a stock-change row is removed.
--
-- Fixture: one set and one store, eight rows, all at the same price and all older than the cutoff.
--   r1 in stock, r2 in stock, r3 OUT of stock, r4 in stock, r5 in stock, r6 in stock, r7 in stock, r8 in stock (last row).
-- The rule that keeps every stock-change row:
--   r2, r3, r4 keep (each differs in stock from a neighbour); r5, r6, r7 are removed (same price and stock as both neighbours);
--   r1 and r8 keep (first and last).
-- Expected after a real run on the fixture: r1, r2, r3, r4, r8 remain. The dry run and the delete must count the same.

BEGIN;

DO $t$
DECLARE
  st   text := (SELECT id FROM public.stores LIMIT 1);
  s    text := 'rehearsal-stock-state';
  base timestamptz := now() - interval '60 days';
  defn text;
  n_dry bigint; n_del bigint; remaining text;
BEGIN
  IF st IS NULL THEN RAISE EXCEPTION 'no store row on this database; nothing to rehearse'; END IF;

  -- The new rule must be applied on this database before the rehearsal means anything.
  SELECT pg_get_functiondef('public.run_retention(integer, integer, boolean)'::regprocedure) INTO defn;
  IF defn NOT LIKE '%prev_s IS NOT DISTINCT FROM%' THEN
    RAISE EXCEPTION 'run_retention on this database does not have the stock-state rule; apply 20261026100000 on staging first';
  END IF;

  INSERT INTO public.price_history (set_id, store_id, price_inr, recorded_at, in_stock) VALUES
    (s, st, 100, base + interval '0 days', true),
    (s, st, 100, base + interval '1 day',  true),
    (s, st, 100, base + interval '2 days', false),
    (s, st, 100, base + interval '3 days', true),
    (s, st, 100, base + interval '4 days', true),
    (s, st, 100, base + interval '5 days', true),
    (s, st, 100, base + interval '6 days', true),
    (s, st, 100, base + interval '7 days', true);

  -- 1. dry run: counts the rows the real run would remove.
  SELECT (public.run_retention(30, 90, true) ->> 'price_history_deleted')::bigint INTO n_dry;

  -- 2. real run inside this transaction.
  SELECT (public.run_retention(30, 90, false) ->> 'price_history_deleted')::bigint INTO n_del;

  IF n_dry IS DISTINCT FROM n_del THEN
    RAISE EXCEPTION 'dry run (%) and delete (%) disagree', n_dry, n_del;
  END IF;

  SELECT string_agg((extract(day FROM (recorded_at - base))::int)::text, ',' ORDER BY recorded_at) INTO remaining
  FROM public.price_history WHERE set_id = s;

  IF remaining IS DISTINCT FROM '0,1,2,3,7' THEN
    RAISE EXCEPTION 'fixture rows kept are % (expected 0,1,2,3,7: r1, r2, r3, r4, r8)', remaining;
  END IF;

  RAISE NOTICE 'rehearsal PASS: dry run % = delete %, fixture kept % (stock-change rows r2, r3, r4 kept)', n_dry, n_del, remaining;
END
$t$;

ROLLBACK;

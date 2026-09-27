# FP5.7 — `price_history.in_stock` + change-only history (DESIGN ONLY, not applied)

**Status:** draft for chat review (Prescription P1 Step 10, 27 Sep 2026). Nothing here is applied. Chat prescribes the application in P2 (target ~1 Oct). The SQL below is deliberately **not** in `supabase/migrations/`, because a file there would look applied to the parity check.

## Measured today (production, 27 Sep 2026 ~13:00 UTC)

| | Value |
|---|---|
| `price_history` rows | 175,504 (18 Apr → 27 Sep), 23 MB total relation size |
| Rows per scrape run | 1,497–1,526 (every matched listing with a price, every run) |
| Rows in the last 24h | 6,093 (4 runs) |
| Rows in the last 7 days | 42,824 |
| Of those, a real **price change** vs the previous row for the same set+store | **~224 in 7 days ≈ 32/day** (1,750 "changed or first-in-window" minus ~1,526 first-in-window rows) |
| `store_prices` | 1,884 rows, 1,468 in stock |

So **~99.5% of today's history rows repeat the previous value.** Stock state isn't recorded at all, so "was it buyable then?" can't be answered for any past price.

Current schema: `id uuid pk, set_id text, store_id text, price_inr numeric null, recorded_at timestamptz default now()`. Indexes: pkey, `recorded_at DESC`, `set_id`, `store_id`. RLS: two public-read SELECT policies (anon read by design).

## 1. Migration (draft)

```sql
-- FP5.7: record stock state with each price observation.
-- NULL = unknown (every row written before this migration). Never backfilled:
-- the past stock state was not observed, and guessing it would break G6.
ALTER TABLE public.price_history ADD COLUMN in_stock boolean NULL;

-- Serves "latest observation per set+store" (the change-only writer's
-- comparison and the FP5.7 charts) without a sort. It replaces the plain
-- set_id index, because the composite's leading column covers set_id lookups.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_history_set_store_recorded
  ON public.price_history (set_id, store_id, recorded_at DESC);
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_price_history_set_id;  -- only after the new index is VALID
```

- `ADD COLUMN … NULL` with no default is a metadata-only change: no table rewrite, and the lock is brief.
- `CREATE INDEX CONCURRENTLY` can't run inside a transaction. It needs its own statement and file, or the index moves to a follow-up. Estimated ~6–8 MB at 175k rows (inside the 500 MB guard; current DB size to be re-read in the P2 prescription).
- Grants and RLS are unchanged. The new column is covered by the existing SELECT policies; `lint-migration-grants` needs no new grant.

**Rollback:**
```sql
DROP INDEX CONCURRENTLY IF EXISTS public.idx_price_history_set_store_recorded;
ALTER TABLE public.price_history DROP COLUMN IF EXISTS in_stock;
-- if idx_price_history_set_id was dropped: CREATE INDEX CONCURRENTLY idx_price_history_set_id ON public.price_history (set_id);
```
The writer rollback is a code revert: the old writer ignores the column, and change-only rows remain valid history.

## 2. Change-only writer (`scripts/scrape-now.mjs`)

**Rule:** write a history row for a (set_id, store_id) when:
- it's the **first observation** (no previous state), or
- `price_inr` changed, or
- `in_stock` changed.

Otherwise write nothing. Rows with `price_inr = null` are still never written (as today).

**Where the previous state comes from: two options.**

**A. Writer-side, using the `store_prices` snapshot (fits the prescription's "writer" framing).**
- Before the upsert, read `store_prices(set_id, price_inr, in_stock)` for this store, paginated at 1,000 rows (one or two requests, ~60 KB).
- After the upsert, compare each matched row with the snapshot:
  - no snapshot row → first observation
  - `price_inr` or `in_stock` differs → change
  - otherwise skip
- Insert only those rows (batched as today), with `in_stock: p.inStock`.
- The **reconcile step** (#140: rows unseen for 20h get `in_stock=false`) must also write a history row per flipped set, `{price_inr: <last price>, in_stock: false}`. Today it's a bulk `.update()`, so it needs `.select('set_id, price_inr')` on that update to know which rows flipped.
- G2 cost: +1–2 GETs per store per run (+8–16/day).
- Risk: every future scraper (FP5 retailers) must reimplement the same rule. G5 says the contract does, but it's duplicated logic.

**B. DB-side trigger on `store_prices` (recommended).**
```sql
CREATE OR REPLACE FUNCTION public.price_history_on_change() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.price_inr IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT'
     OR NEW.price_inr IS DISTINCT FROM OLD.price_inr
     OR NEW.in_stock  IS DISTINCT FROM OLD.in_stock THEN
    INSERT INTO public.price_history (set_id, store_id, price_inr, in_stock, recorded_at)
    VALUES (NEW.set_id, NEW.store_id, NEW.price_inr, NEW.in_stock, COALESCE(NEW.scraped_at, now()));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_price_history_on_change
  AFTER INSERT OR UPDATE OF price_inr, in_stock ON public.store_prices
  FOR EACH ROW EXECUTE FUNCTION public.price_history_on_change();
```
- The writer then **deletes** its history-append block. It adds zero requests, and it actually saves ~1,500 inserted rows of egress per run.
- Covers the upsert, the #140 reconcile update, and every future scraper or manual fix automatically. G5 "change-only history" can't be skipped by a new scraper.
- `recorded_at = NEW.scraped_at` keeps one timestamp per run (charts group by run). For the reconcile flip, `scraped_at` is the stale time, so use `now()` there: `CASE WHEN TG_OP='UPDATE' AND NEW.scraped_at = OLD.scraped_at THEN now() ELSE NEW.scraped_at END`.
- Trigger runs as the writer's role (service_role). It needs INSERT on `price_history`, which it has today.
- **First observation at cutover:** the trigger only sees changes *after* it exists. The first post-deploy run therefore writes history only for rows that changed. The **last pre-cutover full run is the baseline**, and it already contains every current row. **Seed:** apply the trigger immediately after a normal full run, and don't delete old history (FP5.7's retention stays as planned).
- Rollback: `DROP TRIGGER trg_price_history_on_change ON public.store_prices; DROP FUNCTION public.price_history_on_change();` and revert the writer commit (the append block comes back).

**Recommendation: B.** One place, zero added requests, and it can't be bypassed. A is the fallback if chat wants no triggers on the hot table.

## 3. Test plan

1. **Staging first (D-8 / FP2.1, after 29 Sep):** apply the migration, then run the scraper twice against staging data (or a fixture feed). Expect:
   - run 1 writes N rows (all first observations);
   - run 2 with an unchanged feed writes **0**;
   - run 3 with 1 price edit + 1 stock flip writes **exactly 2**, with the right `in_stock` values.
2. **Reconcile path:** age one staging row's `scraped_at` by 21h and run. Expect one history row with `in_stock=false` and `recorded_at≈now()`.
3. **Null price:** a feed row with no price writes no history row.
4. **Unit test:** a pure `changedRows(prevSnapshot, matched)` helper (option A), or a SQL test script run in a rolled-back transaction on staging (option B):
   - `INSERT` fires;
   - `UPDATE` with the same values doesn't;
   - `UPDATE` of price fires;
   - `UPDATE` of stock fires;
   - `UPDATE` of only `scraped_at` doesn't.
5. **Production proof (the "real end-to-end run" rule):** after apply, the first scheduled scrape. Report the actual inserted history rows (set, store, old→new price/stock), and check that the count ≈ the number of `store_prices` rows whose price or stock changed in that run. Then compare 24h history volume before and after.
6. **Readers:** grep every `price_history` reader (deal calcs retired in PR-B; charts, hygiene checks, growth-engine content grant) for code that assumes "one row per run". Anything computing "last N runs" or averages per run must switch to step-function semantics (a row means "from this time until the next row").

## 4. Expected volume

| | Today | After FP5.7 |
|---|---|---|
| Rows/day | ~6,100 | **~40–100** (price changes ~32/day measured, plus stock flips, estimated at a similar order since they aren't measurable today, plus new listings) |
| Rows/year | ~2.2M (~290 MB at today's ~130 B/row incl. indexes) | ~15–35k (~2–5 MB) |
| Write egress per run | ~1,500-row insert | ~10–25 rows (B: server-side, no extra request) |
| Retailer launches (Hamleys, FirstCry, Jaiman, FP5) | Would multiply the 6,100/day by store count | First run per retailer = its listing count once; then changes only |

**Watch after launch:**
- A sudden high row count means a retailer's prices are flapping (a parser or variant bug). That's a better signal than today, where every run looks the same.
- Add "history rows written this run" to the scrape summary and the FP6 heartbeat.

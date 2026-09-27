# ADR 0002: `price_history` is written change-only by a trigger on `store_prices`

**Status:** Accepted, 27 Sep 2026 (FP5.7 #286, I19 #368; migration 20260927135145, PR #384; reader follow-up #383, PR #386)

## Context
`scripts/scrape-now.mjs` appended every matched listing to `price_history` on every run: ~1,500 rows per run, ~6,100 per day, ~99.5% of them repeats (about 32 real price changes a day measured over 7 days). Stock state was never recorded, so "was it buyable then?" couldn't be answered.

## Options
- **A. Writer-side:** before upserting, read the store's current `store_prices`, compare, and insert only the changes. It costs 1–2 extra reads per store per run. Every future scraper (FP5 retailers) would have to reimplement the rule, and the #140 reconcile flip needs its own history write.
- **B. DB trigger:** an `AFTER INSERT OR UPDATE OF price_inr, in_stock ON store_prices` trigger writes one row on first observation (INSERT) or when price or stock actually changes (it compares OLD and NEW itself, because the upsert's SET list always names both columns).

## Decision
**B** (Abhinav, P2 Step 6). There's one place for the rule. It adds zero requests and actually saves the ~1,500-row insert per run. It covers the upsert, the #140 reconcile flip, manual fixes and every future scraper automatically, so G5's "change-only history" can't be bypassed. The history row is written in the same statement as its `store_prices` change, so neither can exist without the other.

Details:
- `in_stock boolean NULL`: NULL = not recorded (every pre-migration row). It's never backfilled (G6); D26 labels that history honestly.
- `recorded_at` = the run's `scraped_at`, except a stock-only reconcile flip (`scraped_at` unchanged), which uses `now()`.
- NULL prices are never written. `SECURITY INVOKER`, search_path pinned.

## What `scrape-now.mjs` no longer does
It no longer builds or inserts history rows (the old "Append to price_history" block, lines 289–312). It now only **counts** the rows the trigger wrote this run (one HEAD request per store) and prints them in the log and summary.

## Consequences
- Readers must treat history as a **step function**: a row means "from this time until the next row". The two readers that took "the oldest row in the 30-day window" as the baseline (`/lab/price-drops`, VID-P4 `get_price_drops()`) were switched to "the latest row at or before the window start" (#383), with tests.
- `run_retention()` compaction and the growth newsletter queries were already step-compatible.
- Rollback: drop the trigger and function, drop the column, and revert the writer commit.

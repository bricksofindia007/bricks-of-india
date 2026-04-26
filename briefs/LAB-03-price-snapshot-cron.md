# LAB-03 — Daily Price Snapshot Cron

**Owner:** Abhinav
**Status:** Ready to fire
**Estimated time:** 2–3 days
**Priority:** Ships before LAB-05 (Price Drop Board) — accumulates 30 days of data silently
**No user-facing UI in this brief.** This is infrastructure only.

---

## What this is

A daily GitHub Actions cron that reads current prices from the existing scraped store data (Toycra, MyBrickHouse, Jaiman) and writes a daily snapshot row per set per store into a new `price_snapshots` table. Runs at 03:00 UTC daily.

This is the data layer that LAB-05 (Price Drop Board) will read from. Without 30 days of accumulated history, LAB-05 cannot show "lowest price in 30 days" or "X% below 30-day average" claims.

**Strategy: silent accumulation.** Snapshots start writing today. LAB-05 ships in week 5–6 with a fully populated 30-day window, no thin-launch period.

---

## Prereqs

```
git status                       # working tree clean, on main
git pull origin main              # up to date
cat BOI_MASTER_TRACKER.md         # context refresh
cat DATA_SOURCES.md               # understand current price tables
```

You should already understand from `DATA_SOURCES.md`:
- The `store_prices` table (current scraped store prices)
- The `prices` table (whatever the second one is — DATA-01 ticket flagged this disconnect)
- The existing GHA workflows under `.github/workflows/`

If `DATA_SOURCES.md` doesn't make these clear, STOP and report.

---

## Preamble — read for context

1. `BOI_MASTER_TRACKER.md`
2. `DATA_SOURCES.md` (especially the section on store_prices vs prices — that disconnect is relevant here)
3. Existing `.github/workflows/sync-catalogue.yml` and `.github/workflows/catalogue-audit.yml` — match conventions
4. Existing scraper output schema — what fields are in `store_prices` right now? Confirm before designing the snapshot table.

---

## Phase 1 — Schema design (no-build, decision required)

### The new table

```sql
CREATE TABLE price_snapshots (
  id           BIGSERIAL PRIMARY KEY,
  set_num      TEXT NOT NULL,
  store        TEXT NOT NULL,        -- 'toycra' | 'mybrickhouse' | 'jaiman'
  price_inr    INTEGER NOT NULL,     -- in rupees, no decimals
  in_stock     BOOLEAN NOT NULL,
  snapshot_date DATE NOT NULL,       -- the day this snapshot represents (UTC)
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (set_num, store, snapshot_date)
);

CREATE INDEX idx_price_snapshots_set_date
  ON price_snapshots (set_num, snapshot_date DESC);

CREATE INDEX idx_price_snapshots_date
  ON price_snapshots (snapshot_date DESC);
```

### Decisions and rationale (do NOT change without asking)

- **`price_inr` is INTEGER, not NUMERIC.** Indian prices have no paisa precision in retail LEGO. Integer rupees only.
- **`UNIQUE (set_num, store, snapshot_date)`** — one row per set per store per day. Upsert on conflict, don't insert duplicates. If the cron runs twice on the same day for any reason, the second run UPDATEs.
- **`snapshot_date` is DATE, not TIMESTAMPTZ.** All snapshots collapse to a single day in UTC. Mumbai is UTC+5:30 — a 03:00 UTC cron runs at 08:30 IST, which is fine.
- **Store names are lowercase enums in TEXT.** No store_id foreign key. If we add a fourth store, we add a new value, not a new table.
- **`in_stock` snapshot.** The Price Drop Board cares about in-stock prices. Out-of-stock snapshots are recorded (so we know it WAS out of stock) but the board filters them out at query time.

### What we are NOT doing

- ❌ No price history per session/cart/user — no auth, no per-user data
- ❌ No tracking which scrape source produced this snapshot — store name is enough
- ❌ No "price prediction" / forecasting columns
- ❌ No retention policy in this brief — snapshots accumulate forever for now (rows will be small enough to ignore for 2+ years)
- ❌ No replication to a separate analytics database

---

## Phase 2 — Migration (build)

```
git checkout -b feat/lab-price-snapshots
```

Add the migration. Use whatever migration tool the project already uses (Supabase migrations, Prisma, raw SQL files — match what's there, do not invent).

Apply the migration to the dev database first. Verify the schema landed correctly:

```
\d price_snapshots
```

Should show all columns, the unique constraint, and both indexes. Report the output.

---

## Phase 3 — The snapshot script (build)

Create `scripts/snapshot-prices.js` (or `.ts` if the project uses TypeScript end-to-end).

### Logic

1. Query `store_prices` (or whatever the current scraper output table is — confirm in Phase 1) for all rows with non-NULL prices, latest scrape per (set_num, store).
2. For each row, upsert into `price_snapshots`:
   ```
   INSERT INTO price_snapshots (set_num, store, price_inr, in_stock, snapshot_date)
   VALUES (?, ?, ?, ?, CURRENT_DATE)
   ON CONFLICT (set_num, store, snapshot_date)
   DO UPDATE SET
     price_inr = EXCLUDED.price_inr,
     in_stock = EXCLUDED.in_stock,
     captured_at = now();
   ```
3. Log: total rows considered, rows written, rows updated, rows skipped (and why).
4. Exit code 0 on success, 1 on failure.

### Failure handling

- If the source table query fails → log the error, exit 1, GHA fails the job, alert email fires.
- If a single row's upsert fails → log it, continue processing the rest. Single bad rows don't kill the run. Aggregate failure count at the end; if >5% of rows failed, exit 1.
- If the source table is empty (zero rows) → exit 1 with explicit error "no source price data, refusing to write zero snapshots." This catches scraper failures upstream.

### Logging format

Match the existing scraper logs (look at how `sync-rebrickable.js` logs). Probably console.log with structured prefixes: `[snapshot-prices] considered 16,888 rows`, etc.

---

## Phase 4 — The GitHub Actions workflow (build)

Create `.github/workflows/snapshot-prices.yml`:

```yaml
name: Daily price snapshot

on:
  schedule:
    - cron: '0 3 * * *'  # 03:00 UTC daily = 08:30 IST
  workflow_dispatch:      # allow manual trigger

jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: Run snapshot
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: node scripts/snapshot-prices.js
      - name: Alert on failure
        if: failure()
        # Use whatever alerting pattern catalogue-audit.yml uses
        # (probably an email step or a webhook)
```

Match the alerting pattern from `catalogue-audit.yml`. Do not invent a new alert mechanism.

---

## Phase 5 — Local verification

Before pushing, run the script manually against the dev database:

```
node scripts/snapshot-prices.js
```

Verify:

- [ ] Script exits 0
- [ ] `SELECT COUNT(*) FROM price_snapshots` returns expected count (close to count of in-stock rows in `store_prices`)
- [ ] `SELECT * FROM price_snapshots ORDER BY captured_at DESC LIMIT 5` shows recent rows with today's date
- [ ] Run the script a second time — confirm no duplicate rows (ON CONFLICT works)
- [ ] `SELECT COUNT(*) FROM price_snapshots WHERE snapshot_date = CURRENT_DATE` should equal expected unique (set, store) pairs, not double
- [ ] Force a failure (point to wrong source table) — confirm exit 1 and useful error log
- [ ] Empty source check — confirm script refuses to write zero rows

Report each check's result.

---

## Phase 6 — Commit and PR

```
git add db/migrations/ scripts/snapshot-prices.js .github/workflows/snapshot-prices.yml
git commit -m "feat(infra): daily price snapshot cron + price_snapshots table"
git push origin feat/lab-price-snapshots
```

PR title: `feat(infra): Daily price snapshots (LAB-03)`

PR body:
- Why: prereq for LAB-05 Price Drop Board, needs 30 days of accumulated data before that feature can launch
- Migration applied to dev: confirm yes/no
- Cron schedule: 03:00 UTC daily (08:30 IST)
- First production snapshot will be: <date of merge + 1>
- Note: this PR has zero user-facing changes. Verify by browsing the live preview.

**STOP. Do not merge.** Wait for review.

---

## Phase 7 — Post-merge (do NOT do this in the PR)

After merge, after the first scheduled run:

1. Verify in production: `SELECT COUNT(*) FROM price_snapshots WHERE snapshot_date = CURRENT_DATE`
2. Add a tracker row: "LAB-03 snapshot cron live, day 1 = <date>, day 30 (LAB-05 launch eligibility) = <date+30>"
3. Add a calendar reminder for day +30 to fire LAB-05.

These are NOT actions inside the PR. They are post-merge verification steps. Do them after PR is approved and merged.

---

## Hard rules

- No retention policy in this PR. Snapshots accumulate. Cleanup is a future ticket.
- No backfill of historical prices from other sources. We start fresh from snapshot day 1.
- No changes to existing `store_prices` or `prices` tables. This brief adds a new table; it does not refactor existing tables. (DATA-01 ticket handles that separately.)
- Cron runs at 03:00 UTC, not any other time. If you want to change it, ask first.
- If `store_prices` schema differs from what `DATA_SOURCES.md` describes, STOP and report. Do not guess column names.
- No INSERT without ON CONFLICT. Re-runs must be idempotent.
- No SELECT * in the snapshot script — name columns explicitly.

---

## When done — print this exact summary

```
LAB-03 PRICE SNAPSHOT CRON — DONE

Branch: feat/lab-price-snapshots
PR URL: <url>
Migration: <path to migration file>
Script: scripts/snapshot-prices.js
Workflow: .github/workflows/snapshot-prices.yml
Cron: 03:00 UTC daily (08:30 IST)

Schema verified:
  price_snapshots table: <row count after dry run>
  Unique constraint (set_num, store, snapshot_date): YES
  Indexes: idx_price_snapshots_set_date, idx_price_snapshots_date

Local dry-run results:
  Source rows considered: <n>
  Snapshots written: <n>
  Snapshots updated (re-run): <n>
  Idempotency verified: PASS
  Empty-source guard verified: PASS
  Failure exit code verified: PASS

Production launch eligibility for LAB-05 (Price Drop Board):
  Snapshot day 1: <merge date + 1>
  30-day data window complete: <merge date + 31>

Outstanding follow-ups (not in this PR):
  - Tracker entry post-merge
  - Calendar reminder for LAB-05 launch eligibility date
  - Retention policy (future, no urgency until 100K+ rows)
```

Then STOP.

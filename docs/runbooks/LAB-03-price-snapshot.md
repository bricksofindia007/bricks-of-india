# LAB-03 Price Snapshot — Operator Runbook

**Context:** Phase 5 verification from `briefs/LAB-03-price-snapshot-cron.md`. Deferred to operator — run these steps after applying the migration and before declaring LAB-03 live.

---

## Prerequisites

1. Apply the migration in the Supabase dashboard SQL Editor — paste and run `db/migrations/001_price_snapshots.sql`.

   Verify it landed:
   ```sql
   \d price_snapshots
   ```
   Expected: all columns, the `UNIQUE (set_num, store, snapshot_date)` constraint, and both indexes (`idx_price_snapshots_set_date`, `idx_price_snapshots_date`).

2. Confirm `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

---

## Step 1 — First run

```bash
node scripts/snapshot-prices.js
```

**Expected output:**
```
[snapshot-prices] Starting daily snapshot for YYYY-MM-DD
[snapshot-prices] considered ~492 rows from store_prices
[snapshot-prices] ~492 unique (set, store) pairs — 0 older duplicate rows skipped
[snapshot-prices] N rows written, 0 rows failed, 0 older-duplicate rows skipped
[snapshot-prices] 🏁 Done.
```
Exit code: **0**

**Verify row count:**
```sql
SELECT COUNT(*) FROM price_snapshots;
```
Expected: close to the unique (set_id, store_id) count in store_prices (~492).

**Verify recent rows:**
```sql
SELECT set_num, store, price_inr, in_stock, snapshot_date, captured_at
FROM price_snapshots
ORDER BY captured_at DESC
LIMIT 5;
```
Expected: 5 rows with today's UTC date in `snapshot_date`.

---

## Step 2 — Idempotency check (re-run immediately)

```bash
node scripts/snapshot-prices.js
```

**Expected output:** Script logs `Re-run detected — N rows already exist for YYYY-MM-DD. Upserts will UPDATE existing rows.` and exits 0.

**Verify no duplicates:**
```sql
SELECT COUNT(*) FROM price_snapshots WHERE snapshot_date = CURRENT_DATE;
```
Expected: **same count as Step 1** — ON CONFLICT fired, no new rows inserted.

---

## Step 3 — Failure mode: bad source table

Temporarily edit line ~53 of `scripts/snapshot-prices.js`: change `'store_prices'` to `'store_prices_nonexistent'`.

```bash
node scripts/snapshot-prices.js
```

Expected: exit code **1**, log contains `ERROR: source query failed`.

Revert the edit before continuing.

---

## Step 4 — Failure mode: empty source guard

Temporarily add `.eq('store_id', '__force_empty__')` to the `.select(...)` chain in the source query (line ~55).

```bash
node scripts/snapshot-prices.js
```

Expected: exit code **1**, log contains `ERROR: no source price data, refusing to write zero snapshots.`

Revert the edit before continuing.

---

## Step 5 — Post-verification notes

Once Steps 1–4 pass:

- Record snapshot day 1 date in `BOI_MASTER_TRACKER.md` under Phase / LAB-03.
- Set a calendar reminder for **day +30** — that is LAB-05 (Price Drop Board) launch eligibility.

```sql
SELECT MIN(snapshot_date) AS day_1, MAX(snapshot_date) AS latest, COUNT(DISTINCT snapshot_date) AS days_accumulated
FROM price_snapshots;
```

This query is your ongoing progress check. LAB-05 is eligible when `days_accumulated >= 30`.

---

## Cron stacking note

Snapshot-prices runs at 08:30 IST daily. Catalogue-audit runs at 09:00 IST on Mondays only. The 30-minute Monday gap is intentional and non-blocking — both workflows are independent, and snapshot runtime is ~200s (well under timeout). If either job's runtime approaches 25+ minutes in future, reschedule one of them to widen the gap.

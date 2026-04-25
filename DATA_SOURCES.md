# BOI Data Sources Runbook

> **Purpose:** Authoritative record of what data powers bricksofindia.com, where it comes from, how it refreshes, and what breaks if a source goes down.
>
> **Last updated:** 2026-04-25 (CATALOG-FIX-01 v2 + DIAGNOSE-02 dedup clarification)

---

## Quick-reference table

| Data | Source | Refresh cadence | Ingest script | Alert if broken |
|------|--------|-----------------|---------------|-----------------|
| Set catalogue (metadata) | Rebrickable API | Weekly Sun 02:00 UTC | `scripts/sync-rebrickable.js` | `catalogue-sync-failed` issue |
| Set images | Rebrickable CDN | On catalogue sync | Part of sync script | `catalogue-audit-failed` issue |
| Indian retail prices | Toycra, MyBrickHouse, Jaiman (Shopify) | Every 6h | `scripts/scrape-now.mjs` | `catalogue-audit-failed` issue |
| INR derived price (MRP) | USD MSRP × 1.35 × USD/INR | On catalogue sync | Part of sync script | None yet — TODO |
| USD MSRP | Not yet populated — TODO | — | — | — |
| Exchange rate (USD/INR) | frankfurter.app | On catalogue sync | Part of sync script | Falls back to 83.0 |
| Article content | Supabase (`news_articles`, `blog_posts`) | Manual publish | n/a | n/a |
| Review content | Supabase (`reviews`) | Manual publish | n/a | n/a |
| Theme images | Rebrickable CDN (same as set images) | On catalogue sync | `scripts/fetch-theme-images.mjs` (read-only audit) | n/a |
| Videos | TODO: confirm with Abhinav | — | — | — |

---

## 1. Set catalogue

**Table:** `sets`
**Primary source:** [Rebrickable API v3](https://rebrickable.com/api/) — `GET /lego/sets/`
**Auth:** `REBRICKABLE_API_KEY` (GitHub secret)
**Ingest script:** `scripts/sync-rebrickable.js`
**Refresh cadence:** Weekly — every Sunday 02:00 UTC (07:30 IST) via `.github/workflows/sync-catalogue.yml`
**Coverage:** Full Rebrickable catalogue (no year filter, no page cap, `page_size=1000`).

**Dedup behaviour:** `set_num.replace(/-\d+$/, '')` strips the Rebrickable variant suffix before upsert, so `75192-1` and `75192-2` both map to `set_number = "75192"`. This collapses inventory variants and minifigure-series individual entries (e.g. 12–16 entries per series → 1 row) into a single canonical row. This is intentional, not data loss. Rebrickable's ~26,000 entries deduplicate to approximately **~10,000 unique rows** in the `sets` table. The post-write assertion requires ≥ 8,000 rows.

**On failure:** GHA opens a GitHub issue labelled `catalogue-sync-failed`
**Manual trigger:** Actions → Sync LEGO Catalogue → Run workflow

**Fields populated by sync:**
| Column | Source |
|--------|--------|
| `set_number` | Rebrickable `set_num` (variant suffix stripped: `75192-1` → `75192`) |
| `rebrickable_id` | Full Rebrickable ID (e.g. `75192-1`) for CDN image URL construction |
| `name` | Rebrickable |
| `theme` | Rebrickable theme name (resolved via `/lego/themes/{id}/`) |
| `year` | Rebrickable |
| `pieces` | Rebrickable `num_parts` |
| `image_url` | Rebrickable `set_img_url` (CDN: `cdn.rebrickable.com/media/sets/...`) |
| `lego_mrp_inr` | Derived: `ROUND(usd_msrp × 1.35 × USD/INR)` — **currently 0 rows** because `usd_msrp` column does not yet exist |

**Fields NOT populated by sync (must come from other sources):**
| Column | Status |
|--------|--------|
| `usd_msrp` | Column does not exist yet. TODO: add column + ingest from Brickset (`BRICKSET_API_KEY` in secrets). Brickset field: `LEGOCom.US.retailPrice`. |
| `description` | NULL for all rows. TODO: source from Brickset or LEGO website. |
| `age_range` | NULL for all rows. TODO: source from Brickset. |
| `minifigs` | NULL for all rows. TODO: source from Rebrickable `/lego/sets/{id}/minifigs/`. |
| `subtheme` | NULL for all rows. TODO: source from Rebrickable. |

**Assertion:** Sync script exits non-zero if post-sync row count < 8,000.

---

## 2. Indian retail prices

**Table:** `store_prices`
**Sources:** Toycra, MyBrickHouse, Jaiman Toys — Shopify `products.json` API (no auth required)
**Ingest script:** `scripts/scrape-now.mjs`
**Refresh cadence:** Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC) via `.github/workflows/scrape-prices.yml`
**Coverage:** ~492 rows across 3 stores (live LEGO products only — Toycra via `/collections/lego/products.json`, others via general `/products.json`)

**Schema (store_prices):**
| Column | Notes |
|--------|-------|
| `set_id` | Set number as string (e.g. `"75192"`) — NOT a UUID foreign key |
| `store_id` | `toycra` / `mybrickhouse` / `jaiman` |
| `price_inr` | Scraped live price |
| `in_stock` | Boolean |
| `product_url` | Direct buy link |
| `scraped_at` | Timestamp of last successful scrape |

**⚠️ Known disconnect (DATA-01):** `store_prices.set_id` is a plain string set_number. The `prices` table (2,000 rows) uses UUID foreign keys to `sets.id`. The two tables are **not currently joined**. Theme pages and set detail pages query `store_prices` directly; `/compare` queries the `prices` table. This means live scraper prices don't feed into the compare page. Fix tracked as DATA-01 in `BOI_WEB_TRACKER.md`.

---

## 3. Derived INR price (MRP estimate)

**Table column:** `sets.lego_mrp_inr`
**Formula:** `ROUND(usd_msrp × 1.35 × USD/INR_rate)`
- 1.35 multiplier accounts for import duty + GST + retailer margin (locked — do not change without Abhinav's approval)
- USD/INR rate sourced from `api.frankfurter.app/latest?from=USD&to=INR` (ECB-backed, free, no auth)
- Fallback rate if API unavailable: **83.0** (hardcoded, logged as warning)

**Current status:** 0 rows have `lego_mrp_inr` populated.
**Blocker:** `usd_msrp` column does not exist in `sets` table. No MSRP ingest source is wired.
**To fix:**
1. Add `usd_msrp NUMERIC` column to `sets` table (schema migration)
2. Ingest USD MSRP from Brickset API (key: `BRICKSET_API_KEY` in GH secrets). Field: `LEGOCom.US.retailPrice`.
3. Re-run `sync-rebrickable.js` — the derivation step will populate `lego_mrp_inr` automatically.

---

## 4. Exchange rate

**Source:** `https://api.frankfurter.app/latest?from=USD&to=INR`
**Auth:** None
**Cadence:** Fetched on each catalogue sync (weekly). Not cached between syncs.
**Fallback:** Hardcoded `83.0` — used if the API is unreachable. A warning is logged when the fallback fires.

---

## 5. Images

**Set images:** Rebrickable CDN — `https://cdn.rebrickable.com/media/sets/{rebrickable_id}/{hash}.jpg`
Stored as `sets.image_url` during catalogue sync. No separate image pipeline.

**Theme grid images:** Hardcoded Rebrickable CDN URLs in `src/lib/brand.ts` (THEMES array). These don't refresh automatically. `scripts/fetch-theme-images.mjs` is a read-only audit tool to spot-check that the URLs still resolve.

**Fallback chain (set detail page):** `sets.image_url` → `https://cdn.rebrickable.com/media/sets/{rebrickable_id}.jpg` → `/mascots/blue-fig-confused.png`

**Brickset images:** `BRICKSET_API_KEY` is present in GitHub secrets. TODO: confirm with Abhinav whether Brickset is used as a fallback for images not in Rebrickable CDN, or if this key is reserved for MSRP ingest only.

---

## 6. Article and review content

**Tables:** `news_articles`, `blog_posts`, `reviews`
**Source:** Manually authored and inserted via Supabase dashboard or seed scripts
**Format:** Markdown (stored as plain text — rendered server-side via `react-markdown`)
**Refresh:** On demand — no automated pipeline

---

## 7. Videos

TODO: confirm with Abhinav. Planned: YouTube channel RSS feeds (Phase 3, Content OS — not yet built).

---

## 8. Catalogue audit

**Workflow:** `.github/workflows/catalogue-audit.yml`
**Schedule:** Every Monday 03:30 UTC (09:00 IST)
**Checks:**
- `sets` row count ≥ 8,000 (note: ~26k Rebrickable entries → ~10k unique rows after dedup)
- ≥ 50% of sets have `lego_mrp_inr`
- ≥ 80% of sets have `image_url`
- Each scraper's last run ≤ 8 days ago
- `GET /api/sets/search?q=Concorde` returns > 0 results
- `/compare?q=Technic` does not render empty state
- `/themes/star-wars` shows ≥ 20 sets
**On failure:** Opens GitHub issue labelled `catalogue-audit-failed`

---

## TODOs (confirmed gaps, not guesses)

| # | Gap | Owner |
|---|-----|-------|
| 1 | `usd_msrp` column missing — INR derivation can't run | TODO: confirm MSRP source with Abhinav |
| 2 | Brickset API key present in secrets — confirm if it's used and for what | TODO: confirm with Abhinav. Known: `LEGOCom.US.retailPrice` is the MSRP field. |
| 3 | `store_prices` ↔ `prices` table disconnect (DATA-01) — scraper data not in compare page | See BOI_WEB_TRACKER.md DATA-01 |
| 4 | `minifigs`, `age_range`, `description`, `subtheme` all NULL — sets metadata incomplete | Source from Rebrickable minifigs endpoint + Brickset |
| 5 | Video data source — no pipeline exists | TODO: confirm with Abhinav (YouTube RSS feeds planned) |
| 6 | Theme page freshness — pre-rendered at build time, stale until next deploy | Refresh after each catalogue sync triggers a deploy |

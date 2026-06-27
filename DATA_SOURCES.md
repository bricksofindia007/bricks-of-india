# BOI Data Sources Runbook

> **Purpose:** Authoritative record of what data powers bricksofindia.com, where it comes from, how it refreshes, and what breaks if a source goes down.
>
> **Last updated:** 2026-06-27 (consolidation audit: Jaiman removed Day 33, usd_msrp column exists at ~45% coverage, article pipeline automated, YouTube RSS live, store_prices ~1,512 rows across 2 stores)

---

## Quick-reference table

| Data | Source | Refresh cadence | Ingest script | Alert if broken |
|------|--------|-----------------|---------------|-----------------|
| Set catalogue (metadata) | Rebrickable API | Weekly Sun 02:00 UTC | `scripts/sync-rebrickable.js` | `catalogue-sync-failed` issue |
| Set images | Rebrickable CDN | On catalogue sync | Part of sync script | `catalogue-audit-failed` issue |
| Indian retail prices | Toycra, MyBrickHouse | Every 6h | `scripts/scrape-now.mjs` | `catalogue-audit-failed` issue |
| INR derived price (MRP) | USD MSRP × 1.35 × USD/INR | On catalogue sync | Part of sync script | None yet — TODO |
| USD MSRP | Not yet populated — TODO | — | — | — |
| Exchange rate (USD/INR) | frankfurter.app | On catalogue sync | Part of sync script | Falls back to 83.0 |
| Article content | Supabase (`news_articles`, `blog_posts`) | Daily cron (`generate-drafts.yml` 08:30 UTC) + manual | `scripts/generate-approved-drafts.ts` | n/a |
| Review content | Supabase (`reviews`) | RADAR-08 pipeline + manual | `scripts/generate-approved-drafts.ts` | n/a |
| Theme images | Rebrickable CDN (same as set images) | On catalogue sync | `scripts/fetch-theme-images.mjs` (read-only audit) | n/a |
| Videos (BOI channel) | Bricks of India YouTube channel RSS (Tier 4, RADAR-01) | Daily | `scripts/fetch-rss.js` | n/a |

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
| `lego_mrp_inr` | Derived: `ROUND(usd_msrp × 1.35 × USD/INR)` — populated since Day 28 (`scripts/populate-mrp.js`). Coverage: ~45% of sets with year ≥ 2020. |

**Fields NOT populated by sync (must come from other sources):**
| Column | Status |
|--------|--------|
| `usd_msrp` | Column exists (added Day 28). Populated by `scripts/populate-mrp.js` from Brickset API (`BRICKSET_API_KEY`). Field: `LEGOCom.US.retailPrice`. Coverage: ~45% of sets with year ≥ 2020; older/niche sets remain NULL. |
| `description` | NULL for all rows. TODO: source from Brickset or LEGO website. |
| `age_range` | NULL for all rows. TODO: source from Brickset. |
| `minifigs` | NULL for all rows. TODO: source from Rebrickable `/lego/sets/{id}/minifigs/`. |
| `subtheme` | NULL for all rows. TODO: source from Rebrickable. |

**Assertion:** Sync script exits non-zero if post-sync row count < 8,000.

---

## 2. Indian retail prices

**Table:** `store_prices`
**Sources:** Toycra, MyBrickHouse — Shopify `products.json` API (no auth required). Jaiman Toys (previously active) was removed Day 33; may return if Hamleys or a replacement retailer is added under STORE-01.
**Ingest script:** `scripts/scrape-now.mjs`
**Refresh cadence:** Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC) via `.github/workflows/scrape-prices.yml`
**Coverage:** ~1,512 rows across 2 stores (live LEGO products only — Toycra via `/collections/lego/products.json`, MBH via `/collections/lego/products.json`)

**Schema (store_prices):**
| Column | Notes |
|--------|-------|
| `set_id` | Set number as string (e.g. `"75192"`) — NOT a UUID foreign key |
| `store_id` | `toycra` / `mybrickhouse` |
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

**Current status:** `lego_mrp_inr` populated for ~45% of sets with year ≥ 2020. `usd_msrp` column exists and is partially filled.
**Remaining gap:** Sets pre-2020 or with no Brickset MSRP listing have `usd_msrp = NULL` and therefore `lego_mrp_inr = NULL`.
**To improve coverage:** Re-run `scripts/populate-mrp.js` after additional Brickset MSRP data is available for older/niche sets. The derivation step runs automatically on each populate run.

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
**Source:** Primarily pipeline-generated via `scripts/generate-approved-drafts.ts` (Gemini 2.5 Flash-Lite primary; Cerebras gpt-oss-120b failover). Operator reviews signals in `/admin/pending` and approves for generation. Some content (guides, opinion posts, manual reviews) is hand-authored by Abhinav.
**Format:** Markdown (stored as plain text — rendered server-side via `react-markdown`)
**Refresh:** `generate-approved-drafts.ts` runs daily at 08:30 UTC on approved `pending_drafts` rows. `publish-drafts.yml` auto-publishes lint-passing drafts 3×/day or operator publishes manually via `/admin/pending`.

---

## 7. Videos

**BOI YouTube channel** RSS is ingested daily via RADAR-01 (`scripts/fetch-rss.js`, Tier 4 source, channel_id: `UC1CCrLlp4XnOoxVzAftFwfQ`, added Day 9). Signals surface in `raw_signals` and proceed through the RADAR pipeline. Social automation pipeline (`social-automation/pipeline.py`) posts to IG and YouTube Shorts daily at 06:30 UTC. YouTube Shorts posting blocked since Day 34 (`invalid_grant`) — Google verification review submitted 2026-06-02; see YT-OAUTH-01 in master tracker.

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
| 1 | `usd_msrp` coverage at ~45% — older/niche sets missing | Backfill via additional `populate-mrp.js` runs; field `LEGOCom.US.retailPrice` from Brickset |
| 2 | Brickset API key used for MSRP ingest (`populate-mrp.js`) | Confirmed — `LEGOCom.US.retailPrice` is the field |
| 3 | `store_prices` ↔ `prices` table disconnect (DATA-01) — scraper data not in compare page | Legacy `prices` table still exists; /compare reads from it. Cleanup tracked as LOW-20 |
| 4 | `minifigs`, `age_range`, `description`, `subtheme` all NULL — sets metadata incomplete | Source from Rebrickable minifigs endpoint + Brickset |
| 5 | YouTube Shorts OAuth blocked since Day 34 (`invalid_grant`) | Google verification review submitted 2026-06-02; see YT-OAUTH-01 in master tracker |
| 6 | Theme page freshness — pre-rendered at build time, stale until next deploy | Refresh after each catalogue sync triggers a deploy |

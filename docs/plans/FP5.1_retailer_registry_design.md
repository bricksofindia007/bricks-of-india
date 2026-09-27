# FP5.1: Retailer registry (DESIGN ONLY, not applied)

**Status:** draft for chat sign-off (P3 Step 3, 27 Sep 2026). No migration, no code change. Implementation (P3 Step 4) is prescribed only after sign-off.
**Plan:** v2.4 FP5.1 (#280), guardrail **G4** ("Retailers are data. The registry plus runtime display flags. No retailer-specific branches in display code"), D27 (paise), §9.1 G-RET(n), circuit breaker (FP5.3: two trips set `display_enabled = false`).

## 1. Facts measured today

- **No `stores` table exists.** `store_prices.store_id` and `price_history.store_id` are free `text`: `mybrickhouse` (1,034 current rows, 101,123 history) and `toycra` (850 and 74,381).
- **Store identity is duplicated in ≥ 9 hand-written maps** (see §4). Names, URLs, labels and display order live in code, not data.
- **One SQL object hardcodes store ids:** the `set_price_summary` view (the `mbh`/`toy` CTEs pick the MRP anchor by `store_id = 'mybrickhouse'` / `'toycra'`).
- **The legacy `prices` table is dead** (§3).

## 2. Proposed `stores` table

```sql
CREATE TABLE public.stores (
  id               text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]+$'),  -- 'mybrickhouse', 'toycra', later 'hamleys', 'firstcry', 'jaiman'
  name             text NOT NULL,                  -- display name: 'MyBrickHouse'
  site_url         text NOT NULL,                  -- store home, for "Shop at" links and the store list
  display_enabled  boolean NOT NULL DEFAULT false, -- G4/G-RET: the ONLY switch every consumer filters on; new retailers start OFF
  display_order    smallint NOT NULL DEFAULT 100,  -- stable order in tables and store lists (replaces TRACKED_STORES order)
  affiliate_note   text NULL,                      -- e.g. the ABHINAV12 disclosure text for Toycra; NULL = no affiliate relationship
  mrp_anchor_rank  smallint NULL,                  -- set_price_summary R2: which store's compare_at/list price anchors MRP (1 = first choice); NULL = never an anchor
  price_precision  smallint NOT NULL DEFAULT 0,    -- D27: decimal places shown (FirstCry 2 for paise; others 0)
  scraper_kind     text NOT NULL CHECK (scraper_kind IN ('shopify_json','fynd_html','firstcry_html','manual')),
  scraper_config   jsonb NOT NULL DEFAULT '{}',    -- domain, path/collection handle (Jaiman: 'lego-collection'), pacing, UA contact
  robots_checked_at timestamptz NULL,              -- FP5.10 robots/agents.md snapshot date
  breaker_trips    smallint NOT NULL DEFAULT 0,    -- FP5.3: consecutive trips; 2 means display_enabled=false (runbook)
  disabled_reason  text NULL,                      -- why display is off (breaker, manual kill, G-RET not yet passed)
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read enabled stores" ON public.stores FOR SELECT TO anon USING (display_enabled);
GRANT SELECT ON public.stores TO anon;           -- G8: explicit grants (lint-migration-grants)
GRANT ALL    ON public.stores TO service_role;
-- then: FK store_prices.store_id and price_history.store_id -> stores(id) (NOT VALID first, VALIDATE after backfill)
-- D27: store_prices.price_exact numeric(12,2) NULL alongside price_inr (paise kept exactly; price_inr stays the integer key used today)
```

**What each consumer keys on:**

| Consumer | Needs |
|---|---|
| Snapshot publisher (FP1.1) | `id`, `display_enabled` (a disabled store's rows are excluded from the snapshot), `display_order`, `name` |
| `set_price_summary` / deals / best price / ties (R2–R6) | `display_enabled` (filter `cur` to enabled stores), `mrp_anchor_rank` (replaces the hardcoded `mbh` → `toy` → catalogue order) |
| JSON-LD (`buildAggregateOffer`) | `name` (seller), `display_enabled`, `price_precision` (Offer.price exact) |
| Set/review price tables, store-list copy ("prices from N stores") | `display_enabled`, `display_order`, `name`, `site_url`, `affiliate_note` (G11: honest wording from data) |
| Charts (FP5.7 history) | `id`, `name`, `display_enabled` (a hidden store's history is hidden too) |
| Alerts (price-drop emails, later) | `display_enabled` |
| Scrapers (FP5.2 contract) | `scraper_kind`, `scraper_config`, `breaker_trips`; they write `display_enabled=false` + `disabled_reason` on a second breaker trip |

The kill switch is one row update: `UPDATE stores SET display_enabled=false, disabled_reason='…' WHERE id='…'`, plus the targeted revalidation from FP2.4. No deploy.

## 3. Legacy `prices` table audit

| | |
|---|---|
| Rows | 5,964: Toycra, FirstCry, MyBrickHouse, Hamleys India, 1,491 each |
| `price_inr` | **NULL on all 5,964 rows**, so there is no price data in it at all |
| Last write | `scraped_at` max **2026-05-10 09:28 UTC** (range 25 Apr – 10 May) |
| Size | 2.6 MB |
| Dependents | FK `prices.set_id → sets` (outbound only); **no inbound FKs, no views, no functions** reference it |
| Readers | **One**: `scripts/technical-hygiene.mjs:1343`, an existence check that logs "ADMIN-CLEANUP-01 pending. Safe to drop once confirmed unused" |
| Stale docs | CLAUDE.md "Price data rules" still says `prices` is "used as fallback on /deals". **False since PR-B** (/deals reads `set_price_summary`). Fix with the drop |

**Recommendation: safe to archive and drop**, and it doesn't need to wait for the registry. The steps:
1. Back up with `pg_dump --data-only --table=public.prices`, and verify the COPY count is 5,964.
2. `DROP TABLE public.prices` in a repo migration.
3. Remove hygiene check 13g.
4. Correct CLAUDE.md.

Rollback is a restore from the dump. The FirstCry and Hamleys rows in it contain no prices, so they can't leak anything; the risk the plan names ("old data can't leak") is already nil. I'd propose doing it with FP5.1 anyway, so there's a single change.

## 4. Every current consumer of `store_id` as free text

**SQL:**
- `set_price_summary` view: `WHERE store_id = 'mybrickhouse'` (MRP anchor), `= 'toycra'` (fallback anchor). **Must change** to `mrp_anchor_rank` and `display_enabled`.

**Hardcoded store lists and label maps (replace with a registry read, cached):**
- `scripts/lib/retailer-fetch.mjs:12` `STORES` (id, name, domain, path): scraper config, which moves to `scraper_config`
- `src/app/sets/[slug]/page.tsx` `TRACKED_STORES` (id, name, url) plus `STORE_NAMES`, used for the table, JSON-LD and FAQ
- `src/app/reviews/[slug]/page.tsx:35` `TRACKED_STORES`
- `src/app/lab/price-drops/page.tsx:17`, `lab/deals/page.tsx:20`, `lab/budget-calculator/page.tsx:15`, `lab/retiring-soon/page.tsx:13`, `lab/cmf-tracker/CmfTracker.tsx:6`, `minifig-hq/MinifigHq.tsx:6`: `STORE_LABELS` maps (6 copies)
- `src/app/lab/which-set/page.tsx:146` `STORES`

**Logic that branches on a specific store id (G4 violations to remove or move into data):**
- `src/lib/toycra-availability.ts` (4): Toycra-specific availability, i.e. `affiliate_note` / store-specific rule
- `src/lib/review-disclaimer.ts` (3), `src/lib/review-source-quality.ts` (2), `scripts/lib/reviews-source.mjs` (2), `scripts/reviews-source-refresh.mjs` (2), `scripts/review-verdict-refresh.ts` (2): the retailer-sourced review pipeline, which keys on `mybrickhouse`/`toycra`
- `src/lib/price-summary.ts` (2): label logic
- `scripts/video/engine.py` (2, `store_id="mybrickhouse"` default for price drops), `scripts/video/select_quiet_panic_candidate.py` (4)
- `scripts/check-price-freshness.ts` (2), `scripts/health-check.mjs` (4), `scripts/technical-hygiene.mjs` (10): per-store freshness and health (should iterate over the registry)
- `scripts/populate-article-images.mjs` (2)
- One-off or historical, no change needed: `scripts/audit-mrp-direct-scrape-2026-07-08.mjs`, `scripts/migrations/001_store_prices.sql`, `scripts/ci/jsonld-price-fixtures.mjs` (CI fixtures)

**Data:** `store_prices` (1,884 rows) and `price_history` (175k+) hold only `mybrickhouse`/`toycra`, so an FK backfill needs just 2 registry rows.

## 5. Migration path (for sign-off; Step 4 would implement)

1. Create `stores` with 2 rows (`mybrickhouse` rank 1 anchor, `toycra` rank 2), both `display_enabled=true`. FK from `store_prices`/`price_history` added `NOT VALID`, then `VALIDATE`. Add `price_exact`.
2. `set_price_summary`: filter `cur` by `stores.display_enabled` and replace the two hardcoded CTEs with the lowest `mrp_anchor_rank`. The output must stay identical to today's view for both stores; verified row by row with an `EXCEPT` diff before swapping.
3. Code: one cached `getStores()` (server, 6h, like set pages) replaces the 9 maps; display code iterates over it (G4). The scraper reads `STORES` from the registry.
4. Legacy `prices`: backup, drop, remove hygiene 13g, fix CLAUDE.md.
5. New retailers (Hamleys, FirstCry, Jaiman) are inserted with `display_enabled=false` and turned on only by G-RET(n).

**Risks:** the view change is the one that touches live prices (deals, badges, JSON-LD). Hence step 2's exact-diff gate, and doing it on staging first once D-8 exists.

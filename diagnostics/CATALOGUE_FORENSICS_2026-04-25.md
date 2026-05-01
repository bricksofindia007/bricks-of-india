# Catalogue Forensics — 2026-04-25

## Verdict

The regression was introduced by commit `2cd6cad` (Apr 18): the `/compare` page was converted from a client component that called the Rebrickable-first `/api/sets/search` endpoint to a server component that queries Supabase directly — where the `sets` table has only 756 sparsely-themed rows and zero `lego_mrp_inr` values, making text search near-useless and price filtering completely broken.

---

## Evidence

### Finding 1 — The regression commit is `2cd6cad` (Apr 18)

`git show 2cd6cad` confirms the compare page was "Converted from 'use client' + useEffect to pure server component." The old code called `fetch('/api/sets/search?...')` which used Rebrickable-first for text queries. The new code calls `createServerClient().from('sets').select(...)` — Supabase only.

Before `2cd6cad`: text search → `/api/sets/search` → Rebrickable → results from full 170k+ set catalogue.
After `2cd6cad`: text search → Supabase `sets` table → 756 rows → empty for most queries.

The Rebrickable-first search route (`src/app/api/sets/search/route.ts`) still exists and works correctly, but nothing calls it anymore.

### Finding 2 — Text search returns NOTHING FOUND for most queries

Live test:
```
curl https://bricksofindia.com/compare?q=Technic  → NOTHING FOUND
curl https://bricksofindia.com/compare?q=Star+Wars → NOTHING FOUND (probably)
```

Root cause: the server component queries `name.ilike.%${q}%`. Most Technic sets are named after machines ("Liebherr Crawler Crane", "John Deere 9620R") — "Technic" does not appear in their name. The `theme` field is not searched. Rebrickable's full-text index handles this correctly; Supabase ilike on name only does not.

### Finding 3 — `sets` table: 756 rows, all 2025–2026, one-time sync

```
sets: 756 rows
All rows created_at / updated_at: 2026-04-11 only
Year breakdown: 2026: 386, 2025: 370 — nothing older
```

`scripts/sync-rebrickable.js` fetches Rebrickable with `min_year=2020` and a hard cap of 10 pages × 100 = 1,000 rows. It was run exactly once on April 11. It is NOT scheduled on any GitHub Actions workflow (only `deploy.yml` and `scrape-prices.yml` exist).

Popular sets that should be in the catalogue are missing: Concorde (2023), Eiffel Tower (2022), Millennium Falcon (2017), Hogwarts Castle (2021), etc.

### Finding 4 — Per-theme coverage is too sparse for meaningful filtering

```
Theme          Rows in Supabase   Expected (rough)
-----------    ----------------   ----------------
Star Wars            30               150+
Technic              22               100+
Icons                 8                40+
Architecture          ?                20+
Botanical/s          15                20+
Ninjago              35                80+
```

Top "theme" by row count is "Stationery and Office Supplies" (51 rows) — merchandise, not buildable sets. The 10-page global sync pulled whatever Rebrickable returned for min_year=2020 ordered by `-year`, which skewed toward recent non-set items.

### Finding 5 — `lego_mrp_inr` is NULL for every row — price filter is completely broken

```
has price: 0  (out of 756 rows)
```

The `/compare` price filter applies `gte('lego_mrp_inr', min).lte('lego_mrp_inr', max)`. PostgreSQL treats `NULL >= n` as FALSE. Every filtered price query returns 0 rows. The `sync-rebrickable.js` script does not set `lego_mrp_inr` — that field has no ingest path.

Live confirmation: `/compare?price=Under+₹2,000` → 756 sets (filter silently not applied due to label mismatch), but if it did apply, 0 rows would match.

### Finding 6 — Theme pages show sparse results from the same 756-row table

`src/app/themes/[theme]/page.tsx` queries Supabase directly:
```typescript
supabase.from('sets').ilike('theme', `%${theme.name}%`).limit(200)
```

No Rebrickable call. Returns only what's in the 756-row table. Theme pages showing "4–8 sets" are themes that happened to get a few rows in the one-time sync. Themes showing 0 are themes with no 2025–2026 sets that made it into the 10-page pull.

### Finding 7 — `/api/sets/search` (Rebrickable-first) is live but orphaned

The endpoint works correctly:
```
curl https://bricksofindia.com/api/sets/search?q=Technic
→ {"sets":[{"set_number":"88016","name":"Technic Large Hub",...},...], "total": 1134}
```

Returns Rebrickable results hydrated with Supabase price data. But since `2cd6cad`, no UI component calls this endpoint.

### Finding 8 — `store_prices` scraper is healthy but disconnected

```
store_prices: 492 rows
Last scrape: 2.9h ago — jaiman, toycra, mybrickhouse all current
```

Live price data exists for 492 set/store combinations, but `store_prices.set_id` is a string set_number (e.g., "10318") — not the UUID `sets.id`. The `prices` table (2000 rows) has UUID foreign keys and is what the compare page joins via `prices(*)`. These two pipelines are disconnected (DATA-01 in tracker).

### Finding 9 — `sync-rebrickable.js` not in any GHA workflow

```
.github/workflows/
  deploy.yml
  scrape-prices.yml   ← Shopify scraper only, touches store_prices + price_history
```

No workflow calls `sync-rebrickable.js`. The `sets` table has no ongoing ingest. New 2026 sets are never added.

---

## Confidence

**High.** The regression commit is identified with a specific SHA and confirmed commit message. DB state is confirmed with direct Supabase counts. Live endpoint behaviour is confirmed with curl. The orphaned API route is confirmed by reading both the route file and the component that used to call it.

---

## What I did NOT check

- Whether `REBRICKABLE_API_KEY` in GitHub Actions secrets is valid (one test call kept, used for the API route check above — key appears functional)
- The `prices` table ingest path — who populates 2,000 rows there and why (not relevant to search regression)
- Whether any other page/component still calls `/api/sets/search`
- The full `PRICE_RANGES` label format in `brand.ts` (price filter label mismatch not fully traced)
- Whether the Netlify build cache has stale theme page pre-renders (`generateStaticParams` pre-renders all theme pages at build time — stale data is baked in until next deploy)

---

## Recommended fix scope for CATALOG-FIX-01

**Priority order:**

1. **Re-wire text search to use Rebrickable** (no build required, no schema change, zero db writes)
   - Option A (quick): In `compare/page.tsx`, when `q` is present and no price/theme filter active, call `searchSets(q, page)` from `rebrickable.ts` server-side and hydrate with Supabase prices — mirrors what the old client component did via the API route.
   - Option B (minimal): Add `theme` field to the name-search OR condition: `name.ilike.%q%,set_number.ilike.%q%,theme.ilike.%q%`. Partial fix only — still limited to 756 rows but at least `q=Technic` returns 22 results instead of 0.

2. **Re-populate `sets` table comprehensively** (requires one manual GHA workflow trigger or local run — no build, no deploy)
   - Modify `sync-rebrickable.js` to remove the 10-page cap and remove `min_year` filter, or set it to 2018/2019.
   - Run it once to backfill. Estimate: ~2,000–3,000 rows.
   - Then create a GHA workflow `sync-sets.yml` running weekly.

3. **Populate `lego_mrp_inr`** (data entry / API call — no build)
   - Rebrickable doesn't provide India MRP. Source is lego.com/en-in or manual entry.
   - Until populated, consider removing the price filter from the UI or showing a "prices coming soon" state.

4. **Theme page freshness** (requires a deploy to re-run `generateStaticParams`)
   - Theme pages pre-render at build time. Even after DB backfill, theme pages won't update until next deploy. After the sets table backfill, trigger a deploy.
   - Flag: this DOES consume a build minute.

**Does not require a build:** items 1 (option A only, if done server-side in compare), 2, 3.
**Requires a build:** item 1 option B (compare page change), item 4 (theme page refresh).

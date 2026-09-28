# FP1.1 price snapshot layer + FP2.4 flags: DESIGN (not applied)

**Status:** APPROVED by Abhinav (P5 Step 5, 27 Sep 2026); build as foundation PRs 1 (boi-scheduler) and 2 (publisher + reader + FP2.4 flags), staging first. Designed in P4 Step 3. ADR 0003 records the decisions.
**Plan:** v2.4 §6.2 FP1.1, FP1.5, FP1.6, FP2.4, FP6.1; risks R1, R10, R25, R31, R38; drill D-3.

## 1. Key schema, with measured sizes

**Keys** (one KV namespace, `BOI_SNAPSHOTS`):

| Key | Value | Written |
|---|---|---|
| `set:{set_num}:v1` | `{v, set, scraped_at{store:ts}, offers[{store,price,compare_at,in_stock,url}], anchor{mrp,source}, badge{best,stores[],tier,discount}, history{store:[[day,price,in_stock]]} (≤180 days, ≤60 points per store), checksum}` | Only sets whose summary or offers changed this cycle |
| `list:deals:v1` | Ordered deal rows for /deals (set_id, name, image, best, anchor, tier, discount, stores) plus a checksum | Every cycle (one key) |
| `list:home:v1` | The homepage's top-8 deals, deal count, CMF/sets/news counts | Every cycle (one key) |
| `meta:heartbeat` | `{cycle_id, scrape_finished_at, publisher_finished_at, sets_written, version}` | Every cycle, **last** (so readers never see a heartbeat newer than its data) |

**Measured, 27 Sep, 10 real sets, built from production:** history is reduced to change points (as the FP5.7 trigger now writes it) over 180 days, capped at 60 points per store.

| Set | Bytes | Offers | History points | Tier |
|---|---|---|---|---|
| 42206 | 1,078 | 2 | 14 | hot |
| 42207 | 996 | 2 | 12 | hot |
| 76466 | 974 | 2 | 11 | – |
| 76344 | 969 | 2 | 11 | hot |
| 31218 | 927 | 2 | 10 | hot |
| 71807 | 906 | 2 | 9 | hot |
| 71812 | 903 | 2 | 9 | hot |
| 60497 | 712 | 2 | 2 | – |
| 10967 | 650 | 1 | 8 | hot |
| 10461 | 451 | 1 | 1 | – |

The first five are the most price-volatile sets over 180 days, i.e. the worst case today. At the 60-point cap × 2 stores the ceiling is about **4 KB per set**; with 5 retailers, ~9 KB. That's far under KV's 25 MiB value limit.
- **Today's footprint:** ~1,047 sets in `set_price_summary` × ~1 KB ≈ **1 MB**.
- **All ~26k catalogue sets:** < 30 MB. That's inside the 1 GB of KV storage the plan includes.

## 1a. Amendment A1 (P6 Step 2c, 28 Sep 2026): an unpriced set renders with ZERO Supabase calls

**Why (measured 28 Sep, read-only census, `set-render-census.yml` run 36377555382):**
- In the ~11.9 h after the 16:33 deploy, **14,551 distinct set pages** re-rendered (of 26,080 in the catalogue). **13,713 of them (94.2%) have no retailer offers**; 838 are priced (of 1,162 priced sets).
- `set_page_data` ran ~39.5k times/day overnight (27–28 Sep), ~73% of all API requests.
- **Every deploy starts a new ISR/data-cache prefix** (43 build prefixes in R2), so each deploy re-renders every crawled page from Supabase.
- The original design still called `set_page_data` for catalogue fields on every set page, so it would have kept ~94% of these calls.

**New keys** (same namespace, written by the same publisher through `boi-scheduler`):

| Key | Value | Written |
|---|---|---|
| `list:priced-sets:v1` | `{v, cycle_id, sets: {set_number: {best, stores_enabled}}, checksum}`: every set with ≥ 1 enabled offer and its best price (~1.2k entries, ~25 KB) | Every cycle, before `meta:heartbeat` |
| `cat:{set_num}:v1` | `{v, set, name, image, pieces, minifigs, year, theme, mrp, coverage, related[≤8]{set, name, image}, checksum}`: everything the page shows except offers (~0.8–1.5 KB) | Backfill of all ~26k sets once (≈ 26k writes, one-off), then only sets whose catalogue row changed (`sets.updated_at` > last run) |

**Reader rule (set pages):**
1. Read `meta:heartbeat` (cached for the render) and `list:priced-sets:v1` (cached ≤ 60 s per isolate).
2. **Fresh heartbeat** (publisher finished ≤ 12 h ago), **set absent from `list:priced-sets`**, and a valid `cat:{n}` → render the "no Indian retailer lists this set" state with **no Supabase call**. Related cards take their price, if any, from `list:priced-sets`.
3. Set **in** `list:priced-sets` → `cat:{n}` plus `set:{n}` (both KV). Prices older than 12 h show their age and drop badges (PRICE_STALE_HOURS, G14).
4. **Any** of these → today's `set_page_data` path, logged as `snapshot_fallback{reason}`:
   - heartbeat stale (so pricedness is unknown);
   - `list:priced-sets` or `cat:{n}` missing or bad checksum;
   - version mismatch.

   Absence from the list is only trusted while the heartbeat is fresh: a stale list could hide a set that just gained an offer.

**Effect:**
- Unpriced renders (~94% of set renders) stop touching Supabase, **including right after a deploy**. KV isn't per-build, unlike the ISR and data caches.
- At last night's rate that removes ~37k calls/day, ≈ 100 MB/day of egress.
- KV reads: ~2 per render (list cached per isolate, plus `cat`, plus `set` when priced) ≈ 80k/day ≈ 2.4M/month, inside the 10M included.
- Writes: the one-off 26k backfill, then tens per cycle.

**Parity (§4) is extended:**
- 50 random `cat:{n}` entries per cycle are compared field by field with `set_page_data`.
- `list:priced-sets` must equal the set of `set_price_summary` rows with an enabled offer, exactly.

**PR 2 builds A1.** The parity clock covers the new keys too.

## 2. Write path: recommendation (1)

| | (1) Publisher → small Worker endpoint with a KV **binding**, HMAC-signed | (2) GitHub job writes KV with a Cloudflare API token |
|---|---|---|
| Blast radius of a leaked secret | HMAC key: can only write the **one** namespace bound to that Worker, and only in the endpoint's validated shapes | **Cloudflare docs: KV permissions ("Workers KV Storage Edit") are account-scoped; there is no per-namespace scoping.** A leaked token can write **every** KV namespace in the account |
| Validation | The endpoint rejects bad version/checksum/shape before writing | None beyond the API |
| Ordering (heartbeat last) | Enforced server-side | Client discipline only |
| Rate | Batches of ≤ 1,000 ops per invocation (KV limit) | Bulk API |
| New secrets | `SNAPSHOT_HMAC_KEY` (GitHub + Worker secret) | `CF_KV_TOKEN` (GitHub) |

**Recommend (1).** Option (2) contradicts FP1.1's own requirement ("the token only allows writing to this one namespace"), because Cloudflare can't scope a token to one namespace.
- **Request format:** `POST /publish` with header `X-BOI-Sig: hex(HMAC-SHA256(key, timestamp + "." + sha256(body)))` and `X-BOI-Ts`. It's rejected if the timestamp is older than 5 minutes (replay) or the signature doesn't match. The body carries up to 500 keys per call.
- **Budget:** each call is one Worker request. See §7.

## 3. Reader chain

1. **KV:** get `meta:heartbeat` (cached for the render) plus `set:{n}:v1` / `list:*:v1`.
2. **Validate:** `v` equals the reader's version; the checksum recomputes; freshness means the snapshot's `publisher_finished_at` is ≥ the scrape heartbeat's `scrape_finished_at` for that cycle, **and** the data is ≤ 12h old (PRICE_STALE_HOURS). A stale heartbeat (no scrape in 13h) doesn't invalidate data that's otherwise good; the page shows its real age (G14).
3. **Fallback:** if anything fails, use today's Supabase path (the `set_page_data` RPC / `set_price_summary`), and log `snapshot_fallback{reason}`.
4. **If Supabase also fails:** serve the cached ISR page with its real "Updated X ago" (client-computed age already exists).

**Routes that switch (flag `snapshot_read`):**
- `/sets/[slug]`: offers, anchor, badge, tie list, history, JSON-LD, **and (Amendment A1) the catalogue fields from `cat:{n}:v1`**, so an unpriced set with a fresh heartbeat renders with no Supabase call at all (§1a).
- `/deals` (`list:deals:v1`).
- The homepage deal list, deal count and stat counts (`list:home:v1`).

**Routes that stay on Supabase for now (FP1.5 decides after measuring cold renders):** `/reviews/*`, `/news/*`, `/guides/*`, `/sets` listing, `/themes/*`, `/compare`, the `/lab/*` tools, `/minifig-hq`.

## 4. Parity job

- **When:** every scrape cycle, after publishing. It's part of the publisher run: no extra schedule, and it's non-essential, so it sits behind the FP6.4 gate.
- **What:** 50 random sets plus every set that changed this cycle. For each, read the KV snapshot and the live `set_price_summary` + `store_prices` row set, and compare **field by field**:
  - offers: set of `(store, price, in_stock)`
  - anchor `mrp` and `source`
  - badge `best`, `stores[]` (the tie list, as a sorted array) and `tier`
  - `discount` to 0.1
  - per-store `scraped_at` ages: the same timestamp to the second
- **Mismatch:** any field different, a missing key, or a checksum failure. Order-only differences in the tie list are normalised, not mismatches.
- **Recorded in:** a new table `snapshot_parity_runs(cycle_id, checked, mismatches, sample jsonb, created_at)` (additive, Tier 2 migration when built), plus the Actions job summary. Mismatch > 0 alerts through the existing sender.
- **Cutover gate:** 100% parity over ≥ 12 consecutive cycles, spanning ≥ 3 days and ≥ 1 deploy, is required before `snapshot_read` goes on.

## 5. FP2.4 flags

- **Build-time:** `src/lib/flags.ts` (UI features, reviewed diffs).
- **Runtime (KV key `flags:v1`, a single JSON value, cached 60 s in the Worker):**

| Flag | Meaning | Safe default if KV unreachable |
|---|---|---|
| `snapshot_read` | Pages read snapshots first | **false** (today's Supabase path) |
| `alerts_enabled` | Price-alert sending (FP4) | **false** (never send on an unknown state) |
| `email_stream:{transactional,alerts,newsletter,ops}` | Per-stream kill switch at the gateway | `transactional` **true** (sign-in must work); `alerts`/`newsletter` **false**; `ops` **true** |
| `retailer:{id}:display` | *Mirror only* (see below) | Use the last snapshot's store list; never show a store the DB has disabled |

**Reconciling `stores.display_enabled`:** the DB is the source of truth (FP5.1, the breaker writes it).
- The publisher mirrors it into every snapshot: `offers` only include enabled stores, and `list:*` carry `stores_enabled[]`. So the reader never needs a separate `retailer:*` KV flag.
- A display change triggers an immediate publish of the affected sets plus a targeted revalidation (FP1.6).
- A standalone `retailer:{id}:display` KV flag is **not** created. The mirror inside the snapshots avoids two sources of truth disagreeing.

## 6. `boi-scheduler` Worker: recommend a separate small Worker

It would host the publisher endpoint (§2), the FP6.1 sentinel/heartbeat check, and the FP5.9 cron dispatcher (P4 Step 7).
- **Isolation:** the site Worker stays read-only against KV. The write binding and HMAC key live only in `boi-scheduler`. A site deploy can't break publishing, and publishing can't break the site.
- **CPU:** scheduled and publish work doesn't count against the site Worker's per-request CPU (the $0.12 overage context).
- **Cost:** Workers Paid already covers multiple Workers; cron triggers are included.
- **Deploy:** its own `wrangler.jsonc`, deployed only on change (rare), outside the site deploy train.

## 7. G2 budget (from measured numbers)

**Measured today** (Stage 0 edge logs, 24h to 27 Sep 07:44 UTC):
- 36,450 Supabase requests/day. The Worker (page renders) accounts for 20,379.
- In the quiet hours: `rpc/set_page_data` was 69% of Worker calls (4,751 per 12h ≈ **9.5k/day**), `set_price_summary` 218 per 12h (≈ 440/day), `store_prices` 321 per 12h (≈ 640/day).
- Egress ≈ 2,770 B/request (Check 11b calibration).

| Item | Per day | Per month | Included (Workers Paid) |
|---|---|---|---|
| KV writes | changed sets ~10–25 per cycle × 4 + lists 2×4 + heartbeat 4 ≈ **60–110** | ~2–3.5k | 1M |
| KV reads | set renders ~9.5k × 2 (heartbeat + set) + /deals and home ~1k × 2 ≈ **~21k** | ~630k | 10M |
| Worker requests (publisher + parity) | ~8–12 | ~300 | covered |
| Supabase requests **removed** | ~9.5k set_page_data price part (the catalogue part stays until FP1.5: see note) + ~1.1k summary/store_prices ≈ **~10.6k** | ~320k | – |
| Supabase egress **removed** | ~10.6k × 2,770 B ≈ **29 MB/day** | ≈ **0.9 GB/month** | – |

Note: `set_page_data` returns catalogue **and** price data in one RPC today (Fix A). Removing Supabase from set renders entirely needs the catalogue part too: either the snapshot carries name, image and coverage (≈ +300 B per set), or FP1.5 decides. **Recommendation:** include the minimal catalogue fields in `set:{n}:v1` so a set render makes **zero** Supabase calls. The removal figure above assumes that. Without it, set renders keep ~9.5k requests/day, and the saving drops to ~1.1k requests/day.

The publisher's own Supabase reads: one batched call for changed sets plus the parity sample, about 8 calls/day.

## 8. Staging side (FP2.2: order matters)

The staging Supabase project now exists in its own organisation (Abhinav, 27 Sep). The Cloudflare side mirrors it, with no production credentials anywhere in staging:
1. **Staging DB first** (P4 Step 9 / D-8): built only from the #375 baseline, seeded with catalogue + prices, and parity-checked (0 schema diff). Nothing below is useful before that.
2. **KV namespace `boi-snapshots-staging`**: a separate namespace, never bound to the production site Worker.
3. **`boi-scheduler-staging` Worker**: same code as `boi-scheduler`, bound to `boi-snapshots-staging`; its `SNAPSHOT_HMAC_KEY` differs from production's. It publishes from the **staging** DB, and its crons are **disabled** except when a drill (D-3, parity) runs.
4. **Staging site Worker (`boi-site-staging`)**: the same build as production, deployed with the staging Supabase URL/keys and bound read-only to `boi-snapshots-staging`, on a `*.workers.dev` route or `staging.bricksofindia.com`.
5. **Cloudflare Access** in front of the staging site and `boi-scheduler-staging`'s publish route: one Access application, email one-time-PIN, allow-list Abhinav's address only. Plus `X-Robots-Tag: noindex` on every staging response, so staging never gets indexed or shared.
6. **Only then** the D-3 drill (corrupt a staging snapshot → the fallback serves the Supabase path) and the ≥ 12-cycle parity run on staging before production parity starts.

## 9. What Abhinav creates in Cloudflare
1. **KV namespaces:** `boi-snapshots` (production) and `boi-snapshots-staging`.
2. **Cloudflare Access:** one application ("BOI staging") covering the staging site hostname and the staging scheduler's routes, with an email OTP allow-list (Abhinav only).
3. **Nothing token-wise** (option 1): no new Cloudflare API token. The existing deploy token (`CLOUDFLARE_API_TOKEN`, GitHub secret) deploys `boi-scheduler` too.
4. **Secrets, set by the terminal once the namespaces exist:** `SNAPSHOT_HMAC_KEY` (random 32 bytes) as a Worker secret on `boi-scheduler` **and** a GitHub secret. For P4 Step 7: **`GH_DISPATCH_TOKEN` is set by Abhinav, on the production `boi-scheduler` Worker only, under exactly that name** (`wrangler secret put GH_DISPATCH_TOKEN --name boi-scheduler`, or Dashboard → Workers → boi-scheduler → Settings → Variables and Secrets → Add → type *Secret*). It is **not** set on the site Worker or on `boi-scheduler-staging` (staging dispatches nothing to production workflows).
5. **Bindings (in repo config, no dashboard work):**
   - site Worker: `BOI_SNAPSHOTS` (read);
   - `boi-scheduler`: `BOI_SNAPSHOTS` (read/write) plus cron triggers.

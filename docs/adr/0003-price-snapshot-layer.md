# ADR 0003: Price snapshot layer in Workers KV

**Status:** Accepted, 27 Sep 2026 (approved by Abhinav, Prescription P5 Step 5). Proposed the same day (FP1.1 / FP2.4, P4 Step 3). Cutover (`snapshot_read` ON) is a separate Tier 2 decision after the parity clock. Detail: `docs/plans/FP1.1_snapshot_design.md`.

## Context
Page renders are the biggest Supabase caller: ~20k of 36k requests/day, and `rpc/set_page_data` alone is ~9.5k/day. Egress is projected at ~3.85 GB of the 5 GB Free-plan quota, the grace period is used up (R1), and the 8–11 Oct sale lands in the last 4 days of the cycle (R38).

## Decision
1. After each scrape cycle, a publisher writes **one KV key per changed set** (`set:{n}:v1`: offers, anchor, badge, tie list, change-point history ≤180 days/60 points, minimal catalogue fields, checksum), plus `list:deals:v1`, `list:home:v1`, and `meta:heartbeat` **last**. Measured size: 0.45–1.1 KB per set today, ≤ ~4 KB at the history cap.
2. **Writes go through a separate `boi-scheduler` Worker** with a KV binding and HMAC-signed requests. It doesn't use a Cloudflare API token: Cloudflare's KV permissions are account-scoped, with no per-namespace scoping, so a token can't be limited to this namespace.
3. **The reader** validates version, checksum and freshness against the heartbeat, falls back to the Supabase RPC, then to the cached page with its real age (G14). Set pages, /deals and the homepage lists switch; reviews and articles stay on Supabase (FP1.5).
4. **Parity** runs every cycle on 50 sets plus all changed sets, field by field. Cutover (`snapshot_read`, Tier 2) needs 100% parity over ≥12 cycles, ≥3 days and ≥1 deploy.
6. **Amendment A1 (P6 Step 2c, 28 Sep 2026):** the publisher also writes `list:priced-sets:v1` (every set with an enabled offer, and its best price) and `cat:{n}:v1` (catalogue fields for **all** ~26k sets: a one-off backfill, then only changed rows).
   - A set page whose set is **absent** from `list:priced-sets` while the heartbeat is fresh renders from `cat:{n}` with **zero Supabase calls**.
   - A stale heartbeat, or a missing or invalid list or catalogue key, falls back to `set_page_data`.
   - Why: the 28 Sep census found 94.2% of set renders are unpriced sets in a long-tail crawl, and every deploy empties the per-build ISR and data caches.
5. **Flags:** a runtime `flags:v1` KV key with safe defaults (`snapshot_read` false, `alerts_enabled` false). `stores.display_enabled` stays the source of truth and is mirrored into the snapshots, not duplicated as a KV flag.

## Consequences
- **A1:** removes the unpriced ~94% of `set_page_data` calls (~37k/day at the 27–28 Sep rate, ≈ 100 MB/day), deploys included. It costs a one-off ~26k KV writes plus ~80k KV reads/day.
- **Saved:** ~10.6k Supabase requests/day and ~0.9 GB of egress a month, if the snapshot carries the minimal catalogue fields (otherwise ~1.1k/day).
- **Cost:** ~60–110 KV writes/day and ~21k reads/day, well inside Workers Paid's included 1M writes and 10M reads a month.
- **New moving parts:** a second Worker, one KV namespace, one HMAC secret, and a parity table.
- **Risk R31** (stale or wrong snapshot) is contained by the validation-and-fallback chain, parity, and drill D-3.

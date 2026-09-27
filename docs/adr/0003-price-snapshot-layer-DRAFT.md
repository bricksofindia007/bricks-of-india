# ADR 0003 (DRAFT): Price snapshot layer in Workers KV

**Status:** Proposed, 27 Sep 2026 (FP1.1 / FP2.4, P4 Step 3). Awaiting chat sign-off; nothing built. Detail: `docs/plans/FP1.1_snapshot_design.md`.

## Context
Page renders are the biggest Supabase caller: ~20k of 36k requests/day, and `rpc/set_page_data` alone is ~9.5k/day. Egress is projected at ~3.85 GB of the 5 GB Free-plan quota, the grace period is used up (R1), and the 8–11 Oct sale lands in the last 4 days of the cycle (R38).

## Decision (proposed)
1. After each scrape cycle, a publisher writes **one KV key per changed set** (`set:{n}:v1`: offers, anchor, badge, tie list, change-point history ≤180 days/60 points, minimal catalogue fields, checksum), plus `list:deals:v1`, `list:home:v1`, and `meta:heartbeat` **last**. Measured size: 0.45–1.1 KB per set today, ≤ ~4 KB at the history cap.
2. **Writes go through a separate `boi-scheduler` Worker** with a KV binding and HMAC-signed requests. It doesn't use a Cloudflare API token: Cloudflare's KV permissions are account-scoped, with no per-namespace scoping, so a token can't be limited to this namespace.
3. **The reader** validates version, checksum and freshness against the heartbeat, falls back to the Supabase RPC, then to the cached page with its real age (G14). Set pages, /deals and the homepage lists switch; reviews and articles stay on Supabase (FP1.5).
4. **Parity** runs every cycle on 50 sets plus all changed sets, field by field. Cutover (`snapshot_read`, Tier 2) needs 100% parity over ≥12 cycles, ≥3 days and ≥1 deploy.
5. **Flags:** a runtime `flags:v1` KV key with safe defaults (`snapshot_read` false, `alerts_enabled` false). `stores.display_enabled` stays the source of truth and is mirrored into the snapshots, not duplicated as a KV flag.

## Consequences
- **Saved:** ~10.6k Supabase requests/day and ~0.9 GB of egress a month, if the snapshot carries the minimal catalogue fields (otherwise ~1.1k/day).
- **Cost:** ~60–110 KV writes/day and ~21k reads/day, well inside Workers Paid's included 1M writes and 10M reads a month.
- **New moving parts:** a second Worker, one KV namespace, one HMAC secret, and a parity table.
- **Risk R31** (stale or wrong snapshot) is contained by the validation-and-fallback chain, parity, and drill D-3.

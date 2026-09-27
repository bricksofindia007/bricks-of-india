# FP5.9: Cron Trigger dispatcher (DESIGN; build only after GH_DISPATCH_TOKEN is set and a foundation PR slot is free)

**Status:** APPROVED by Abhinav (P5 Step 5, 27 Sep 2026); built in foundation PR 1 with `boi-scheduler`, inert until Abhinav confirms `GH_DISPATCH_TOKEN` is set. Designed in P4 Step 7.

## Problem, measured
`scrape-prices.yml` runs on GitHub's scheduler (`0 */6 * * *`). The last 11 scheduled runs (24–27 Sep) started **2h43 to 5h33 late** (median **~3h55**): slot → start = 21:13, 03:50, 11:19, 16:44, 21:11, 03:55, 10:56, 15:56, 20:43, 04:06, 11:33 UTC. One of today's slots (12:00) hadn't started by 16:25 UTC. Prices go stale, and the 12h freshness rule (PR-A) hides badges when two slots slip.

## Design
- **Where:** the `boi-scheduler` Worker proposed in FP1.1 (ADR 0003 draft). The site Worker stays untouched.
- **Trigger:** Cloudflare Cron Triggers (`crons` in `boi-scheduler`'s `wrangler.jsonc`). One cron per retailer, offset so they don't pile up:
  - `mybrickhouse` at `0 */6 * * *`
  - `toycra` at `5 */6 * * *`
  - later: `hamleys` `10 */6`, `firstcry` `15 */6`, `jaiman` `20 */6`
- **Action:** `POST https://api.github.com/repos/bricksofindia007/bricks-of-india/actions/workflows/scrape-prices.yml/dispatches` with `{"ref":"main","inputs":{"store":"<id>"}}`, using the `GH_DISPATCH_TOKEN` Worker secret (a fine-grained PAT: *Actions: write* on this repo only).
  - `scrape-prices.yml` gains a `store` input so each dispatch scrapes one retailer (per-retailer failure isolation, FP5 contract).
  - The GitHub `schedule:` stays as a **backstop**. The workflow skips if a successful run for the same store started < 2h ago, which keeps it idempotent (G10).
- **Retries:** a non-2xx dispatch is retried twice (after 30s and 90s). If it still fails, the Worker writes a `meta:dispatch_fail` KV note, which the FP6.1 sentinel picks up and alerts on through the existing sender (FP4 later).
- **Registry-driven:** the retailer list is read from `stores` (enabled scrapers only) via the publisher's cached copy in KV, so adding a retailer needs no Worker redeploy. Initially it's the static list above.
- **Heartbeat (G13):** each dispatch writes `meta:dispatch:{store}` = `{slot, dispatched_at, http_status}`; each scrape run writes its own finish time. That gives lag per dispatch without GitHub API reads.

## Measurement (acceptance)
- **Lag** = scrape run `run_started_at` − the cron slot, over **≥ 12 dispatches** (3 days × 4 slots) for each retailer.
- **Pass:** median < 10 min, max < 30 min, and 0 missed slots. It's reported in the tracker, with the baseline above (median ~3h55) side by side.
- Collected by one read-only query of `gh run list` per retailer (no Supabase).

## Budget (G2)
- Worker cron invocations: 4 per retailer per day (2 retailers → 8/day, 5 → 20/day). Covered by Workers Paid.
- GitHub API: 8–20 dispatches/day, far below the PAT's rate limit.
- Supabase: no change (the scrape itself is unchanged).

## Exactly where the token goes
- **Worker:** `boi-scheduler` (production). It doesn't exist until the FP1.1 design is signed off and its first deploy lands; create it before setting the secret.
- **Secret name:** `GH_DISPATCH_TOKEN` (Worker secret, type *Secret*, not a plain variable).
- **How:** `npx wrangler secret put GH_DISPATCH_TOKEN --name boi-scheduler`, or Dashboard → Workers & Pages → `boi-scheduler` → Settings → Variables and Secrets → Add.
- **Not** on the site Worker, **not** on `boi-scheduler-staging`, and not needed as a GitHub secret (the Worker is the only dispatcher).
- **Confirm by** telling the terminal "GH_DISPATCH_TOKEN set on boi-scheduler". The terminal verifies with `wrangler secret list --name boi-scheduler` (names only).

## Needs from Abhinav before the build
1. `GH_DISPATCH_TOKEN`: already created (27 Sep). Set it on `boi-scheduler` as above once that Worker exists, then confirm.
2. The FP1.1 sign-off on `boi-scheduler` (shared Worker).
3. A free foundation PR slot (after FP6.4 #395 or the Step 4 contract PR merges).

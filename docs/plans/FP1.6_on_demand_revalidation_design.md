# FP1.6 on-demand revalidation + R2 build pruning + unpriced TTL: DESIGN (P7 items 6–7)

**Status:** for sign-off (28 Sep 2026). Nothing built. FP1.6 moved up by Abhinav (P7 item 6). The unpriced-TTL lever is approved in principle (P7 item 7); the TTL value is proposed here.

## 0. Measured facts this rests on (28 Sep)
- **R2 cache keys:** `incremental-cache/<OPEN_NEXT_BUILD_ID>/<sha256(key)>.<cache|fetch>`. That's both the page (ISR) and data (fetch) caches, **per build**. 43 build prefixes, 19.5 GB, 657k objects (#242).
- **Renders:** 14,551 distinct set pages in ~12 h after a deploy, **94% unpriced** (census run 36377555382). Set-page Supabase calls ~39.5k/day; R2 `PutObject` ~46.8k/day, i.e. ~1.40M Class A projected per 30 days, against 1M free.
- **Deploys:** 39 in 17–28 Sep (~3.5/day); **the rule from 28 Sep is ≤ 1 site deploy/day, batched.** Every deploy starts an empty cache prefix.
- **New first listings:** **~1.1 sets/day** (16 in 14 days, `price_history` first rows), which bounds how many unpriced pages can be out of date.

## 1. R2: delete non-current builds, not an age rule (P7 item 6)
Old builds are dead weight as soon as the next build serves traffic. An age rule on the whole prefix would also delete the live build's entries and undercut the unpriced TTL (§2). So:
- **Post-deploy step** in `deploy-cloudflare.yml`, after `wrangler deploy` and the smoke test succeed:
  1. list the top-level `incremental-cache/<build>/` prefixes and date each one by its newest object;
  2. **keep the live build (the one just deployed) plus the previous one** (for rollback);
  3. rewrite the bucket's lifecycle rules as follows:
     - the default multipart-abort rule;
     - **a backstop** `incremental-cache/`, delete at **30 days** (unchanged; longer than any TTL below);
     - **one rule per old build**, `incremental-cache/<id>/` → delete at **age 1 day**.

  R2 applies lifecycle deletions itself, so no per-object API calls or Class A operations are needed.
- The token needs R2 bucket-settings write. It can read the lifecycle today; write is unverified until the first run, and that first run is a `--dry-run` that prints the rules without PUTting them.
- **Expected:** storage drops from 19.5 GB to ~2 builds ≈ **1–4 GB** within ~1 day of the first run, under the 10 GB free allowance, and stays there.
- **What Abhinav sets in the dashboard: nothing.** Keep `incremental-cache-30d` exactly as it is; it's the backstop and is longer than every TTL here. After the first real run, check **R2 → `bricksofindia-next-cache` → Settings → Object lifecycle rules**: it should show `incremental-cache-30d`, the multipart rule, and one `prune-<buildId>` rule per old build.

## 2. Unpriced set TTL (P7 item 7): **72 h, APPROVED by Abhinav (P8 item 4)**
**Mechanism:**
- The route segment's revalidate becomes **72 h**, and the `set_page_data` read is cached 72 h.
- If the result has any store row (**priced set**), the page makes a second, small read of the set's offers with a **6 h** data-cache life. It uses a distinct cache key, so the two entries never mix. Next uses the lowest `revalidate` in a render, so a priced page still regenerates every **6 h** and an unpriced page every **72 h**.
- Price staleness is unchanged: prices older than 12 h show their age and drop badges (G14).

**Wording (approved):** every store without a row reads **"No listing found at {store} as of {time}"** (time = the render's data time, IST), replacing today's "Not available at {store}", which implies the set can't be bought. A set with no rows at all reads "No retailer listing found as of {time}". Never "unavailable".

**Numbers** (unpriced ≈ 94% of ~39.5k/day set calls ≈ 37k/day; the crawl revisits a page ~1.4×/day):

| | now (6 h) | 72 h, normal days (≤ 1 deploy/day) | 72 h, deploy freeze 5–11 Oct |
|---|---|---|---|
| unpriced renders per page per day | ~1.4 | ~1.0 (a deploy empties the cache daily) | ~0.33 |
| Supabase calls/day saved | — | **~11k** (≈ 30 MB/day) | **~28k** (≈ 75 MB/day) |
| over the freeze (7 days) | — | — | **≈ 0.5 GB egress, ≈ 200k Class A** |

- **Cost of being stale:** with ~1.1 new listings a day, at most ~3–4 sets at a time can show "No retailer listing found as of {time}" while a listing exists, each for ≤ 72 h. FP1.6 (§3) removes even that by revalidating a set when it gains a listing.
- 24 h would save little (renders ~1.0/day already), and 7 days roughly doubles the stale window for little extra during normal weeks. **72 h is the knee.**

## 3. FP1.6 on-demand revalidation
- **Trigger:** the snapshot publisher (PR 2) already knows, every cycle, which sets changed (offers, prices, stock, and **priced ↔ unpriced transitions**).
- **First listing → immediate revalidation (P8 item 4):** when a set gains its **first** listing (it enters `list:priced-sets`, i.e. unpriced → priced), the publisher revalidates that set's page **in the same cycle**, before anything else in the batch. This takes the "No listing found at {store} as of {time}" staleness to **zero** once FP1.6 lands. The same applies in reverse: when a set's last listing disappears, its page is revalidated so it stops showing a price. Until FP1.6 lands, the worst case is the 72 h window, about 3–4 sets at a time at ~1.1 new listings/day. After writing KV, it calls a signed site endpoint `POST /api/revalidate` (the same HMAC scheme as `boi-scheduler`, with its own key `SITE_REVALIDATE_HMAC_KEY`) with ≤ 100 paths per call.
- **Endpoint:** it verifies the signature, a 5-minute window and nonce reuse. It calls `revalidatePath('/sets/<slug>')`, and `revalidateTag('set:<n>')` so the set's data-cache entries are dropped too, and the "as of" time can't go stale behind a fresh page. It returns 401 on any failure and does nothing. OpenNext's DO queue and tag cache (already configured) do the rest.
- **Then the time-based fallbacks lengthen:** priced 6 h → **24 h** (a changed price revalidates within the cycle); unpriced 72 h → **7 days**.
- **Expected:** renders ≈ changed sets per cycle (~10–25 × 4) + first renders per deploy + crawl hits past the TTL. Class A falls from ~47k/day toward ~15–20k/day.
- **Gate:** B7 (on-demand revalidation actually works on Workers) is re-verified on the staging Worker first, as the plan requires.
- **Failure behaviour (G14):** if the endpoint fails, pages just wait for their time-based TTL. The stale window is labelled "as of {time}". It's never wrong, only older.

## 4. Sequencing to meet the 5–11 Oct deploy freeze (P7 item 7)
**Rules:** ≤ 1 site deploy/day; the snapshot reader (flag OFF) must be **deployed before 5 Oct**; cutover is a **KV flag flip** (`flags:v1.snapshot_read`), never a deploy. `boi-scheduler` is its own Worker, so its deploys don't count against the site freeze.

| Day | Work | Site deploy? |
|---|---|---|
| 29 Sep | PR 1 build: `boi-scheduler` + signed write endpoint + heartbeat + FP5.9 dispatcher (inert). Deploys once Abhinav's Cloudflare items (#263) exist | no (separate Worker) |
| 30 Sep–1 Oct | PR 2: publisher (after each scrape), parity job, **reader behind `snapshot_read` (default OFF, read from KV at runtime)**, FP2.4 flags, A1 (`list:priced-sets`, `cat:{n}`), **§2 unpriced TTL + wording**, `/api/revalidate` (FP1.6 endpoint, but the publisher doesn't call it yet) | — |
| **2 Oct** | **one batched site deploy**: PR 2 site parts, TTL, wording. Parity mode starts: KV written, no page reads it | **yes (1)** |
| 2–5 Oct | parity clock: 100% over ≥ 12 cycles (≥ 3 days) **including the 2 Oct deploy** | spare days 3–4 Oct, for fixes only |
| 5–11 Oct | **freeze**. If parity is 12/12: the cutover (Tier 2) is a KV write of `snapshot_read=true` through the signed endpoint. Rollback is the same flip back. FP1.6's publisher calls can be enabled by the same flag mechanism (`revalidate_calls`) | **no** |

If PR 2 slips past 4 Oct, the reader waits for 12 Oct. Nothing ships inside the freeze.

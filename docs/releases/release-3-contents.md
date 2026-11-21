# Release 3: contents, staging checks and rollbacks

**Status: NOT READY.** Release 3 is marked ready only when items 3 to 5 pass on staging. Item 5 has no staging check yet, and item 4's saved-heart link has not been seen in a browser. Last updated 21 Nov 2026, order 1944.

## Items

| # | Item | Commit or PR | Staging check and result | Rollback |
|---|------|--------------|--------------------------|----------|
| 1 | Noindex proof for set pages | No code change. Read-only. | Stopped the staging sweep at 602 rows (it was rate limited, so partial). The result is from code: `src/lib/indexing-price.ts` line 18 and `src/app/sitemap.ts` lines 38 to 49 use the same "store price above zero" test. Production has 1,206 priced sets (chat SQL). Result: 0 priced pages hidden. | None needed. |
| 3 | Edge cache key includes the deploy version (stale pages after deploy) | `f272033b` on release-3 | Deploy #1 (run 44880209473) and deploy #2 (run 44880469626) both succeeded. `/sets/42172` was cached after deploy #1 (second GET `hit`). After deploy #2 the same URL returned `miss`, 200, and all 14 referenced chunks returned 200. Unit tests: `tests/edge-cache.test.ts`, 40 pass. | Revert `f272033b` and redeploy. Pages stored under the new key expire on their own TTL. |
| 4 | Guest wishlist page on, with a "My Wishlist" link beside a saved heart | `fb6e013b` on release-3 | `/wishlist` returns 200 with `noindex, nofollow`. `/api/guest-wishlist` returns 200 for one and three set numbers. **Not verified:** the link appears after a heart is saved (needs a browser session). Robots: release-3's `public/robots.txt` disallows `/wishlist/` in the generic group. Staging serves its own `Disallow: /`, so that rule cannot be checked on staging. | Set `guestWishlistPage` to `false` in `src/lib/feature-flags.ts` and `config/feature_flags.py`. `/wishlist` returns 404 and the link is hidden. |
| 5 | Owner email when a Quiet Panic row becomes publish_blocked, any reason, once per row | `aef470c3` on PR 993 (`feat/blocked-video-recheck`), with the `alert_state` migration copied from release 3 | **Not run on staging.** 8 new unit tests pass. Writers wired: publish hard guard, generate insert (also covers rework), and the coherence rejudge. Key: `alert_state` `qp-blocked:<row id>`. | Revert `aef470c3` on PR 993. Rows left in `alert_state` are harmless. |
| - | `alert_state` table (egress alert and item 5) | Migration `20261121120000_alert_state.sql` | Staging probe (boi-ops `data-fix-staging-probe`, rolled back): table exists, RLS on, grants only to `service_role`. | Drop the table in a follow-up migration. |

## Data fix run order

Run in this order, each with its own rollback file:

1. `563` (six files in `supabase/data-fixes/`: guides-wording, news-investment-wording, news-wording, review-text-fixes-2026-11-08, reviews-link-wording, reviews-price-line)
2. `911` (marker B, reviews source retailer null)
3. `798` (review price pointer, seven pages; staging before/after checks passed in the order 1942 rehearsal)
4. `142` (newsletter dismiss, six pending)

Rollback files for 563, 911 and 142 have not been checked in this doc.

## Other notes

- Worktrees under `C:\BOI\20-worktrees` were cleaned to three (`release-3`, `blocked-rechk`, `boi-ops-t2`). Free space on C: went from 9.14 GB to 11.05 GB.
- The guest-wishlist staging-only branch `staging/guest-wishlist-on` was deleted; its change is now on release-3.
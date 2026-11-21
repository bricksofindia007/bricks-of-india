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
## Order 1946 T2 run log

All times are IST (UTC + 5:30).

- **Step 1, merge: done.** PR 994 (release-3) was marked ready and squash-merged to main at 13:19:48 IST on 21 Nov. Merge commit `caf040ff`. Required checks had all passed (grants, parity, secret-scan, email-guard, snapshot tests, g19-public-text). No deploy started: only email-guard and the inert Netlify job ran on the merge.
- **Step 2, migration: STOPPED, failed at plan.** `db-migrate` mode=plan, scope=all, run 44882091701 (https://github.com/bricksofindia007/bricks-of-india/actions/runs/44882091701), 13:20 IST. Staging: 45 repo migrations, 44 applied; 62 repo data fixes, 60 applied. Pending migration: `20261121120000_alert_state.sql` only. Lint failed: `missing or invalid "-- boi:issue <number>" header`. The run stopped before any write. Production job was skipped. Nothing was applied to staging or production. Steps 2 to 8 are not started.
- Plan run also listed these data fixes as held (not in the fixes input): 142, 143, 563, 798, 910, 911. Fix 910 is not in the order's list and was not named in any run.
- Blocker: the migration file needs a `-- boi:issue <n>` header. The issue number is not in the order. Fixing it means a change to main, which needs chat's OK. No rollback was done.

- **PR 995 (migration header), merged 888b7c12.** Chat decision (order 1946 CONTINUE 2): the parity check failure on PR 995 is understood and accepted for this PR only. It is not in main's required status checks (snapshot-tests, verify-no-email-in-client-bundle, g19-public-text, pr-text-attribution). The check flags `20261121120000_alert_state` as on main but not yet applied to production. It clears when step 2 applies the migration.
- **PR 996 (remove fix 910), merged 69467b05.** Story 78 was approved directly in production on 21 Nov at 12:12 IST, so fix 910 is obsolete.
- **Step 2, plan (staging):** run 44882971032, cancelled after staging passed. Its production job was waiting for approval and was holding the `db-migrate` concurrency group. Pending: `20261121120000_alert_state.sql` only. Parity PASS (repo 45 = staging 44, 1 pending). Held: fixes 142, 143, 563, 798, 911 (not in the fixes input).
- **Step 2, apply (staging):** run 44883211273 (https://github.com/bricksofindia007/bricks-of-india/actions/runs/44883211273). `only_version=20261121120000`, scope=migrations, target=both. Staging applied `20261121120000_alert_state.sql`, 0 rows changed. Backups taken: `boi_backups.supabase_migrations__schema_migrations__20261121T080813` (44 rows) and `...data_fix_log__20261121T080813` (60 rows). Staging parity PASS (repo 45 = staging 45). The job also pruned 46 backup tables older than 30 days.
- **Step 2, production:** WAITING for the owner's production-migrations approval on run 44883211273. Read-back after approval (alert_state exists, RLS on, grants to service_role only) is not done yet. Deadline: 07:30 IST on 22 Nov.
- Steps 3 to 8 not started.

- **Step 2, production: PASS.** The owner approved `production-migrations` for run 44883211273 at 13:44 IST and it succeeded. Chat read production back: `public.alert_state` exists, RLS on, 0 policies, grants to postgres and service_role only.
- **Step 3, deploy: BLOCKED by the deploy gate.** `deploy-cloudflare.yml` dispatched on main, run 44884254512 (https://github.com/bricksofindia007/bricks-of-india/actions/runs/44884254512). Main HEAD `3858109` has the same application code as the step 1 merge `caf040ff`: since then only docs and the two supabase files changed. The gate blocked for three reasons. (1) `snapshot-tests` and `verify-no-email-in-client-bundle` are not green on `3858109`, because a docs push runs no heavy checks. (2) Code differs from the last measured commit `3c507a6`, so a re-measure is required. (3) No emergency override is set. The Build and Deploy jobs were skipped. Nothing was deployed and no production Worker changed. Rollback target from the order `22417daa-6a37-4d63-afd2-cae7912e692d` was not used. Gate script: `scripts/ci/deploy-gate.mjs`.
- Steps 4 to 8 not started. Waiting on chat for how to clear the gate.

## Order 1946 CONTINUE 4 (21 Nov, IST)

- **Step 1, staging counts: NOT DONE.** Staging counts of sets, store_prices and price_history cannot be read from the automation path. `scripts/release/count-rows.mjs` needs STAGING_SUPABASE_URL and a key (GitHub secrets). No workflow runs it, and the read-only staging workflow counts only reviews, news_articles and guides. Production counts from chat: sets 26,250; store_prices 1,964; price_history 8,116. Issue #998.
- **Step 2, measurement: NOT STARTED.** Blocked on step 1. Load profile SHA-256 matches the committed file: `ac01dbb4091ed0b0203ef319b0e301d2182cc66133820f4904666ef411eb38ea`. The gate's current measurement (`3c507a6`) recorded staging counts 26,123 / 1,951 / 7,700. Measurement end time: not set.
- **Step 5, data fixes.**
  - Plan (staging only, no production job): run 44884835692. Pending on staging: 563, 798, 911, 142. Fix 143 held and not named. Fix 910 already removed (PR 996).
  - Fix 563, run 44884911592 (https://github.com/bricksofindia007/bricks-of-india/actions/runs/44884911592): staging applied. 5 rows changed (UPDATE 1, UPDATE 2, UPDATE 1, UPDATE 1). Before-count 5 OK, after-count 5 OK. Backups: schema_migrations 45 rows, data_fix_log 60 rows, public.reviews 238 rows. Staging parity PASS (45 = 45). Production WAITING for owner approval.
  - Fixes 911, 798 and 142: not dispatched. Each waits for fix 563's production run to finish.
- **Step 6, merges.**
  - PR 993 merged as `c2411353`. Its copy of the migration lacked the `-- boi:issue 994` header, so I added the same line on its branch (commit `931bc7a`) before merging. Otherwise merging would have reverted PR 995.
  - PR 987 merged as `9795a46b`. Main had changed the same fetch line (monitor-key headers). I merged main into the branch (commit `6a23fa8`) and kept both changes: GET, 25 s timeout, body cancel, and `siteHeaders()`.
- **Step 7, log query audit (read only).** No code in bricks-of-india `origin/main` or boi-ops `HEAD` calls the Supabase logs API, query_logs or the management API. The only log figure is an estimate (`scripts/lib/capacity-estimate.mjs`, `LOG_INGEST_QUOTA_GB = 1`). `scripts/health-check.mjs` Check 11b reads `db_usage_report()` only. Not searched: boi-growth-engine and any Supabase CLI use outside these files. Nothing to list per day for 20 and 21 Nov.
- **Step 8:** this section.
- Open issues: #997 (parity check), #998 (staging counts).

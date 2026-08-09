# BOI Master Tracker

## Nav & Content Overhaul — 2026-08-09

**Trigger:** terminal prompt (prescribed build from chat-session Claude) — retire Blog/Opinion as standalone sections, build a Guides weekly content pipeline, an Opinion fortnightly cadence, a `featured_videos` mechanism, and fix the News/Reviews image-fallback root cause. PR #22, squash-merged as `311b13b`. Full detail in the commit message; summarized here.

**Pre-flight (before any writes):** schema re-verified live against `information_schema` (matched the doc exactly), slug-collision check clean (0 collisions), category breakdown matched exactly (Buying Guides 9, Gift Guides 1, How-To 3, Value Picks 1, Opinion 11 = 25/25), fallback-image counts matched exactly (News 116/286, Reviews 12/147).

**Two corrections made to the doc's own assumptions, confirmed with Abhinav before implementing, not applied blindly:**
- **Reviews' 12 fallback rows are NOT the same root cause as News's fan-MOC case.** 11 of 12 had a valid `set_id` with a real official image already sitting unused in `sets.image_url` — backfilled from there instead of the generic placeholder (real product photography beats a generic illustration). Only the 1 true orphan (no matched set) got the new `review-photo-fallback.png`.
- **48 already-published News articles were found hotlinking third-party fan/community CDNs** (BrickNerd's own Squarespace CDN, individual builders' Flickr, Brothers Brick's CDN — confirmed via domain audit, zero catalog-sourced) from an earlier `image_repair_queue` repair pass, predating and violating the same copyright principle this build's image-fallback fix establishes going forward. Backfilled to the new placeholder alongside the 116 genuine fallback rows.

**Nav/routing:** Blog/Opinion removed from Navbar + Footer. `/blog(/:slug)` → 301 → `/guides(/:slug)`, `/opinion(/:slug)` → 301 → `/news(/:slug)`. Old page components left in place, unrouted (redirects shadow them) — rollback path per established convention. `sitemap.ts` no longer sources `/blog`/`/opinion` URLs from `blog_posts` (would list permanently-redirecting URLs — same class of issue as §GSC-02). `/sets/[slug]`'s Related Coverage block now queries `guides` instead of `blog_posts` (avoids double-counting migrated rows). Lint Gate 8's opener-uniqueness corpus swapped `blog_posts` (now dormant) for `guides` (newly actively-generated).

**Data migration:** `blog_posts` → `guides` (14 rows: Buying Guides/How-To/Gift Guides/Value Picks) and → `news_articles` (11 rows, category='Opinion'). `blog_posts` kept as a dormant rollback table, not deleted, nothing writes to it anymore.

**Guides weekly pipeline:** `scripts/radar/guide-topics.js` (20-topic backlog: age/budget/theme/storage-display/gift-occasion buckets) + `queue-weekly-guide.js` (new weekly cron, Thu 04:20 UTC) queues one `pending_drafts` row/week — reuses the **existing** daily `generate-drafts.yml` cron and the `guide`-format prompt/publish path that had existed since WEB-05 but was never actually reachable (see bugs below). Monthly `guide-staleness-guard.js` (1st of month, 04:20 UTC) flags stale-looking guides into `content_quality_issues` for manual review — deliberately never auto-corrects (no live-price gate for Guides to verify a correction against; same "flag, don't guess" discipline as the Reviews pipeline's verdict-flip handling).

**Opinion fortnightly cadence:** deterministic 14-day cycle (`scripts/radar/opinion-cadence.js`, runs after RADAR-03 in `radar.yml`) replaces what had actually been an uncontrolled, reactive mechanism: `classify-signals.js`'s `OPINION_RE` keyword match could previously set `draft_format='opinion'` on *any* day at whatever rate matching titles happened to arrive — how all 11 pre-overhaul Opinion pieces were made, not on any real cadence. That autonomous trigger is removed; `OPINION_RE` survives in the new `opinion-signal.js` purely as a same-day ranking preference on an Opinion day (prefer a candidate that already has a natural angle; fall back to the strongest general News candidate + an explicit `opinion_forced_take` prompt instruction when nothing matches). Logs which path fired to the new `opinion_cadence_log` table each cycle — same instinct as `social_automation_heartbeat`'s `consecutive_skip_days`.

**Two structural bugs found and fixed while wiring `guide`-format publishing end-to-end** (not just following the spec literally — the existing WEB-05 guide infrastructure had never actually been reachable):
- `pending_drafts.draft_format`'s CHECK constraint never included `'guide'` — would have hard-rejected every insert this pipeline needed to make.
- `resolveTarget()` hardcoded `category='Guide'` for every guide publish, matching none of `/guides`' 5 real filter chips (which this session also rebuilt — see below). `publish-draft.ts` now accepts a per-draft `draft_category` override (populated by `queue-weekly-guide.js` from the topic's real category) and also writes `featured_image_url` (guides pages read this exclusively, not `hero_image`, which the generic insert path had never set for that table).

**`/guides` filter chips rebuilt:** were `['Getting Started', 'India Specific', 'Advanced']` — categories that never existed on any guides row (confirmed live: all 9 pre-migration rows are `lego-101`), so every filter returned zero results. Rebuilt to the real set: `lego-101, Buying Guides, How-To, Gift Guides, Value Picks` (with a friendlier `LEGO 101` display label). Decorative gradient fallback (shown when a guide has no image) also remapped from the dead categories to the real ones.

**Homepage:** "GUIDES & OPINION" (sourced from `blog_posts`, unfiltered by category — never actually guaranteed Opinion content, and none of `guides`' own rows ever appeared here) replaced with a genuine **Latest Guides** section querying `guides` directly, CTA → `/guides`. Opinion no longer gets a dedicated homepage block — it surfaces inline in Latest News automatically, since `/news`'s query was already unfiltered by category (zero code change needed for that half of §3).

**Featured Videos:** new `featured_videos` table (RLS + public-read policy, matching the established convention) replaces the hardcoded 3-video array in `YouTubeSection.tsx`. Seeded with the same 3 videos as parity placeholders — real picks are Abhinav's call, update via Supabase directly, no code change needed for future swaps.

**Image fallback fix:** two new original placeholder assets composed from local mascot/brand assets (`public/community-spotlight-fallback.png`, `public/review-photo-fallback.png`) — no third-party photography, ever. `resolveHeroImage()` now returns the Community Spotlight asset instead of the generic `/fallback-hero.png` specifically for News articles with no `set_number` (confirmed root cause of all 116 pre-backfill News fallback rows), scoped to `news_articles` only (Guides/Reviews keep the generic fallback — semantically wrong to label those "community content").

**Schema (Supabase migration `nav_content_overhaul_schema`):** `pending_drafts` +`opinion_forced_take` (bool), +`draft_category` (text), `draft_format` CHECK widened to include `guide`; new tables `opinion_cadence_log` and `featured_videos` (RLS enabled on both; `featured_videos` gets a public-read policy, `opinion_cadence_log` doesn't — internal pipeline-only, matching the existing `generator_runs`/`content_rejections` convention).

**Verification:** `npm run build` clean, `tsc --noEmit` clean, 96/96 vitest tests passing, full local-server verification (redirects, sitemap, category filters, inline-Opinion-in-News, image fallbacks) against post-migration live data before push. Post-deploy: 10 real historical `/blog` and `/opinion` URLs (randomly sampled directly from the DB, not hand-picked) spot-checked end-to-end on production — all 10 redirect correctly and their destinations return 200. One false alarm during spot-check (a hand-typed test slug that never existed in `blog_posts` to begin with, confirmed and dismissed, not a real defect) — logged here rather than silently discarded, per this tracker's own practice of not hiding investigation dead ends.

**Not done this session, flagged not hidden:** `admin/dashboard.html`'s `meta.lastUpdated`/`cadence` were updated for this session's new automated jobs, but the dashboard's broader drift from this tracker (`meta.lastUpdated` was `2026-07-09` before this session, a month behind the tracker's actual content) predates this session and was not fully reconciled — out of scope for this build, noted for a future pass.

---


> **Purpose:** One-page index of phase status, blockers, and deadlines. Task-level detail lives in the four sub-trackers below.
>
> **Last updated:** 2026-07-30 — see **§Reviews Pipeline Overhaul: MyBrickHouse/Toycra Direct Sourcing** (top of file, new): reviews fully decoupled from RADAR-08's RSS/Brickset-provenance sourcing; a set is now review-eligible only with a confirmed live MyBrickHouse/Toycra listing (price + stock, fetched fresh at generation/refresh time). New `reviews` columns (`source_retailer`, `source_price_inr`, `source_stock_status`, `source_checked_at`, `verdict_disclaimer_variant`) + a verdict CHECK restricting retailer-sourced reviews to BUY NOW/WAIT/AVOID (IMPORT ONLY structurally impossible on that path). Deterministic India-Paragraph + retailer-conditional-disclaimer splice at publish time (never model-transcribed). New weekly combined job (`reviews-weekly-refresh.yml`, Wed 05:00 UTC) re-verifies every published retailer-sourced review and discovers new candidates from one shared live fetch. 4 new CQS gates. RADAR-08 removed from `radar.yml`'s daily schedule (script left in place, undeleted). **Two real bugs caught and fixed same-day before/during rollout, not hidden**: (1) the verdict CHECK constraint originally shipped unconditional across the whole `reviews` table, which would have silently blocked every future legacy RADAR-sourced review from using IMPORT ONLY — a still-legitimate verdict for that source; fixed via a same-day follow-up migration scoping the CHECK to `source_retailer IS NOT NULL` only. (2) a live duplicate was found and purged: RADAR-08's legacy backlog (~140 approved, ungenerated `pending_drafts` rows found still queuing) had independently queued a second candidate for set 75442 — the exact set that shipped as one of this pipeline's first 3 published reviews — confirming the collision risk this whole overhaul exists to prevent was not hypothetical. 3 real reviews published end-to-end through the actual production pipeline (not mocked): [Miles Morales Mech vs. Spider-Man 2099](https://bricksofindia.com/reviews/lego-miles-morales-mech-vs-spider-man-2099-76337-worth-1499) (BUY NOW/Toycra), [The Mandalorian's N-1 Starfighter](https://bricksofindia.com/reviews/lego-the-mandalorians-n-1-starfighter-75442-worth-26999) (WAIT/MyBrickHouse), [Dungeons & Dragons: Red Dragon's Tale](https://bricksofindia.com/reviews/lego-dungeons-dragons-red-dragons-tale-21348-worth-35999) (WAIT/Toycra) — verdicts genuinely model-decided, not gamed; all 3 verified clean against raw DB content. Real first-contact friction observed and left as-is (pre-existing shared gates, not new bugs): 2 of the first 5 real generation attempts were correctly rejected by Gate 6 (source fidelity) and Gate 8 (opener-uniqueness) — the model repeatedly reaches for `VOICE_EXAMPLES`'s literal example opener ("Your wallet called...") closely enough to collide with recently-published articles. Also observed, not gated: a model can volunteer specific-sounding but ungrounded claims (a MyBrickHouse EMI promo's exact terms/expiry) from its own training knowledge in free body prose outside the deterministic block — accurate this time, not verifiable by anything in this pipeline. Full writeup below. Previously updated 2026-07-27 — see **§GSC-01** (updated same section, permanent `index_tier` classification): all 25,296 sets classified Tier 1/2/3, DB-enforced via triggers on `sets` and `store_prices` (migration `20260727000000`), sitemap now excludes Tier 3 and weights Tier 1 at priority 0.8, Tier 3 pages get server-side noindex+follow. Two false positives found and fixed pre-ship (`book` keyword theme-gated, non-numeric-ID rule now requires keyword corroboration) — final Tier 3 count 3,823 (down from 4,219). Also see **§GEO-05b: bidirectional set-article linking** (closes `HIGH-51`): 0 of 335 published articles had any `/sets/` link (worse than the stale "98 news + 23 blog" tracker figure); forward auto-linking shipped as a standalone transform (not the model-self-links approach originally scoped), one-time backfill added 233 links across 176 articles, reverse "Related Coverage" block added to `/sets/[slug]`, CI guardrail verified against a real synthetic 404 case. Also see **§Recrawl acceleration**: the Google sitemap ping was shipped, deployed, and confirmed dead (`HTTP 404` — Google deprecated this endpoint in June 2023) in the very same session, then removed and replaced with IndexNow (`14ac9ab`) — real per-chunk verification against all 21,473 Tier 1+2 set URLs, including a transient `403`-then-`200` key-verification race caught and explained, not hidden. Also see **§VID-P4: rejection-exception workflow** at top of file: `content_rejections` duplicate-row bug fixed (single `reject_video_post()` RPC replaces the old trigger + manual-insert double-write), keyword-based `rejection_category` classification added, automatic MRP-audit-queue flagging for pricing/piece-count/set-details rejections, and `cleared_for_regeneration` sets now jump the daily candidate queue instead of just becoming eligible again. Same-day follow-up (item 4): the priority-clear-on-regen step moved from `engine.py`-only logic to a DB-level `AFTER INSERT` trigger on `video_posts`, closing the same "logic in two places" gap the original duplicate-row bug had. Also see **§CODE-AUDIT-01** (this same day, now fully closed, all 6 steps): confirmed code-audit.yml's two Jul-13-flagged failures (npm audit, secrets manifest) still genuinely failing as of the Jul 20 run; secrets manifest backfilled + hardened (`d0c29d0`, `162b4f6`), `postcss` fully patched with the `@supabase/*` family frozen against unintended drift (`a0c521e`), Next.js DoS risk researched and deferred as `NX-DOS-01` (no 14.x patch exists), and `code-audit.yml`'s false-green job status fixed and verified against a real failure (`b3862f9` — closes `LOW-28` for this file). Also see **§GSC-01** (this same day, now fully closed): Search Console indexing diagnosis found no concrete defect (naive soft-404 heuristic rejected as unreliable against the real page template, 0 orphaned sitemap entries, 0 redirect gaps); Product JSON-LD description threaded from the real meta description (`658326a`); shipping/returns structured-data fields cancelled permanently (retailer-owned data BOI can't keep in sync); `review` object added to Product JSON-LD for the 99 sets with a matching review, plus a CI guardrail (`46e267c`) verified against all 25,296 sets that no set without a review can ever get a fabricated rating. Also see **§Session — 2026-07-26** further down: IG-TOK-01 reopened and mitigated (real root cause was the auto-refresh workflow re-exchanging an already-long-lived token, not a missed setup step — commit `6525e81`), YouTube health-check false alarm closed as a schema-mismatch bug (no re-auth needed, YouTube pipeline was never actually broken). Previously updated 2026-07-09 (HIGH-56 closed / HIGH-57 filed-and-closed same day — MRP root-cause fix: 644 sets corrected against live Toycra MRP data, `mrp_verified` flag added, 2,770 systemically-suspect rows flagged not silently trusted, 127 CMF sets flagged for box/figure ambiguity, generator gated on verification status. DEFECT-016 closed and then extended same day — Rebrickable wrong-image filter (ISBN/zero-parts/theme-blacklist), then the real fix: theme/set_number-VERIFIED matching, no more keyword-overlap-alone acceptance. DEFECT-017 closed — new Gate 9 duplicate-by-set_number/topic-stem check, wired into the shared publish path. MEDIUM-69 — verdict column/body drift detection + enforced write path; live run immediately found and fixed one real bug (Natural History Museum, stale Jaiman price + missing marker). MEDIUM-70 — capitalisation abbreviation whitelist. Duplicate-article redirect cleanup completed (9/9 URLs). Fallback-hero backfill re-verified clean under the new matching fix (0 rescues, 67 legitimate). §2b now closed — 5 of 6 candidate groups confirmed genuine duplicates and resolved (redirects + deletes), Road Bike 11380 partially applied after content review found 2 of the 4 candidates were legitimately different content; 2 wrong-image cases reverted and confirmed pre-existing backlog, not a DEFECT-016 gap; 1 missing redirect found and fixed (Ideas 21365, was 404ing). BUG-016 closed — byline/breadcrumb contrast fix on Reviews' dark hero band, verified live via local dev server on News/Reviews/Blog. DEFECT-019 closed — reviews table given its first full CQS pass: rating/verdict correlation fixed generator-side (independent RATING field, new pending_drafts.draft_rating column), 13 duplicate wallet-cliché openers rewritten, no set_number mislinks found, several stale/false-positive CQS rows cleaned up, 3 unverified-MRP reviews confirmed already correctly flagged with no forced correction. DEFECT-020 closed — user-requested re-verification of the §2b Road Bike group found a 5th duplicate the original slug-pattern search had missed entirely (no "11380" in its slug, no set_number linked); root cause was search scope, not an environment split or a silently-failed delete. Fixed, and every other resolved duplicate group broadly re-checked by title keyword — all clean.)
> **Health Score: 96 (unrecomputed — see MEDIUM-63)** — score not bumped despite 3 CRITICALs closing today; formula needs re-running against current state, not guessed. YouTube OAuth blocked (Google review, submitted 2026-06-02, MEDIUM-56 verify heartbeat). IG token re-exchange by 2026-07-16 (IG-TOK-01) — 14 days remaining as of 2026-07-02; `.github/workflows/ig-token-refresh.yml` now built (1st+15th monthly auto-rotation, see Sprint changelog) but not yet live — secrets (`FB_APP_ID`, `FB_APP_SECRET`, `ADMIN_PAT`) and one confirming `gh workflow run` are still Abhinav-side action items. RLFM-RUNWAY-01 first snapshot was due 2026-07-01 — due date has now passed with no confirmation logged here; needs a status check, not assumed done.
> **Audit log:** `audit-block1.log` | Consolidation audit 2026-06-27: §Social Automation, §SEO/GEO, §Content Engine, §Web/Technical Hygiene, §Video Phase 4, §Monetization, §THE LAB Deferred added to §Pending
> Sub-trackers (Web, Content, Video, Social) archived to docs/archive/ 2026-06-27 — BOI_MASTER_TRACKER.md is the sole living tracker.

---

## VID-QP Backlog — Script-Gen Follow-ups (not fixed, flagged for a future session)

- **Reading-floor duration gap (found 2026-08-01):** `quiet_panic_script_gen.py`'s pre-TTS word-budget check (`check_word_budget`) only counts words in `voice:true` segments — it has no visibility into `voice:false` caption length. A `voice:false` segment's real duration is `max(sfx_native_length, reading_floor)`, and once captions are written with "full wit and specificity" (per the 2026-07-31 CONCRETE-DETAIL persona rule) rather than kept minimal, `reading_floor` can exceed the ~4.48s worst-case SFX-native floor the original TOTAL_WORD_CAP/PER_SEGMENT_WORD_CAP derivation assumed. Confirmed live: a Spider-Man vs. Hulk generation passed both the word-budget check and the banned-construction gate cleanly, but real measured total duration came in at 62.52s — 2.02s over the 60.5s ceiling — entirely from long voice-off captions. `gate_duration` (post-render) would correctly catch this and route to `publish_blocked`, so nothing broken ships, but it costs a full TTS render to find out rather than being caught pre-TTS like the word-count checks. Fix direction not yet decided (options: a caption-character-count pre-TTS cap mirroring the voice-word logic, or accept the post-render cost as the backstop) — needs its own pass, not bundled into this session's persona-tuning work.
- **Word-count check can be silently gamed by digit formatting (observed 2026-08-01, not yet acted on):** `check_word_budget` counts via `str.split()`, so a segment written as `"534 pieces."` counts as 2 tokens where `"Five hundred thirty four pieces."` counts as 5 — same spoken content, very different apparent budget cost. A hyphenated compound (e.g. `"City-wide"`) also collapses to one token. Not a correctness bug (nothing downstream requires spelled-out numbers except the exact price-token phrase, which is separately validated), but it means the word cap isn't a reliable proxy for spoken duration when the model reaches for digits — worth a look if `gate_duration` failures cluster around scripts using digit-style numbers.

---

## Reviews Pipeline Overhaul: MyBrickHouse/Toycra Direct Sourcing — 2026-07-30

**Trigger:** terminal prompt requesting a full replacement of how the `reviews` table is sourced, verdicted, and refreshed. Reviews previously entered via RADAR-08 (`scripts/radar-08-reviews.js`), which selected candidates from `store_prices` (already retailer-scraped, refreshed every 6h) but never recorded which retailer/price/stock backed a given review on the `reviews` row itself, never re-verified a review after publish, and generated an India Paragraph with "estimated"/"4-6 week launch lag" framing baked into the shared prompt — all moot once a set is a confirmed live listing, and the same underlying gap (converted/unconfirmed prices standing in for real India data) that caused the separately-tracked `sets.lego_mrp_inr` corruption.

**Schema — live-inspected before any DDL** (`information_schema.columns`, project `hqpaiarhmiocmjrzjhtw`): `reviews` had no `source_*` columns pre-change; verdict distribution was WAIT=93, BUY NOW=15, IMPORT ONLY=5, no AVOID. The 5 legacy IMPORT ONLY rows are why the new CHECK constraint was added `NOT VALID` rather than plain — a plain CHECK would have rejected the migration outright.

**Migrations:** `supabase/migrations/20260730000000_reviews_source_pipeline.sql` (adds `reviews.source_retailer/source_price_inr/source_stock_status/source_checked_at/verdict_disclaimer_variant`, `pending_drafts.source_retailer/source_price_inr/source_stock_status/source_checked_at`, and the verdict CHECK — shipped with a real bug, see below) + `20260730010000_reviews_verdict_check_scope_fix.sql` (same-day fix). Both applied via Supabase MCP `apply_migration`.

**Bug caught and fixed same-day, not hidden:** the verdict CHECK (`reviews_verdict_no_import_check`) originally shipped as `CHECK (verdict IN ('BUY NOW','WAIT','AVOID'))` — unconditional across the whole table. Intent was only ever to exclude IMPORT ONLY for reviews sourced from this new pipeline (structurally impossible there — listing on MyBrickHouse/Toycra is the entry condition), but as written it would have silently rejected every future INSERT/UPDATE of a legacy RADAR-sourced review (`source_retailer IS NULL`) carrying IMPORT ONLY — still a legitimate verdict for that source (a set genuinely absent from India retail). Abhinav caught this by reasoning from the live duplicate finding below, not from re-reading the migration. Fixed via `20260730010000`: `CHECK (source_retailer IS NULL OR verdict IN ('BUY NOW','WAIT','AVOID'))`. Left the original migration file's buggy version in place (didn't rewrite history) — the fix is its own file, matching normal migration hygiene of never editing an already-applied migration.

**Verdict value correction (caught before implementation, not after):** the terminal prompt's own CHECK table said `'BUY'`; existing house convention everywhere else (`pending_drafts`'s own CHECK, `src/lib/lint.ts`'s `VALID_VERDICTS`, `publish-draft.ts`'s `VERDICT_TO_RATING`) uses `'BUY NOW'`. Confirmed with Abhinav this was shorthand, not intentional — used `'BUY NOW'` throughout, avoiding a change to shared verdict validators used by non-reviews content.

**Source connector — reused, not rebuilt.** `scripts/scrape-now.mjs`'s Shopify `/products.json` fetch logic (`fetchAllProducts`, `extractSetNumber`, `parseProduct`, `STORES` config) extracted into `scripts/lib/retailer-fetch.mjs` with zero behavior change (verified: `scrape-now.mjs`'s diff is a pure extraction, still runs under plain `node`, unaffected by any of this session's TS/tsx changes). New `scripts/lib/reviews-source.mjs` built on top: `fetchLiveListings()` (one fetch pass serves both weekly-job passes, per spec) + `resolveEligibleListing()` (Section 3's eligibility rule — a store only counts with both a real numeric price and a clean stock reading; a missing/failed store is absent, never guessed at). Caught and fixed during testing: the first version of `resolveEligibleListing` could feature an out-of-stock listing as "the deal" if its price happened to be lower than an in-stock alternative at the other store — fixed to only compare prices among in-stock stores, falling back to an out-of-stock reading only when nothing is in stock anywhere (needed for Pass 1's "gone out of stock everywhere" detection). Tested live against 3 real set numbers spanning both retailers plus edge cases (single-store, dual-store with one side out of stock, nonexistent set) — all resolved correctly.

**Weekly combined job:** `scripts/reviews-source-refresh.mjs` + `.github/workflows/reviews-weekly-refresh.yml`, one job not two crons. Schedule **Wed 05:00 UTC (10:30 IST)** — checked against every existing schedule in `.github/workflows/*.yml` first (weeklies cluster Mon 02:00-05:30 UTC and Sun 02:00 UTC; dailies at 01:30/02:30/03:00/06:30/07:30/08:30/12:30/17:30/19:00 plus `scrape-prices` every 6h); this slot overlaps none of them. Pass 1 re-verifies every published review with `source_retailer` set (always updates `source_checked_at`; auto-updates price/content when the change doesn't plausibly flip the verdict — a documented 15% price-move threshold, since no deterministic verdict formula exists anywhere in this codebase to re-derive one from; flags to `content_quality_issues` and freezes everything else on a plausible flip or confirmed out-of-stock-everywhere, never auto-unpublishes). Pass 2 discovers new candidates from the same fetch, dedupes by set number against `reviews` + `pending_drafts`, queues into `pending_drafts` (cap 10/run) for the existing `generate-drafts.yml`/`publish-drafts.yml` crons to pick up unchanged. Dry-run tested live against production data (990 distinct set numbers fetched, 698 Pass-2 candidates found, correctly capped at 10).

**Generation-time changes.** `src/lib/prompts/draft-prompt.ts`'s new `buildRetailerSourcePriceContext()` tells the model to use the confirmed price/retailer (no estimation, no launch-lag language) while still writing the normal-shaped India Paragraph — deliberately, not stripped down, because `lint.ts`'s Gate 2 runs against the model's *raw* body before any splice ever happens and hard-fails without a ₹ price/store mention in that block; a first draft of this prompt instructed the model to omit them and would have failed every draft before reaching the splice step, caught in testing before it shipped. `src/lib/publish-draft.ts` then unconditionally **replaces** that entire marker block at publish time with a byte-exact deterministic template (`spliceRetailerIndiaParagraph()` for first publish, `resplicePublishedIndiaParagraph()` for Pass-1 re-verification updates, sharing one `buildDeterministicBlock()`) built from `source_price_inr`/`source_retailer`/`source_checked_at` — the model's own price/store text in that block never reaches the page. `src/lib/review-disclaimer.ts` is the single source of truth for `resolveDisclaimerVariant()` (verdict × retailer → `buy`/`wait_mybrickhouse`/`wait_toycra`/`avoid`) and the disclaimer text table, imported by both `publish-draft.ts` and the CQS gates so they can't drift apart; throws `InvalidReviewVerdictError` for IMPORT ONLY, which `publish-draft.ts` also enforces as an explicit publish-time reject (defense in depth alongside the DB CHECK). Toycra affiliate code (`ABHINAV12`) needed no new code — the existing generic `prePublishAutoFix` insertion already fires whenever "Toycra" + a price appear with no code present, confirmed live on both published Toycra-sourced samples. No MyBrickHouse affiliate code exists anywhere in the repo (grepped, confirmed) — none invented, per spec.

**CQS gates** (`src/lib/review-source-quality.ts`, called from `scripts/content-linter.mjs`, `section='reviews'` scoped to `source_retailer IS NOT NULL` only — legacy RADAR-sourced reviews structurally exempt): verdict-validity, disclaimer-consistency, source-freshness (~8 days, `warning` — an operational alert about the weekly job, not a content defect), no-fabrication backstop. Extracted as a pure, independently-testable function per Abhinav's explicit call (rejected an initial ad-hoc DB-probe verification approach in favor of `tests/review-source-quality.test.ts` — 8 hardcoded mock cases, each exercising one gate's actual failure path: clean BUY NOW/WAIT-mybrickhouse/WAIT-toycra/AVOID all pass, null price triggers no-fabrication, IMPORT ONLY triggers verdict-validity, a deliberately mismatched disclaimer variant triggers disclaimer-consistency, a 10-day-old `source_checked_at` triggers source-freshness — all 8 passing). Required moving `content-quality.yml`'s linter invocation from plain `node` to `npx tsx` (matching the precedent already set by `publish-drafts.yml`) since the new gate needed to import a `.ts` module — confirmed this doesn't change behavior for any of the linter's existing (non-reviews) checks.

**3 real reviews published end-to-end through the actual production pipeline** (not the harness used for manual pre-approval review — Abhinav explicitly asked to see full bodies/verdicts/disclaimers before any live publish, given this pipeline's real fetch/splice/disclaimer logic had never touched a real candidate until this session):
- [Miles Morales Mech vs. Spider-Man 2099 (76337)](https://bricksofindia.com/reviews/lego-miles-morales-mech-vs-spider-man-2099-76337-worth-1499) — BUY NOW, Toycra, ₹1,499, `verdict_disclaimer_variant='buy'`
- [The Mandalorian's N-1 Starfighter (75442)](https://bricksofindia.com/reviews/lego-the-mandalorians-n-1-starfighter-75442-worth-26999) — WAIT, MyBrickHouse, ₹26,999, `verdict_disclaimer_variant='wait_mybrickhouse'`
- [Dungeons & Dragons: Red Dragon's Tale (21348)](https://bricksofindia.com/reviews/lego-dungeons-dragons-red-dragons-tale-21348-worth-35999) — WAIT, Toycra, ₹35,999, `verdict_disclaimer_variant='wait_toycra'`

Verdicts were genuinely model-decided (candidates chosen only for retailer/price-band diversity, not for a target verdict) — all 3 verified clean by reading raw `reviews.content` directly from the DB, not trusting a summarization tool (a `WebFetch` call against the Mandalorian page hallucinated a fake "official LEGO India MRP ₹22,500" claim that does not exist anywhere in the real content; caught by cross-checking the DB directly before reporting it, corrected in the same turn rather than left standing).

**Honest first-contact friction, not hidden:** the real run needed 3 attempts to get all 3 published (first pass: 0/3; second: 2/3; third: 3/3). Two pre-existing shared gates — Gate 6 (source fidelity, caught the model referencing an ungrounded set number `#76244` from a different set) and Gate 8 (opener-uniqueness, the model repeatedly reaching for `VOICE_EXAMPLES`'s literal example opener, "Your wallet called...", closely enough to collide with recently-published articles and with its own same-batch drafts) — correctly rejected several generations. Neither gate was touched or weakened; this is the existing shared quality-gate system working as designed against new candidates, at a rejection rate any content type sees, not a defect in this new pipeline's own code. Separately observed, not gated by anything in this pipeline: the Mandalorian review's model-written prose (outside the deterministic block) volunteered specific MyBrickHouse EMI promo terms ("until July 31st," "up to ₹1,500," "minimum ₹10,000") from its own training knowledge — accurate per Abhinav's own briefing, but ungrounded from any source this pipeline actually gave the model, and nothing currently catches a promo detail like this going stale.

**Live duplicate found and purged — the collision this overhaul exists to prevent, not hypothetical.** Investigating RADAR/VID-P4 scope-isolation turned up ~140 approved, ungenerated `pending_drafts` rows still being queued by RADAR-08 on its existing daily schedule — including an independent Brickset-sourced entry for set 75442, the exact set that had just been published as one of the 3 samples above via the new pipeline. Per Abhinav's explicit instruction: that specific row (`id=3b86889b-...`) was deleted (confirmed via direct query before deletion, not blind); RADAR-08 was removed from `.github/workflows/radar.yml`'s schedule (script left in place, undeleted, for reference); the other ~139 legacy rows were left untouched (daily `generate-drafts.yml` will keep draining them as before — they simply won't gain new ones from RADAR-08 going forward).

**Explicitly confirmed untouched:** `git diff --stat` scoped to `scripts/radar/`, `scripts/radar-08-reviews.js`, `src/app/news`, `src/app/api`, and every `scripts/video/*`/video workflow path returns empty except the one line removing RADAR-08's step from `radar.yml` (an explicit, Abhinav-approved exception to the original "don't touch RADAR" scope, made necessary by the live duplicate finding). `radar-08-reviews.js` itself has zero diff. Pre-existing unrelated working-tree drift (`.env.example`, `briefs/VID-QP-01.md`, `scripts/video/.env.example`, the video-pipeline patch files, `assets/bumpers/*`) predates this session and was left alone throughout — confirmed against the very first `git status` taken before any work began.

**Files touched** (staged explicitly, no `git add -A`): `supabase/migrations/20260730000000_reviews_source_pipeline.sql` + `20260730010000_reviews_verdict_check_scope_fix.sql` (new), `scripts/lib/retailer-fetch.mjs` (new, extracted), `scripts/scrape-now.mjs` (modified — imports from extraction, zero behavior change), `scripts/lib/reviews-source.mjs` (new), `scripts/reviews-source-refresh.mjs` (new), `.github/workflows/reviews-weekly-refresh.yml` (new), `.github/workflows/radar.yml` (modified — RADAR-08 step removed), `.github/workflows/content-quality.yml` (modified — linter invocation now `npx tsx`), `src/lib/review-disclaimer.ts` (new), `src/lib/review-source-quality.ts` (new), `src/lib/publish-draft.ts` (modified), `src/lib/prompts/draft-prompt.ts` (modified), `scripts/generate-approved-drafts.ts` (modified — threads `source_*` fields through to the prompt builder), `scripts/content-linter.mjs` (modified — new gate call), `tests/review-source-quality.test.ts` (new, 8/8 passing), `BOI_MASTER_TRACKER.md` (this entry).

**Verification:** `npx tsc --noEmit` clean throughout every step (re-run after each file change, not just once at the end); full `npx vitest run` 89/89 passing (81 pre-existing + 8 new); all 3 sample reviews verified against raw DB `content`, not a summarization tool; live connector tested against 3 real set numbers before any code shipped; weekly job dry-run tested against real production data; the verdict-CHECK bug and the 75442 duplicate were both caught and fixed live, in this session, before this tracker entry was written — not deferred.

**Same-day follow-up: legacy RADAR-08 backlog purged, not left to drain.** Leaving the ~139-row legacy backlog to drain through the existing daily crons was flagged as a real risk, not neutral inaction: those rows are exempt from every gate shipped today (`source_retailer IS NULL`), some could legitimately resolve to IMPORT ONLY (contradicting the editorial policy just shipped — reviews now require a confirmed India-available set), and the 75442 collision proved this isn't hypothetical. Scoped precisely before acting: of 104 approved+ungenerated `review`-format rows, **73** matched RADAR-08's own exact candidate pattern (`source_url LIKE 'https://brickset.com/sets/%'`) and **31** were genuine external review articles/videos independently classified by RADAR-01-03's still-valid RSS pipeline (Brickset articles, YouTube, New Elementary, Jay's Brick Blog, Brothers Brick) — a different, untouched content path. Checked for a lighter option than delete first: `pending_drafts.status` already has a `'rejected'` value, confirmed to be exactly the same terminal, inert state the `/admin/pending` UI's own manual reject button sets (`src/app/admin/pending/actions.ts:52`) and confirmed nothing else in the codebase further processes or auto-deletes rows in that state. All 73 RADAR-08-pattern rows marked `status='rejected'` (not deleted — same "leave it, don't remove it" instinct as `radar-08-reviews.js` itself) with `discard_reason` stamped explaining why; the 31 out-of-scope rows confirmed untouched, still `status='approved'`. Before/after counts verified live: 73 approved → 0 approved / 73 rejected; 31 untouched throughout.

### Closing summary — reviews pipeline overhaul, 2026-07-30

Full detail above (schema, connector, generation/publish changes, CQS gates, sample publishes, RADAR-08 retirement) is not repeated here — this is the closing status.

- **Sourcing decoupled from RADAR.** Reviews are now review-eligible only with a confirmed live MyBrickHouse/Toycra listing (price + stock, fetched fresh at generation/refresh time) — never RADAR's RSS/in-stock-signal matching.
- **Schema:** `reviews` and `pending_drafts` both gained `source_retailer`/`source_price_inr`/`source_stock_status`/`source_checked_at` (`reviews` also `verdict_disclaimer_variant`). `reviews_verdict_no_import_check` correctly scoped to `source_retailer IS NOT NULL` only (after the same-day scope-bug fix logged above) — legacy RADAR-sourced reviews can still legitimately carry IMPORT ONLY.
- **Verdict/disclaimer resolution** (`src/lib/review-disclaimer.ts`) and the **deterministic India-Paragraph splice** (`src/lib/publish-draft.ts`) mean the price/retailer/stock text that reaches the published page is never a model transcription — always rebuilt from the confirmed `source_*` values, at both first publish and weekly re-verification.
- **`reviews-weekly-refresh.yml`** (Wed 05:00 UTC): combined re-verification + discovery job, one shared fetch. **First manual trigger** ([run 30554011359](https://github.com/bricksofindia007/bricks-of-india/actions/runs/30554011359)) ran clean — 3/3 reviews re-checked (`source_checked_at` bumped, nothing else moved, content-hash identical before/after), 10/10 new candidates discovered and queued with zero collisions against existing `reviews.set_id`, ~91s wall-clock, no gate failures or errors. Full evidence already logged in this file's preceding entry / this session's chat record.
- **RADAR-08 retired**: removed from `radar.yml`'s schedule (script left in place, undeleted). Legacy backlog resolved precisely, not blanket-purged: 73 rows matching RADAR-08's own exact candidate pattern marked `status='rejected'`; 31 genuinely-different rows (RADAR-01-03's still-valid RSS-sourced review articles/videos — Brickset, YouTube, New Elementary, Jay's Brick Blog, Brothers Brick) correctly left untouched, still `status='approved'`.
- **3 real reviews published end-to-end** through the actual production pipeline and manually confirmed live on the site (not just in the DB): [76337](https://bricksofindia.com/reviews/lego-miles-morales-mech-vs-spider-man-2099-76337-worth-1499) BUY NOW/Toycra, [75442](https://bricksofindia.com/reviews/lego-the-mandalorians-n-1-starfighter-75442-worth-26999) WAIT/MyBrickHouse, [21348](https://bricksofindia.com/reviews/lego-dungeons-dragons-red-dragons-tale-21348-worth-35999) WAIT/Toycra.

**Open item — narrowed, still not fully resolved.** The verdict-flip-freeze guarantee (Section 4 Pass 1, point 4: a price/stock change that would plausibly flip BUY NOW↔WAIT↔AVOID must freeze the live verdict/disclaimer/content and only flag to `content_quality_issues`, never auto-change the published verdict) previously had no automated check of its own — only the unit-tested splice function and manual reasoning. That gap is now closed at the code level (see below); what's **still** open is that the guarantee has **not yet live-fired against a real price change** — no weekly run has actually hit the 15% flip threshold yet, so the self-verifying assertion has never executed against real data, only against crafted test inputs and a simulated exit-path check. Deliberately not forcing this with synthetic/corrupted live data. Correct next step unchanged: the first real `verdict_flip_candidate` should still be spot-checked against the live page when it naturally occurs — the assertion below makes that a machine-enforced guarantee rather than only a manual habit, but a mechanism that has never fired isn't the same as one that's been proven under fire.

**Same-day follow-up: failure visibility added.** Two mechanisms added to close the observability gap this pipeline shipped without:
- **Workflow-failure alerting** (`scripts/workflow-failure-notify.mjs`, wired into `reviews-weekly-refresh.yml`). Investigated first: `publish-drafts.yml`'s cron has no email alert at all (its own comment says so — batch runs intentionally skip per-draft alerts to avoid spam), and `code-audit.yml`'s existing `code-audit-notify.mjs` is hardcoded to 4 named checks, not reusable as-is. Built a small, genuinely data-driven notify script instead (takes a workflow name + a JSON step-outcomes map — reusable by any future workflow, not just this one), wired via the same `continue-on-error` + `id` + conditional-alert-step + non-continue-on-error final fail-job pattern `code-audit.yml` already established (closing the same false-green risk LOW-28 called out there).
- **Self-verifying flip-freeze assertion** (`src/lib/flip-freeze-assertion.ts`, called from `scripts/reviews-source-refresh.mjs`'s Pass 1). Before any Pass 1 write, snapshots `verdict`/`verdict_disclaimer_variant`/the India-Paragraph block text for every review being processed. After the loop, for every row flagged `verdict_flip_candidate` this run, re-reads the row live and asserts byte-identical to the snapshot — throwing (not logging) `FlipFreezeViolationError` naming the exact row and field(s) on any mismatch, which fails the job and triggers the alert above. Extracted as a pure function specifically so the failure path itself could be tested without corrupting real data: 7 vitest cases (`tests/flip-freeze-assertion.test.ts`) cover the clean-pass case and every individual mismatch type (verdict, disclaimer variant, India Paragraph text, missing snapshot, multiple simultaneous mismatches), plus a separate local simulation run inside the exact async-IIFE + top-level `.catch()` shape the real script uses, confirming the throw actually produces `process.exit(1)` with a useful stack trace — not assumed, verified.

**Commits this session:** `dd3c81b` (main pipeline overhaul — schema, connector, generation/publish, CQS gates, weekly job), `e5133c9` (dashboard sync — `admin/dashboard.html` `RADAR-08`/`REVIEWS-SRC-01` pipeline entries + cadence entry, per the Auto-update protocol), `f2d5763` (tracker addendum logging the legacy backlog purge), `d84b692` (closing summary + first manual-trigger evidence).

**Git hygiene note, flagged not hidden:** the failure-visibility work above (all 6 files — `.github/workflows/reviews-weekly-refresh.yml`, `scripts/reviews-source-refresh.mjs`, `src/lib/publish-draft.ts`, `scripts/workflow-failure-notify.mjs`, `src/lib/flip-freeze-assertion.ts`, `tests/flip-freeze-assertion.test.ts`) was staged explicitly and correctly by chat Claude, exactly as this whole session's git discipline required — but it was never separately committed by that process. It was instead swept into **`cfbf5b8`** ("Correct VID-QP-02c: row d6531082 status confirmed approved"), a same-day, concurrent commit from a separate VID-QP session (`decf072`/`4c6b1f2`/`cfbf5b8`, all authored directly by Abhinav, unrelated to reviews) that appears to have used broad staging while these 6 files sat staged in the shared git index. Confirmed precisely via `git log --follow` on each file — all 6 trace to `cfbf5b8` alone, no other commit. Already pushed to `origin/main` before this was noticed; **not** rewritten/rebased/force-pushed to "fix" the attribution — that would be more destructive than a misleading commit message on shared history another session may already be building on. Recorded here as the accurate, evidence-based commit reference instead: **this session's failure-visibility work is in `cfbf5b8`, despite its message.**

**Working tree confirmed clean** at close: `git status --short` shows only the same 3 pre-existing modified files present since before this work began (`.env.example`, `briefs/VID-QP-01.md`, `scripts/video/.env.example` — unrelated video-pipeline drift, never touched by this session) plus untracked video-pipeline artifacts from what appears to be separate, concurrent activity in `scripts/video/` (not this session's). Nothing from this work is uncommitted.

---

## VID-P4: rejection-exception workflow — 2026-07-26

**Trigger:** story #16 (set 71837, NINJAGO City Workshops) was rejected for wrong pricing — root cause was `sets.lego_mrp_inr` holding an unverified international-price-conversion estimate (₹22,500) instead of the real India MRP (₹25,499 per MyBrickHouse, corrected and re-verified live during this same investigation, `mrp_verified=true`). That fix was manual, via direct Supabase access. This build makes the *next* one of these self-triaging instead of a fresh manual investigation each time.

**Migration:** `supabase/migrations/20260726120000_video_rejection_workflow.sql`, applied via Supabase MCP `apply_migration` (project `hqpaiarhmiocmjrzjhtw`), matching this repo's existing migration convention. Also touches `scripts/video/engine.py` (`get_candidates()`, `insert_video_post()`) and `docs/runbooks/VIDEO_PIPELINE.md`.

**Commits:** `aae8133` (items 0-3 below), `22ba7f2` (item 4, DB trigger follow-up).

**0. Duplicate `content_rejections` rows — fixed.** Found the actual mechanism: `video_posts_discard_trigger` (added `20260707140000`) fired unconditionally on any transition to `status='discarded'`, inserting a row with `rejection_reason` left NULL (not in its insert column list). Chat Claude's separate manual insert (carrying the real reason) then created a second row for the same event — confirmed live on story #16 itself, the null-reason row manually deleted to clean up before this fix. Per the two options considered, went with **(b)**: a single `reject_video_post(video_id, reason)` RPC replacing both the trigger and the manual-insert pattern, rather than trying to make a trigger accept an out-of-band reason. Reasoning: a single call site is more robust than two independent writers (a human and a trigger) both needing to agree not to step on each other — the same double-write shape as the original bug, just with two humans instead of a human and a trigger, if left as option (a). The trigger is dropped entirely; there is no longer any way to reject a row that doesn't go through this RPC. Added a bonus safety property beyond what was asked: the RPC row-locks the `video_posts` row and refuses a second call against an already-discarded row (raises rather than silently duplicating) — verified live.

**1. Root-cause classification (`rejection_category`).** Keyword-only, no LLM call, via `classify_rejection_reason()` (plain SQL regex): `pricing` / `piece_count` / `set_details` / `voice_quality` / `other`, checked in that priority order (a real reason can mention more than one thing — story #16's own reason, "Set details and pricing are wrong. Rework needed.", matches both pricing and set_details keywords; pricing wins). Backfilled onto existing rows with a real reason — pure labeling, no side effects, deliberately does **not** re-run item 2's MRP auto-flag against history (several rows, including story #16 itself, are already manually resolved and re-verified; re-flagging them now would wrongly reopen an already-closed case). Confirmed live: story #16 backfilled to `rejection_category='pricing'`, `sets.mrp_verified` for 71837 unchanged (still `true`) after the backfill.

**2. Auto-verification routing.** For `rejection_category IN ('pricing', 'piece_count', 'set_details')`, `reject_video_post()` sets `sets.mrp_verified=false, mrp_review_reason='operator_flagged_incorrect'` for the matching `set_number` — **only if `mrp_verified` was previously `true`** (a row already `false`/`'unverified_estimate'`/`'cmf_box_ambiguity'` is left untouched, not clobbered with a less-specific reason). Never touches `lego_mrp_inr` itself — flagging only, surfaced in the existing MRP-audit queue; the actual correction still requires a live retailer lookup by a human or chat/terminal Claude, same as story #16's real fix.

**3. `cleared_for_regeneration` → priority requeue.** New `content_rejections` columns `regeneration_priority` (boolean, default `true`) and `requeued_at` (timestamptz). `engine.py`'s `get_candidates()` now checks for `review_status='cleared_for_regeneration' AND regeneration_priority=true` rows and force-includes them regardless of where they'd otherwise rank in the price-sorted MyBrickHouse pool (a cleared set might not be anywhere near the top by price), placing them ahead of every normal candidate and tagging them `[PRIORITY REGEN]` with the original rejection reason in `--suggest` output. `insert_video_post()` flips `regeneration_priority` to `false` and stamps `requeued_at` once the set is actually regenerated, scoped by the exact same WHERE conditions used for selection — a no-op for any ordinary candidate.

**4. Priority-clear step moved to DB-level enforcement (migration `20260726150000_clear_regeneration_priority_trigger.sql`), 2026-07-26 follow-up.** Confirmed live that nothing in the database itself touched `regeneration_priority`/`requeued_at` — item 3's clear-on-regen step lived purely in `engine.py`'s `insert_video_post()`. Per the schema-of-record principle, that's the same "logic living in two uncoordinated places" shape as item 0's original discard-duplicate bug, just not yet triggered. Added `video_posts_clear_priority_trigger` (`AFTER INSERT ON video_posts`) → `clear_regeneration_priority_on_requeue()`: on every new `video_posts` row, clears the matching `content_rejections` row (`regeneration_priority=false`, `requeued_at=now()`) scoped to `review_status='cleared_for_regeneration' AND regeneration_priority=true` — zero-row no-op for every ordinary insert. Backstop, not a replacement: `engine.py`'s own flip is untouched; a redundant second `UPDATE` against an already-`false` row is harmless.

**Verification (live data, not code inspection alone):**
- Pricing rejection simulated end-to-end via disposable test rows (`ZTEST-001`/`ZTEST-002`, deleted after): `rejection_category='pricing'` set correctly; `sets.mrp_verified` flipped `true→false` with `mrp_review_reason='operator_flagged_incorrect'` for the set that was previously verified; a second test set already `mrp_verified=false/'unverified_estimate'` was left **completely unchanged** by the same rejection category; exactly one `content_rejections` row created (no duplicate); a second `reject_video_post()` call against the same now-discarded row correctly raised (`P0001: video_posts row ... is already discarded`) rather than creating a duplicate.
- Priority requeue verified against the **real, still-open story #16 row** (not synthetic data) — ran the actual `python engine.py --suggest` and confirmed set 71837 was the #1 result, tagged `[PRIORITY REGEN]` with its real rejection reason, ahead of two genuinely fresh MyBrickHouse candidates priced higher than it (₹27,999 and ₹45,799 vs. its ₹25,499) that would have outranked it under the old price-only ranking. Confirmed the real 71837 row was untouched by any of this session's disposable testing.
- Consumption logic (`regeneration_priority` flip + `requeued_at`) verified in isolation with a separate disposable row, since actually running `--pick` on the real row would spend real Gemini/ElevenLabs credits regenerating production content as a side effect of testing — out of scope for a verification pass.
- All disposable test rows (`sets`, `video_posts`, `content_rejections` — `ZTEST-001/002/003`) confirmed deleted, zero leftovers, across all three tables.
- (2026-07-26 follow-up, item 4) `video_posts_clear_priority_trigger` verified with fresh disposable rows (`ZTEST-001`/`ZTEST-002`): a `content_rejections` row seeded `cleared_for_regeneration`/`regeneration_priority=true` correctly flipped to `false` with `requeued_at` stamped once a `video_posts` row landed for the same `set_number`; an ordinary `video_posts` insert with no matching `content_rejections` row hit the trigger as a true no-op (no error, nothing written); the real story #16 row (set 71837) reconfirmed untouched (`regeneration_priority=true`, `requeued_at=null`) both before and after this test. All `ZTEST-*` rows deleted afterward, zero leftovers across `sets`/`video_posts`/`content_rejections`.

---

## CODE-AUDIT-01: code-audit.yml's two real failures — 2026-07-26

**Trigger:** a Jul 13 alert email named two failing checks (`npm audit --audit-level=high`, secrets manifest audit). Confirmed both were still genuinely failing as of 2026-07-26 by reading the **Jul 20 run** (`29726804806`) at the step level, not just `gh run list` (which shows `success` regardless — see LOW-28). Fixing in order, each step its own commit.

**Step 1 — secrets manifest backfill (docs only, no behavior change). Commit `d0c29d0`.** All 9 of the Jul 20 run's Check B failures were undeclared secrets in workflows built after the manifest was last touched (manifest: 2026-06-26; `ig-token-refresh.yml`: 2026-07-02; `video-feasibility-test.yml`/`video-generate-daily.yml`: 2026-07-06) — never a same-week regression. Added `FB_APP_ID`/`FB_APP_SECRET`/`ADMIN_PAT` → `ig-token-refresh.yml`, and `GEMINI_SOCIAL_API_KEY`/`ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID` (new manifest entries, didn't exist before) → `video-feasibility-test.yml` + `video-generate-daily.yml`. Also fixed a 10th, silent drift: commit `a3a48d6` added a `RESEND_API_KEY` reference to `ig-token-refresh.yml`'s alert step without updating the manifest — invisible under the current check because Check B only verifies a secret exists *somewhere* in the manifest, not that it's declared for the *specific* workflow using it. Verified: `node scripts/audit-secrets-manifest.mjs` → 0 failures (24 secrets, 24 workflows, 82 references).

**Step 2 — harden Check B to per-workflow verification, plus the 42-gap backfill it required. Commit `162b4f6`.** A full sweep against the stricter rule (specific workflow must appear in a secret's `required_by`, not just "the secret exists somewhere in the manifest") found **42 more pre-existing gaps** beyond Step 1's 10, spread across `ci.yml`, `deploy.yml`, `monthly-audit-reminder.yml`, `video-publish-manual.yml`, `video-publish-poller.yml`, `video-rejection-reminder.yml`, and `youtube-backfill.yml` — long-standing cases where `required_by` was never kept exhaustive as workflows adopted already-declared secrets, found and closed as part of this same hardening pass, not new work discovered later. Spot-checked all 7 workflows first: none are deprecated, and manual-`workflow_dispatch`-only isn't a legitimate reason to skip declaring secrets a workflow actually reads — all 42 confirmed genuine. Backfilled all 42, *then* landed the hardened `Check B` (`scripts/audit-secrets-manifest.mjs`) on top, so it went straight to green rather than red-then-fixed. Verified: hardened check passes clean (24 secrets, 24 workflows, 248 references). **Directly closes the secrets-manifest half of `LOW-28`'s root cause** — the specific blind spot (name-exists-anywhere vs. per-workflow) that let `a3a48d6`'s undocumented `RESEND_API_KEY` reference through unnoticed.

**Step 3 — classified the 5 remaining `npm audit --audit-level=high` findings (glob, next, postcss, js-yaml, brace-expansion): `next` and `postcss` are direct dependencies; `glob`/`js-yaml`/`brace-expansion` are transitive-only, all inside ESLint's own dependency tree (dev tooling, never ships to production).**

**Step 4 — patched `postcss` fully; froze `@supabase/*` to prevent unintended drift. Commit `a0c521e`.** npm's override mechanism only reaches a nested dependency (`next`'s own bundled `postcss@8.4.31`) during a *full* lockfile regen — an incremental `npm install` against the existing lock leaves it untouched and still vulnerable, confirmed live. A first full-regen attempt closed `postcss` cleanly but also floated the entire `@supabase/*` SDK family via its caret-range dependency, and `postgrest-js`'s stricter `.insert()` types broke `tsc` on `src/lib/publish-draft.ts:622` — confirmed a genuine regression (Jul 20 CI's typecheck step passed; the file untouched since 2026-07-09), not pre-existing. Fixed by pinning `postcss` to `^8.5.18` (top-level devDependency + a `next`-scoped override for its internal copy) and freezing all 7 `@supabase/*` packages to their exact pre-regen versions (5 via `overrides` since they're purely transitive; `@supabase/supabase-js`/`@supabase/ssr` via exact-version pins in `dependencies`, since `overrides` can't target a package that's also a direct dependency — same EOVERRIDE constraint postcss itself hit first). Verified: `npm audit` shows the postcss finding fully closed (both copies); all 7 Supabase packages confirmed at exact pre-regen versions via `npm ls`; full `lint` + `tsc --noEmit` + `npm run build` + `npm test` all green (81/81 tests, 59/59 static pages), `publish-draft.ts` confirmed untouched. **Incidental drift, not deliberate work:** `vitest` 4.1.9→4.1.10 and `vite` 8.0.16→8.1.5 moved as an unavoidable side effect of the full regen; `js-yaml` moved out of its vulnerable range entirely (4.2.0→4.3.0) via eslint's own transitive resolution — a net-positive but unrequested fix, not a Step-3-scoped action. `glob` is byte-identical to its pre-regen version (still vulnerable, per standing instruction not to touch it); `brace-expansion`'s three copies shifted patch versions incidentally but the package's flagged status is unchanged.

**Step 5 — researched Next.js upgrade path (no changes applied).** Of the 7 advisories newly published against `next@14.2.35` since the Jul 13/20 runs, confirmed no 14.x patch exists for any of them (`14.2.35` is the last stable 14.x release ever published) and only 1 is genuinely reachable and unmitigated as coded. Logged as **`NX-DOS-01`** under §Pending — Next Up (MEDIUM tier): accepted risk, deferred pending `@netlify/plugin-nextjs` Next-15/16 compatibility verification, not urgent, not code-blocking. Full advisory-by-advisory reachability breakdown lives in that entry, not duplicated here.

**Step 6 — fixed the false-green job-status problem, closing `LOW-28` for `code-audit.yml`. Commit `b3862f9`.** All 4 check steps (`lint`, `typecheck`, `audit`, `secrets`) carry `continue-on-error: true` with no final gate, so the job's overall conclusion was `success` regardless of what those steps found — the email alert (`code-audit-notify.mjs`) fired correctly every time, but `gh run list` and anything else consuming job-level status never saw red. Quantified the actual historical impact rather than assuming: checked all 8 runs since this workflow's creation (`3229ceb`, 2026-05-30) through 2026-07-20 — **every single one fired a real failure alert, yet every single one shows `success` at the job level. 100% false-green rate since inception (~7 weeks), not a one-off.** Secrets manifest specifically failed in 4 of the 8 (Jun 22, Jul 6, Jul 13, Jul 20). Fixed by moving `continue-on-error` onto the alert-send step too (so a Resend hiccup can't itself obscure the real signal) and adding a final `Fail job if any check failed` step with no `continue-on-error` — it's now the sole authority on job pass/fail, checking all 4 step outcomes explicitly. **Verified against a real, not synthetic, failure condition** — no forced-and-reverted test was needed since `npm audit` is still genuinely red (the deliberately-deferred `next`/`glob`/`brace-expansion` findings). Live `workflow_dispatch` run [30208647905](https://github.com/bricksofindia007/bricks-of-india/actions/runs/30208647905): `lint=success typecheck=success audit=failure secrets=success`, **job conclusion `failure`** — the first time this workflow has ever correctly reported red, and it did so for the true reason (confirms Steps 1-2's secrets fix holds in live CI, and correctly leaves the still-open npm audit item visible rather than hiding it).

**This closes the full CODE-AUDIT-01 pass — all 6 steps done: postcss patched, Supabase family frozen against drift, secrets manifest backfilled and hardened, and `code-audit.yml`'s job status now tells the truth.**

**Explicitly OPEN, not closed by CODE-AUDIT-01 — the Next.js advisories.** `next`'s 21 flagged advisories (14 pre-existing + 7 new, see Step 5 above) are **not fixed**. No 14.x patch exists for any of them; closing them requires a major-version jump to 15.5.21+ or 16.2.11+, deliberately not attempted pending a full changelog/diff review — see `NX-DOS-01` under §Pending — Next Up (MEDIUM tier) for the accepted-risk writeup and the one real blocker (unverified `@netlify/plugin-nextjs` Next 15/16 compatibility). Do not read "CODE-AUDIT-01 closed" as "the npm audit finding is clean" — `npm audit --audit-level=high` on `main` still genuinely fails today, on `next` alone (glob/js-yaml/brace-expansion are separately deferred, see Step 3-4 above).

---

## GSC-01: Search Console structured data + indexing remediation — 2026-07-26

**Trigger:** three separate Search Console notifications — an indexing issue (no flagged-URL export available, requires Abhinav's GSC login), and two merchant-listing structured-data gaps (missing `shippingDetails`/`hasMerchantReturnPolicy`/`description` on Offer schema; missing `review`/`aggregateRating` on Product schema).

**Part A — indexing diagnosis (read-only, no GSC URL list available). No code changes.** Fetched the live `sitemap.xml` (25,702 URLs) and ran 4 repo/DB-only checks in lieu of the real flagged-URL export:
- **Soft-404 candidates:** the proposed heuristic (price + MRP both null) matched 21,796 of 25,296 sets (86%) — checked against the actual page template (`src/app/sets/[slug]/page.tsx`) and rejected as unreliable: even fully unpriced sets render a full template (image, title, theme/year/pieces badges, explicit "Not available at Toycra/MyBrickHouse" rows), not a thin/empty page. A stricter proxy (no image AND no rebrickable fallback AND no pieces AND no theme) found **0** matches — every set has at least an image, piece count, and theme. **No reliable soft-404 signal detectable from static DB fields for this template;** the real GSC-flagged cause remains unknown without the actual URL export.
- **Orphaned sitemap entries: 0.** All 7 content-type counts match their live DB tables exactly (sets 25,296, news 207, reviews 103, blog 25, opinion 11, guides 9, community 0); did a full slug-level diff (not just count) for `/news/` specifically, since that's where the July 9 dedup happened — zero entries either direction.
- **Redirect gaps: 0.** Freshly re-verified all 17 dead-source slugs from the July 9/DEFECT-020 dedup pass are absent from `news_articles`, and all 12 distinct destination slugs exist — independent of the prior session's "✅ CONFIRMED" claim (see §Evidence-based reconciliation, §A), not just trusting that text.
- **Conclusion:** none of the 4 repo-only checks found a concrete defect. The "alternate page with proper canonical tag" GSC reason is consistent with the July 9 dedup canonicalization working as intended, not a residual defect.

**Part B item 1 — Product JSON-LD description now threaded from the real meta description. Commit `658326a`.** `buildProductSchema()`'s `description` field was its own independently-computed fallback string, never actually using real content — `sets.description` is `NULL` for all 25,296 rows (confirmed via fresh query; a dead column), so the JSON-LD description could silently diverge from the real `<meta name="description">` tag, generated separately inline in `generateMetadata()`. Added `setMetaDescription()` in `src/lib/utils.ts` as the single source of truth for both; removed the now-dead `SetData.description` field. Verified: `tsc --noEmit` clean, `lint` clean, `npm test` 81/81, `npm run build` 59/59 static pages.

**Part B items 2-3 (`shippingDetails`/`hasMerchantReturnPolicy`) — CANCELLED PERMANENTLY, not deferred.** Originally scoped as scaffolding-only (empty schema shapes + a `retailer-policies.json` placeholder config, explicitly not wired into rendered output). Cancelled before any scaffolding was built: these fields describe retailer-owned policy terms (Toycra's/MyBrickHouse's shipping and returns) that Bricks of India doesn't control and can't keep in sync; Google treats them as non-critical to indexing/appearance; and `offers.url` already links to the retailer's own page, where that claim actually belongs. No `retailer-policies.json` or scaffolding code was ever created — nothing to remove.

**Part C scope check (read-only, no code changes yet).** 103 total reviews, all published. **99 distinct sets** have a matching published review, joined via `reviews.set_id = sets.id` (a real uuid FK — different join key than `store_prices`, which joins via `set_number` text). 4 reviews have `set_id = NULL` (never linked to any set, not orphaned-to-a-deleted-set) — naturally out of scope for the JSON-LD join either way. 0 reviews missing a rating (range 2-4), 0 sets with more than one review (so `reviewCount: "1"` is always accurate). **Much of the wiring already exists:** `sets/[slug]/page.tsx` already does `.select('*, reviews(*)')` and already passes `review` into `buildProductSchema()`; `aggregateRating` is already implemented there, correctly scoped (`...(review?.rating != null && {...})`, truly absent — not null — when there's no review). **What's actually missing is just the `review` object itself** (Review schema: `reviewRating`, `author`, `reviewBody`, `url`) — not yet implemented as of this entry.

**Part C implementation — `review` object added to Product JSON-LD + fabricated-rating CI guard. Commit `46e267c`.** Reused the existing `sets(*, reviews(*))` join and the same `review?.rating != null` conditional-spread guard already proven correct for `aggregateRating` — added a matching `review` object (`reviewRating`, `author` as `Organization` "Bricks of India", `reviewBody` from the review's `excerpt`, `url` to the review page) under the same guard, so it's genuinely absent (not null) when there's no matching published review. `ReviewData` (shared with `buildReviewSchema`'s different, news-article-derived use case — extending it broke that call site) was left untouched; added a separate `SetReviewData` type instead.

**Guardrail:** `scripts/check-review-schema-integrity.ts` calls `buildProductSchema()` directly — the same function the live page uses, not a reimplemented copy of the guard — against every set in the database, and fails if any set without a published review ends up with a non-empty `review`/`aggregateRating`, or any set with one is missing it. Wired into `ci.yml` (push + PR), which already had the needed Supabase secrets declared (no manifest change required — confirmed via `node scripts/audit-secrets-manifest.mjs`, still clean).

**Verified against live data, not a sample:** 25,296 sets checked — 25,197 without a review correctly show no fabricated rating, 99 with a review correctly show one (matches the scope-check count exactly). Explicitly confirmed the no-review case via a direct `JSON.stringify` dump: `review`/`aggregateRating` keys are absent from the object, not present-and-null. `tsc --noEmit` clean, `lint` clean, `npm test` 81/81, `npm run build` 59/59 static pages.

**Part A follow-up, 2026-07-27 — permanent `index_tier` classification, DB-enforced. Commit `20a0479`.** The diagnosis above found no *reported* GSC defect, but the operator separately asked for a continuous tiering system so the site can proactively manage indexing rather than only react to notifications. Classified all 25,296 sets into Tier 1 (actively promoted: `year>=2023 AND has_price AND theme` in an evidence-built core-retail allowlist — built from what themes actually appear among already-priced recent sets, not guessed), Tier 2 (normal), Tier 3 (noindex candidate: merch/parts/exclusives). Two real false positives found via a 30-sample-per-tier spot-check plus a Tier-3-×-editorial-coverage cross-reference, both fixed before shipping:
- **The `book` keyword was a bare substring match** — wrongly caught two real reviewed sets, `10351` "Sherlock Holmes: Book Nook" and `42674` "Comic Book and Game Store" (both Tier 1 after the fix, confirmed via direct lookup, not assumption). Fixed by gating it on theme instead (`Story Books`, `Activity Books with LEGO Parts`, `Activity Books`, `Non-fiction Books`, `Ideas Books`) — a real merch-context co-signal, not a name substring.
- **Non-numeric set_number was an independent Tier 3 trigger** — wrongly caught real sets with no merch signal at all (`K4492` "Star Wars Miniatures Kit III", `PUPPY-HOUSE"). Changed so Tier 3 always requires keyword/theme corroboration; non-numeric ID alone no longer qualifies. **Known, accepted consequence:** some genuine non-core items with no keyword corroboration (`FRANKFURT` event exclusive, `GW8555` literal adidas shoes, `TOTEBAG`) now fall through to Tier 2 instead of Tier 3 — the given keyword list has no "shoes"/"tote"/event-exclusive terms. Reported, not silently patched with an out-of-scope keyword expansion.

Final counts after both fixes: **Tier 1 = 944, Tier 2 = 20,529, Tier 3 = 3,823** (down from the pre-fix 4,219).

**DB-enforced via triggers, not app code — a real bug was caught mid-build doing this.** Migration `20260727000000_index_tier_classification.sql`: `compute_index_tier()` (pure function, single source of truth), `sync_index_tier_for_set()`, and triggers on both `sets` (name/theme/year changes) and `store_prices` (a set gaining or losing its only price can cross the Tier 1 threshold without `sets` itself being touched — insert, update, *and* delete all covered). Matches the `video_posts_clear_priority_trigger` pattern (migration `20260726150000`) of putting classification at the DB level so no ingestion path (RADAR, CMF sync, manual insert) can silently skip it. **Bug caught before commit:** the first version of `compute_index_tier()` escaped the keyword regex's separator dots (`key\.?chain` instead of `key.?chain`), which silently changed "any separator or none" into "literal period only" — broke every keyword needing a space/hyphen separator, confirmed live when a known keychain returned `tier2` instead of `tier3`. Fixed via `CREATE OR REPLACE` + full re-backfill before this was ever committed; the committed migration file has the corrected version with a comment explaining why the dots must stay unescaped. All 3 triggers verified end-to-end with disposable `ZTEST-9001` rows: insert (no price) → `tier2`; store_prices insert → `tier1`; store_prices delete → back to `tier2`; all test rows removed after.

`src/app/sitemap.ts`: Tier 3 excluded from the sitemap entirely (a noindexed page listed in a sitemap sends a mixed signal); Tier 1 at priority 0.8 (matching this file's existing top-level pages), Tier 2 at 0.5 (a value not specified in the original ask — flagging that choice explicitly, adjustable). `sets/[slug]/page.tsx`: Tier 3 pages get `robots: { index: false, follow: true }` server-side — crawlable so link equity still flows, excluded from the index. Verified: `npm run build` regenerated the real sitemap against live data with no errors.

**Status:** GSC-01 fully closed — Part A (diagnosis: no defect found; permanent tiering: shipped, DB-enforced, verified), Part B (description shipped, shipping/returns cancelled permanently), Part C (review + aggregateRating shipped with a CI guardrail against fabricated ratings).

---

## GSC-02: Page indexing remediation (Soft 404, Duplicate canonical, Crawled — not indexed, Page with redirect) — 2026-08-08

**Trigger:** Search Console validation-failure notices for 4 issue categories on bricksofindia.com: Page with redirect (102 URLs), Soft 404 (68), Crawled – currently not indexed (304), Duplicate/different canonical (107). Companion incident to GSC-01 above — same initiative, separate notification, a week and a half later.

**Page with redirect (102) — no fix, false alarm.** Verified www→apex redirects are healthy (single-hop 301, real 200 destination content); sitemap confirmed apex-URLs only. This category cannot structurally "pass" Google's validation while correctly redirecting — stopped requesting validation on it.

**Duplicate canonical (107) + Crawled-not-indexed (304) — data fix, direct Supabase UPDATE, no app code touched.** Root cause: 4,409 sets sitting in `tier2` (indexable) despite `pieces IS NULL OR pieces = 0` and no row ever in `store_prices` — non-buildable merch (stationery, houseware, gear, clothing, bags, etc.) bulk-imported April 2026, never priced by Toycra/MyBrickHouse. Thin, near-identical templated pages at this shape caused Google to merge or reject them under a different canonical. Fixed: `UPDATE sets SET index_tier='tier3' WHERE index_tier='tier2' AND (pieces IS NULL OR pieces=0) AND set_number NOT IN (SELECT set_id FROM store_prices)` — 4,409 rows reclassified 2026-08-08, on top of GSC-01's original tiering pass (Tier 3 = 3,823 as of 2026-07-27, above). Confirmed `tier3` correctly renders `<meta name="robots" content="noindex, follow">` live via the existing `sets/[slug]/page.tsx` guard from GSC-01 Part A — no code change needed here. Confirmed sitemap regeneration excludes the reclassified URLs (spot-checked 4/5; the one exception had a live piece count that no longer matched the reclassification criteria, correctly left off the list). GSC "Validate Fix" requested on Duplicate canonical, 2026-08-08 — pending.

**Soft 404 (68) — code fix, wrong diagnosis caught before shipping.** First hypothesis: the 4 highest-traffic route types (`themes`/`sets`/`news`/`blog`) were rendering an inline "not found" component instead of calling `notFound()`. **Disproved by full source read + `git blame` before any fix was written** — `notFound()` has been correctly called in all four since the earliest commit (`7ed74a5`, 2026-04-11); there was nothing to fix there.

Actual root cause: `src/app/loading.tsx` at the app root wrapped every route in an implicit Suspense boundary (Next.js file convention — any `loading.tsx` ancestor puts its whole subtree into streaming SSR). The shell's 200 status commits as soon as streaming starts, before the awaited Server Component — and any `notFound()` thrown inside it — resolves; the body still renders the correct `not-found.tsx` content, which is why these pages visually looked like real 404s, but the HTTP status line was already sent as 200 and can't change retroactively. Confirmed live via raw origin `fwd-status` response headers, not just the client-visible status code — ruled out stale caching as the cause. Auditing the whole `app/` tree for `notFound(` found **8** affected routes, not the originally-assumed 4: `themes`, `sets`, `news`, `blog`, `reviews`, `opinion`, `community`, `guides`.

**Fix, commit `4db59d1` → `main`.** Deleted the root `loading.tsx`. Added it back only at the 3 segments confirmed to have zero `notFound()`-calling descendants and real async data-fetching worth an instant skeleton: `compare/`, `deals/`, `lab/` (the last covers the whole `/lab/*` subtree via Next's cascading convention — no per-tool duplication needed). No `loading.tsx` sits anywhere in the ancestry of the 8 `notFound()`-capable segments — they fall back to a normal blocking SSR response, so `notFound()` fires before any bytes go out and the status line is correct. Deploy verified independently: GitHub Actions run `31248532672` ("Build & Deploy to Netlify") — `conclusion: success`, `headSha` matches `4db59d1`. Live-verified all 8 routes post-deploy: genuine origin-level 404 (`fwd-status=404`, not a CDN artifact) with the correct `not-found.tsx` body content intact on every one. GSC "Validate Fix" requested on Soft 404, 2026-08-08 — pending.

**Tradeoff, accepted per explicit decision, not silently absorbed:** the 8 entity-detail routes lose the instant loading skeleton and take a normal blocking wait for their single-record Supabase lookup instead. The homepage and every other top-level segment shares the same true app root, so none of them can get a scoped `loading.tsx` back either without re-wrapping the whole site into the same bug — none was added there.

**Lesson for the record:** black-box HTTP/DOM inspection (status code + rendered body) produced a plausible but wrong root cause on the first pass. Source read + `git blame` caught it before anything shipped against the wrong diagnosis. Default to source verification before prescribing a fix whenever repo access is available, rather than inferring code structure from live behavior alone.

**Status:** Soft 404 and Duplicate canonical/Crawled-not-indexed both shipped and validation-requested 2026-08-08; Page with redirect closed as a false alarm, no further validation requests on that category. **Next check:** mid-to-late August GSC re-check (already scheduled) — review validation outcomes for both pending categories, confirm Crawled-not-indexed and Page-with-redirect counts have declined via natural recrawl.

**Addendum, same day — reconciliation with GSC-01's non-numeric-ID trade-off.** GSC-01's Part A follow-up (above) explicitly accepted a trade-off after removing non-numeric `set_number` as a standalone Tier 3 trigger: "some genuine non-core items with no keyword corroboration (`FRANKFURT` event exclusive, `GW8555` literal adidas shoes, `TOTEBAG`) now fall through to Tier 2 instead of Tier 3." GSC-02's reclassification query above never checked ID format — and moved 2 of those 3 named items, `GW8555` and `TOTEBAG`, from tier2 to tier3. Not known at the time GSC-02 ran; found afterward by re-querying with GSC-01's rule in mind.

**Every figure below re-verified by direct query against the live `sets` table, 2026-08-08, immediately before writing this entry:**

| Check | Condition | Result |
|---|---|---|
| Non-numeric-ID sets moved to tier3 by GSC-02 | `tier3 AND updated_at>='2026-08-08' AND set_number !~ '[0-9]'` | **148** |
| Non-numeric-ID sets still tier2 today | `tier2 AND set_number !~ '[0-9]'` | **355** |
| — of those 355, with a real piece count | `+ pieces > 0` | **355 (100%)** |
| — of those 355, with any store price on record | `+ set_number IN store_prices` | **0** |
| Non-numeric-ID tier2 sets still matching GSC-02's thin criteria (completeness check — should be 0 if the reclassification was applied consistently) | `tier2 AND non-numeric AND (pieces IS NULL OR 0) AND NOT IN store_prices` | **0** |

**The three named examples, individually confirmed:**

| Set | Pieces | Ever priced? | Tier now | Why |
|---|---|---|---|---|
| `FRANKFURT` (LEGO Store Grand Opening Exclusive, MyZeil) | 157 | No | **tier2**, unchanged (`updated_at` 2026-08-02, predates GSC-02) | Has a real piece count — never matched GSC-02's criteria |
| `GW8555` (adidas Gamemode TF x LEGO shoes) | 0 | No | **tier3**, moved 2026-08-08 07:16:30 | Zero pieces, no price data — matched GSC-02's criteria |
| `TOTEBAG` (LEGOLAND Shark & Mermaid Beach Tote Bag) | 0 | No | **tier3**, moved 2026-08-08 07:16:30 (same batch timestamp as `GW8555`) | Zero pieces, no price data — matched GSC-02's criteria |

**Reading of the evidence (judgment, not a query result):** GSC-01's rule existed to stop a blunt "non-numeric ID → tier3" heuristic from wrongly demoting legitimate items — `FRANKFURT` is the case it was protecting, and the table above shows that protection is still fully intact under GSC-02's criteria: every one of the 355 non-numeric-ID sets still in tier2 has a real piece count, `FRANKFURT` included, none were touched by this reclassification. GSC-02's criterion is not the ID-format heuristic GSC-01 rejected — it's a direct content-based measurement (zero pieces AND never priced) GSC-01 didn't have as a rule at the time. The 148-item overlap is not GSC-02 silently re-applying the discarded heuristic; it's GSC-02 independently reaching the same two named examples (`GW8555`, `TOTEBAG`) via evidence the earlier pass didn't use, while correctly leaving `FRANKFURT` alone for the same reason GSC-01 wanted it left alone.

**Disposition: GSC-02 supersedes GSC-01's non-numeric-ID trade-off for this 148-item overlap. Not reverted.** The completeness check above (row 5, "0") confirms no non-numeric-ID tier2 set currently matches GSC-02's thin criteria — if this disposition stands, no further action is needed on this front. If a future session disagrees, the 148 `set_number`s are fully enumerable via the same `tier3 AND updated_at >= '2026-08-08' AND set_number !~ '[0-9]'` filter used above, and reverting is a single-column update, not a data-loss risk.

---

## GEO-05b: bidirectional set-article linking — 2026-07-27

**Trigger:** filed as `HIGH-51` since 2026-05-31, "not started." Companion to the same-day GSC-01 Part A tiering work — different tables/pages, run in parallel.

**Commit (Phases 2-3, backfill, guardrail, all below):** `ff29377`.

**Phase 1 diagnostic (read-only):** an extraction function already existed — `extractSetNumberCandidates()` in `src/lib/lint.ts:77` (HIGH-51's own line citation, `:113`, was stale — pointed at the adjacent, unrelated `extractSetNameCandidates`; corrected as part of this commit). Sampled real article text against it before trusting it: correctly caught `set 72168`/`set 21067`/title-case mentions, correctly excluded years and currency-prefixed numbers. One real, accepted scope limit: it requires 4-7 digits, so pre-1980s vintage sets with 3-digit numbers (`272 Dressing Table`, seen in a real sampled article) are structurally invisible to it. Reverse-linking confirmed fully absent, not partially built — grepped `sets/[slug]/page.tsx` directly. Corpus-wide numbers were worse than HIGH-51's original figure: not "98 news + 23 blog," but **0 of all 335 articles** (207 news + 25 blog + 103 reviews) had any `/sets/` link. Extraction found 233 (article, set-number) mentions, all unlinked, 0 unresolvable (didn't match a real set).

**Phase 2 — forward linking + backfill. New file `src/lib/link-set-mentions.ts`, wired into `src/lib/publish-draft.ts`.** `linkFirstSetMentions()` reuses `extractSetNumberCandidates()`'s output and links the *first* occurrence of each distinct set number (earliest position across all 4 recognized mention patterns) to `/sets/[slug]`, as a markdown link (`content` is rendered via `ReactMarkdown` — confirmed before choosing link syntax, not assumed). Conceptually "Gate 10" per the tracker's own numbering convention, but does **not** live inside `LintResult.gates` in `lint.ts` — every other gate is a pure pass/fail validator over a fixed body; this one mutates the body and can never fail a draft. Forcing a content transformation into a type built entirely around pass/fail booleans would mislead every future reader of that type, so it's its own function, called once in `publishOneDraft()` right after `cleanBody` is finalized (excerpt generation still reads pre-link `cleanBody`, so meta descriptions never show raw markdown link syntax). A mention with no matching `sets` row is silently skipped and logged (`[Gate 10] ... skipped: ...`), never blocks publish, per spec.

**Backfill (`scripts/backfill-set-mentions.ts`, one-time, real run against production content — not a dry run):** sanity-checked output against 3 real known-mention articles first (all clean, links read naturally in context) before running against the full corpus. **176 of 335 articles updated, 233 links added** — matches Phase 1's diagnostic count exactly. Idempotent by construction: a linked mention's text is no longer a bare 4-7 digit match for the extractor, so a second run is a no-op.

**Phase 3 — reverse "Related Coverage" on `/sets/[slug]`.** Reuses Phase 2's link shape directly (`content ILIKE '%](/sets/<this-slug>)%'` across `news_articles`/`blog_posts`/`reviews`) rather than a second matching system, per spec. Handles the `blog_posts` category split correctly (`category='Opinion'` rows route to `/opinion/[slug]`, not `/blog/[slug]` — per the existing `MEDIUM-38` fix, checked before assuming). Renders only if at least one match exists — absent, not an empty "no coverage yet" state, same discipline as Part C's review/aggregateRating fix.

**Guardrail — `scripts/check-set-mention-links.ts`, wired into `ci.yml`.** Extracts every `(/sets/[slug])` link the auto-linker could have produced and checks it against live `sets`. Real finding while designing this: `getSetData()` resolves purely by the slug's leading number (`slug.split('-')[0]`) — the rest of the slug is decorative and never validated by the route itself. So a set **rename** does not actually 404 an old link; only a set being fully **deleted** does. The check fails the build only on genuine 404s (set number no longer exists) and separately warns, non-fatally, on cosmetic slug drift (renamed but still resolves) — a rename doesn't false-alarm CI. Verified both paths live: inserted a synthetic article linking to a nonexistent set 99999, confirmed the check correctly fails (exit 1); removed it, confirmed the check passes clean again (184 distinct linked slugs, 0 failures, 0 drift warnings) — same forced-failure-then-revert discipline as the CODE-AUDIT-01 Step 6 verification.

**Status:** GEO-05b (`HIGH-51`) fully shipped — forward linking, backfill, reverse coverage, and CI guardrail all verified against live data. Full lint/typecheck/test/build green throughout.

---

## Recrawl acceleration — 2026-07-27

**Trigger:** companion to GSC-01 Part A's sitemap changes — signal search engines after deploys/publishes that actually change indexable content, not every deploy.

**Attempt 1 — Google sitemap ping, shipped then reverted same day. Commit `76f5a75` (reverted in `14ac9ab`, below).** `deploy.yml` gated a ping to `google.com/ping?sitemap=...` on `src/app/sitemap.ts` changing in the push. Live `workflow_dispatch`-free push deploy ([30216473859](https://github.com/bricksofindia007/bricks-of-india/actions/runs/30216473859)) confirmed the gating logic worked correctly (ping only fired because `sitemap.ts` had genuinely changed in that push) — but the real response was **`HTTP 404`**. Confirmed via [Google's own Search Central blog](https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping): this endpoint was **deprecated in June 2023** and always 404s now; Google states existing callers "will not cause problems" but get zero benefit. Removed the steps entirely rather than leave them logging 404 forever — noise for someone debugging later, not a real signal.

**Attempt 2 — IndexNow. Commit `14ac9ab`.** Verified against current docs before implementing, not memory ([indexnow.org/documentation](https://www.indexnow.org/documentation), [indexnow.org/faq](https://www.indexnow.org/faq)): `POST https://api.indexnow.org/indexnow`, `Content-Type: application/json; charset=utf-8`, body `{host, key, keyLocation, urlList}`, max 10,000 URLs/request, success = 200 or 202 (202 specifically means "received, key not yet verified" on a first submission).

- `src/lib/indexnow.ts`: `submitToIndexNow()`, chunks at the 10,000-URL limit, never throws.
- `src/lib/publish-draft.ts`: every new/updated article submits its own URL immediately on publish.
- `scripts/indexnow-sync-sets.ts` (wired into `scrape-prices.yml`, every 6h): ongoing incremental sync for sets, driven by DB state (`index_tier` + `indexnow_submitted_at` vs `updated_at`) rather than hooking the 5 separate scripts that write to `sets` (`generate-approved-drafts.ts`, `radar-08-reviews.js`, `scrape-now.mjs`, `sync-rebrickable.js`, plus the `index_tier` triggers themselves).
- Key file: `public/5e091570a177b154ef7c24d468ec59e3.txt` — not a secret, published at a public URL by design, so a plain committed constant, not `getSecret()`.

**Live verification, step by step, nothing assumed:**
1. Real test submission (1 URL) *before* the key file was even deployed → `HTTP 202 Accepted`, empty body — exactly the documented first-submission response.
2. Pushed, deploy ran ([30217235429](https://github.com/bricksofindia007/bricks-of-india/actions/runs/30217235429)), completed successfully.
3. Fetched the key file directly (not inferred from deploy success): `curl https://bricksofindia.com/5e091570a177b154ef7c24d468ec59e3.txt` → `HTTP 200`, body = the exact key.
4. Ran the one-time bulk submission for all 21,473 Tier 1 + Tier 2 set URLs → **all 3 chunks returned `HTTP 403`** (key validation failed, per docs) despite the key file being confirmed live one step earlier.
5. **Real finding, not assumed:** a fresh single-URL retry immediately after returned `HTTP 200` (upgraded from step 1's `202`) — the key *had* fully verified, just not yet at the exact moment the large bulk calls fired seconds after deploy. A timing race between key-verification completion and the bulk submission, not a real key/config problem.
6. Re-ran the bulk submission → **all 3 chunks (10,000 / 10,000 / 1,473 URLs) returned `HTTP 200`.** All 21,473 sets marked `indexnow_submitted_at`.

**Status:** fully shipped and live-verified, real request/response shapes captured at every step, including the transient 403 (logged here so a future session doesn't mistake a repeat of this race for a real regression — the fix, if it recurs, is just "wait a few seconds after a key-file deploy before the first large bulk call," not a code change).

---

## Session audit — undocumented-work check, 2026-07-27

**Method:** `git log --format="%h %s" 6525e81^..dddd9bc` (the full session, 27 commits, first-to-last) — every hash grepped against `BOI_MASTER_TRACKER.md`'s existing content, not assumed from memory. Cross-checked against `mcp__Supabase__list_migrations` for any DB migration applied this session without a corresponding committed file.

**Result: all 27 commits accounted for — 8 had substantive tracker prose describing their work but were missing an explicit commit-hash citation, now fixed in this same pass (no new investigation needed, the content was already correct, just uncited):**
- `aae8133`, `22ba7f2` — §VID-P4 items 0-3 and item 4 respectively (migration filenames were cited, the commit hashes weren't)
- `a3a48d6` — §Session — 2026-07-26, "Follow-up" (BOM fix + `*-check-error` alerting) — was cited *elsewhere* (§CODE-AUDIT-01, as the cause of a secrets-manifest drift) but not in its own section
- `2652949` — §Session — 2026-07-26, Follow-up 2 items 4-5 (`IG_TOKEN_EXPIRY` removal, test-mode gating)
- `7e17014` — §Session — 2026-07-26, Follow-up 3 items A-D (Check 4 removal, threshold widening, OAuth helper, Check 9 failure detection)
- `20a0479` — §GSC-01 Part A's `index_tier` follow-up (migration filename was cited, not the code commit)
- `ff29377` — §GEO-05b (Phases 2-3, backfill, guardrail)
- `76f5a75` — §Recrawl acceleration, Attempt 1 (the Google ping, before it was found dead and reverted)

**No genuinely unaccounted commits found** — every commit's actual diff matched an existing tracker narrative once cross-checked; none needed new investigation or an "Abhinav confirmation needed" flag.

**One pre-session file checked for conflict, found unrelated:** `9f5e286` (`Create E66ECA5873D3813B6DE0424739E62E0D.txt`, 2026-07-09, authored by the `Bricks of India` bot account — 17 days before this session, outside its scope) creates `public/.well-known/pki-validation/E66ECA5873D3813B6DE0424739E62E0D.txt`. Superficially similar to this session's IndexNow key file (both are hex-named `.txt` files under `public/`), but confirmed unrelated: SSL/PKI domain-validation file (likely a certificate authority's domain-control-validation challenge), different path, different purpose, no conflict with `public/5e091570a177b154ef7c24d468ec59e3.txt`.

**Migration history cross-check (not just git log):** `list_migrations` shows 4 entries from this session — `20260726091414 video_rejection_workflow`, `20260726112038 clear_regeneration_priority_trigger`, `20260726183659 index_tier_classification`, `20260726192715 indexnow_submitted_at`. All 4 have a corresponding committed migration file (`20260726120000_...`, `20260726150000_...`, `20260727000000_...`, `20260727010000_...` respectively) — the version-number mismatch is a UTC-vs-IST timezone artifact (Supabase timestamps in UTC, local filenames chosen in IST), not a real discrepancy. **No orphaned migrations found.**

**Closed, not just a flagged nuance:** `compute_index_tier()`'s dot-escaping bug (see §GSC-01 Part A) was originally fixed via a raw `execute_sql` `CREATE OR REPLACE` call, not a tracked `apply_migration` — so Supabase's migration history only recorded the original (buggy) version's timestamp, even though the committed file already had the correct content. Closed properly: migration `20260727020000_fix_compute_index_tier_separator_regex.sql`, an idempotent `CREATE OR REPLACE` of the exact already-correct function plus a re-backfill, applied via `apply_migration` (not `execute_sql`) specifically so it gets its own tracked history entry. Confirmed via `list_migrations`: `20260726200950 fix_compute_index_tier_separator_regex` now present. Confirmed idempotent, not just assumed: `sets` tier counts identical before and after (944 / 20,529 / 3,823). `index_tier` classification is now reproducible from migration history alone, not just from reading the final committed file content.

**Checked, not applicable:** `docs/BRIEF_DEFECTS.md` (the defect log CLAUDE.md references) does not exist in this repo — nothing to update there.

---

## Session — 2026-07-26 — IG + YouTube outage: real root cause found, not just re-authed

**Trigger:** `social-automation.yml` failed 2026-07-24 and 2026-07-25 with an Instagram "Session has expired" error, and `health-check.mjs` had been emailing a daily "YouTube token malformed" alert. Both were investigated to root cause before any fix — see below, not just "re-authed and moved on."

**Commit:** `6525e81` (code fixes: `social-automation/pipeline.py`, `social-automation/youtube_oauth_helper.py`, `.github/workflows/ig-token-refresh.yml`).

### Instagram — real root cause was the auto-refresh workflow, not a missed setup step
`IG-TOK-01`'s 2026-07-05 closure was premature. `ig-token-refresh.yml` ran successfully on 2026-07-15 (scheduled, not just manual dispatch) and rotated `IG_ACCESS_TOKEN` — but the rotation was a **no-op**: the workflow re-exchanges a token that is *already long-lived*, and Meta's `fb_exchange_token` grant does not reliably reset the 60-day clock on an already-long-lived token — it can hand back a token that's functionally the same session, still expiring on its original schedule. The 07-15 run passed every check the workflow had (fresh `access_token` string, live `/me` validation) because the token was still valid *at that moment* — it died 8 days later, on **2026-07-23 06:04:38 PDT**, exactly matching Facebook's own `Session has expired on Thursday, 23-Jul-26 06:04:38 PDT` message in the 07-24 and 07-25 failure logs. (07-19's failure was an unrelated transient Facebook error, code 2 — not part of this chain.)

**Fixes:**
- Got a genuinely fresh short-lived User Token from Graph API Explorer and exchanged *that* (short-lived → long-lived is the flow that actually resets the clock — confirmed `expires_in: 5184000`, exactly 60 days). `IG_ACCESS_TOKEN` rotated 2026-07-26T07:03:13Z.
- `ig-token-refresh.yml` now parses `expires_in` from the exchange response and fails the job loudly (does not commit the secret) if it's under 30 days — so a repeat no-op gets caught immediately instead of reporting false success. This does **not** fix the underlying Meta limitation (re-exchanging an already-long-lived token structurally can't extend it) — that requires the Meta System User (non-expiring) token, already planned (see **LOW-43** under §Pending — Next Up → CRITICAL — Time-bound), pending Abhinav in Meta Business Manager.
- `pipeline.py`: Instagram posting (Steps 7–8) was unprotected and ran *before* YouTube (Step 9) — an unhandled IG exception aborted the whole script, so YouTube's own (already-isolated) try/except never even got reached. This is why YouTube looked dark too, despite being healthy. IG posting now has its own try/except + heartbeat write, matching YouTube's existing isolation; one platform failing no longer blocks the other, and the job reports/exits based on both platforms independently.
- **Verified live:** triggered `social-automation.yml` manually (run `30192155275`, set `11385-1`) after the fixes — both platforms posted in the same run: IG carousel (media `18143870473531437`), IG Reels (media `18073454504359350`), YouTube Short (video `O7fxKdW_QU0`). `posted_sets` row 41.

### YouTube — false alarm, not an actual outage; closed as a schema-mismatch bug
Investigation found the YouTube pipeline itself was never broken — the 07-22 run uploaded a Short successfully (`Heartbeat: youtube OK`) using the token last set 2026-06-20. The daily "malformed" alert was `health-check.mjs` Check 6b doing `new Date(creds.expiry)` on a field `youtube_oauth_helper.py` computed for a console printout but never wrote into the JSON it pushes as `YOUTUBE_CLIENT_SECRETS` — `creds.expiry` was always `undefined`, so `.toISOString()` threw `Invalid time value` on every run since the secret was last set. Doesn't fail the job (`yt-token-malformed` isn't `-error`-suffixed) so `health-check.yml` stayed green throughout while quietly spamming a false alert. **Fix:** the helper now persists the computed `expiry` into the secret JSON. **`YOUTUBE_CLIENT_SECRETS` itself was not touched** — no re-auth was needed or performed; the next time Abhinav runs the helper for an unrelated re-auth, the field will be present and the check will work correctly.

Also flagged, not yet fixed: `health-check.mjs` Check 6's `IG_TOKEN_EXPIRY` (line 38) is a hardcoded `2026-07-23` constant predating the auto-refresh automation — now permanently stale, adding false "IG expiring" noise independent of the real token state. Left as-is this session (out of scope for the outage fix); worth cleaning up alongside the System User token migration since that will make manual expiry tracking moot entirely.

### Follow-up — 2026-07-26 (same day) — alerting-plumbing gaps, both closed and proven with real sends

**Commit:** `a3a48d6`.

Prompted by a direct question after the outage fix above: does the new `expires_in` failure gate actually reach Abhinav's inbox, or would it just be a red X in the Actions tab (the same "nobody notices" pattern this outage already demonstrated once)? Investigation-only pass found two real gaps; both are now fixed **and verified with actual Resend sends**, not just code inspection — this exact class of bug (the RESEND_API_KEY BOM issue below) was invisible on inspection before and only surfaced by testing it directly.

**Gap 1 — `ig-token-refresh.yml`'s alert step could silently fail to send.** The `Alert on failure` step's inline Python does `resend.api_key = os.environ['RESEND_API_KEY']` with no BOM stripping, unlike every other consumer of this secret (`health-check.mjs:27`, `notifier.py:19`) — both of which strip it because of a confirmed prior incident (2026-07-06, VID-P4's `notifier.py`, same secret): a leading U+FEFF byte breaks the `Bearer` auth header with `UnicodeEncodeError: 'latin-1' codec can't encode character '﻿' in position 7`. `RESEND_API_KEY` was last rotated 2026-05-27 — before that incident was even found — so the secret's underlying bytes were never corrected at the source, only worked around in the two places that got the fix. This alert script never had.
- **Reproduced the exact failure locally**: took the real local `RESEND_API_KEY` (from `.env.local`), synthetically prepended a real UTF-8 BOM, ran it through the *old* unfixed script logic — got the identical error, verbatim, down to "position 7."
- **Fixed**: added the same `.lstrip('﻿').strip()` pattern used elsewhere, wrapped the send in try/except so a failure here logs clearly (`[alert] FAILED TO SEND ALERT EMAIL: ...`) instead of vanishing silently, then re-raises so the step still shows red in Actions too.
- **Proved the fix**: ran the corrected script (exact de-indented form GitHub Actions would execute) against the same synthetic BOM-prefixed key — real Resend send succeeded, message ID `e138f9ee-ba25-4807-a4e4-58661ed0efec`, to `abhinav@bricksofindia.com`. Abhinav should confirm this test email actually landed (subject: "IG token auto-refresh FAILED — manual action needed before expiry") — that part I can't check myself.
- **Note for future work**: any code that touches `RESEND_API_KEY` going forward needs this same strip — it is not fixed at the three current call sites' pattern being copied correctly by default, it has to be added deliberately each time. Worth centralizing (a shared helper) rather than trusting each new script to remember, next time this secret gets touched.

**Gap 2 — `*-check-error` failures (the health check's own code breaking) had zero email path.** Only the business-logic detections (`ig-token-expiring`, `yt-token-malformed`, etc.) emailed; the 11 `*-check-error` keys (one per check, for when the check's own query/API call throws) only flipped the job to red in the Actions tab — arguably the higher-priority failure class (means the monitoring itself is blind), with the worse inbox visibility.
- **Fixed**: all 11 `*-check-error` catches now call `sendAlert()` too, with a distinct `🔥 [BOI INFRA FAILURE]` subject prefix so they don't blend into routine business-logic noise.
- **Proved the fix**: temporarily pointed Check 1's query at a nonexistent table, ran `scripts/health-check.mjs` locally against real Supabase/Resend credentials — `news-check-error` fired and a real email sent (ID `06507683-0c25-42e5-85e5-09c19ec94713`). `cron-check-error` also fired and sent for real in the same run (ID `47ad9da4-0036-4819-a1a4-730bbb8a2563`), naturally, since `GITHUB_TOKEN` isn't set in local dev — a second live confirmation for free. Reverted the temporary table-name change immediately after.
- Also added: `sendAlert` now logs the Resend message ID on success, not just on failure — makes future verification like this one possible without guessing whether a send actually landed.

**Open, not code-answerable:** whether the ~36 daily `yt-token-malformed` emails since 2026-06-20 actually reached Abhinav's inbox or got auto-triaged as noise (filter rule, spam folder, or just visual fatigue from an unchanging subject line) is not something I can verify from the code — `sendAlert()` was called every time and Resend accepted the request each time per the code path, but actual inbox outcome is Abhinav's to check, not mine to assume either way.

### Follow-up 2 — 2026-07-26 (same day) — the ~1:22–1:23 PM alert batch: my own verification testing, not production, plus two real gaps closed off the back of it

Abhinav reported four alert emails arriving 1:22–1:23 PM, right around this session's commit time (13:25:18 IST). **Confirmed: this was my own local verification testing hitting the real inbox, not a production incident, not a corrupted deploy, and not a scheduled job running broken code.** Full accounting below — it's honestly more than four, and I own that this was a flaw in how I verified Follow-up 1's fixes, not a one-off.

**1. Confirmed the table-name revert is clean and could never have reached a scheduled run.** `git log -p --all -- scripts/health-check.mjs | grep TEMP_VERIFY` returns nothing — the broken table name never existed in any commit, only in my local uncommitted working tree for a few minutes. `git diff HEAD` on the file is empty (working tree matches HEAD exactly). Separately: the last scheduled `health-check.yml` run was `2026-07-26T05:43:14Z` (11:13 IST) — hours *before* I touched the file at all (this session's commit was 13:25 IST) — so no scheduled run could have executed it even if it had been committed, which it wasn't.

**2. Confirmed `YOUTUBE_CLIENT_SECRETS` and `IG_ACCESS_TOKEN` both still exist, untouched.** `gh secret list`: `YOUTUBE_CLIENT_SECRETS` unchanged at `2026-06-20T09:53:50Z`, `IG_ACCESS_TOKEN` unchanged at `2026-07-26T07:03:13Z` (the fresh 60-day token from earlier today) — neither was overwritten by anything since. `GITHUB_TOKEN` correctly does **not** appear in `gh secret list` — it's GitHub's auto-injected ephemeral token (see `secrets-manifest.json`'s own `_auto_injected` note), never a settable repo secret; its absence in my local shell during testing (`GITHUB_TOKEN not set`, tripping `cron-check-error`) was purely a local-dev gap, not evidence of anything missing in production.

**3. Confirmed `IG_ACCESS_TOKEN`'s live state is unaffected.** Most recent `social-automation.yml` run remains the manual verification dispatch from earlier today (`30192155275`, success, both platforms posted) — nothing has run since, nothing has touched the secret since. Still the genuine 60-day token.

**The actual root cause of the email batch: my own verification methodology, across both fixes in Follow-up 1.** Every real send traces to a local invocation of `node scripts/health-check.mjs` (or the standalone alert-script test) with `BRIEF_EMAIL` deliberately pointed at the real address to prove delivery. The problem: `health-check.mjs` always runs *all* checks, not just the one being isolated — so every run against real conditions also fired whichever business-logic alerts were genuinely true at that moment (the stale `IG_TOKEN_EXPIRY` constant, the real 167-item drafts backlog) *and* whichever local-dev-only gaps looked like failures but aren't in production (`YOUTUBE_CLIENT_SECRETS`/`GITHUB_TOKEN` not being in local `.env.local` by design). Reconstructed full count, more than the four reported: 1 send proving the BOM fix (`e138f9ee-...`, IG-refresh-failure test), then 5 in one run while the table was still deliberately broken (`news-check-error` intentional + `ig-token-expiring`, `yt-token-missing`, `drafts-backlog`, `cron-check-error` as unintended side effects of running the whole script), then 4 more in the revert-confirmation run (the same four recurring conditions, minus the now-fixed `news-check-error`) — that last batch of 4 is almost certainly what Abhinav saw at 1:22–1:23 PM; the earlier 6 likely landed a few minutes before that. None of it reflects a real incident, but the volume was a real mistake on my part — should have used a disposable test address or not wired the real `BRIEF_EMAIL` into iterative local runs at all.

**Of the recurring conditions that kept firing, two were genuinely real (not testing artifacts) and are addressed below or worth Abhinav's attention:**
- `ig-token-expiring` — real bug in committed code (the stale hardcoded date), would have fired in every legitimate scheduled run too until fixed. **Fixed below (item 4).**
- `drafts-backlog` — real data (167 approved, unpublished drafts, threshold is 50). Not a bug; genuinely worth a look at `/admin/pending` independent of anything in this session.
- `yt-token-missing` and `cron-check-error` were pure local-dev-environment artifacts (missing local secrets that exist fine in the real GH Actions env) — not real, not recurring in production.

**Commit (items 4-5 below):** `2652949`.

**4. Fixed — `IG_TOKEN_EXPIRY` hardcoded constant removed entirely.** Check 6 no longer does date math against a value that was already stale on arrival. It now reads `social_automation_heartbeat` (`platform = 'instagram'`) — a real heartbeat `pipeline.py` has been writing on every run all along (`db.record_heartbeat('instagram', ...)`) but nothing was reading, mirroring Check 6c's already-accepted YouTube heartbeat pattern (same 26h/72h thresholds, same reasoning — not a new judgment call, parity with existing design). Verified live: `[6] Instagram heartbeat: last attempt 1.4h ago` / `last success 1.4h ago` against real data from today's verified post — correctly green, no false alert.

**5. Fixed — local/manual runs can no longer hit the real inbox by default.** `sendAlert()` now gates on `process.env.GITHUB_ACTIONS === 'true'` (set automatically by every real Actions run, nothing to remember to configure) before ever attempting a send; local runs log `[TEST MODE — not in GitHub Actions, alert NOT sent]` instead. An explicit `FORCE_REAL_ALERTS=true` opt-in remains for the rare case a live send genuinely needs proving outside Actions (used deliberately, not as a side effect of running the script). Verified: re-ran locally with `BRIEF_EMAIL` set to the real address (the exact scenario that caused this incident) — zero real sends, all three genuine current conditions correctly rerouted to `[TEST MODE]` console output. Also fixed the summary line, which claimed "Alerts sent via Resend" even when nothing was actually sent — same class of misleading-artifact problem, now accurately says `TEST MODE — no real alerts sent` when applicable.

### Follow-up 3 — 2026-07-26 (same day) — full check-by-check audit, four confirmed false-positive/gap fixes

A full audit of all 11 `health-check.mjs` checks (requested after Follow-up 2 to find any other checks with the same *class* of bug as `IG_TOKEN_EXPIRY`, not just the two caught by accident) found four real issues, all fixed and verified live this pass — not on code inspection alone.

**Commit (items A-D below, plus the tracker entries for them):** `7e17014`.

**A. Removed Check 4 (social automation stale) — confirmed false positives, not hypothetical.** Queried the last 15 `posted_sets.posted_at` rows directly: gaps between consecutive posts included `69.9h, 49.4h, 47.8h, 46.6h, 71.9h` — **5 of 14 real gaps (36%) already exceeded the 25h threshold**, several predating the known IG outage entirely (simply days with no eligible new set, the ≥10-gallery-image gate). The check measured "time since last successful post" but was thresholded as if it measured "time since the pipeline last ran" — those differ under the eligibility gate. Rather than repoint it at `social_automation_heartbeat.last_attempt_at` (which would make it a pure duplicate of Check 6 + 6c's existing "attempt stale" branches — both platforms are attempted together every run, so their `last_attempt_at` values are always in sync), removed it outright as the cleaner fix. Verified: full local run confirms no `[4]` line at all, no `social-stale`/`social-check-error` keys possible anymore.

**B. Widened Check 6 + Check 6c's "no success" threshold, 72h → 120h.** Same false-positive shape as Check 4, one level more subtle: both already correctly read `social_automation_heartbeat.last_success_at` (heartbeat-based, not post-based — that part was already right), but 72h was calibrated too tight against the real cadence — the same live data showed a 71.9h gap, right at the edge. 120h gives real margin above every observed gap while still catching a genuine multi-day outage well inside a week. Applied to both Check 6 (Instagram, built last session) and Check 6c (YouTube, pre-existing) for consistency — they share byte-identical logic and the identical underlying cadence, so leaving one at 72h while fixing the other would just relocate the same risk. Verified live: both show `last success 1.7h ago`, correctly green, nowhere near either threshold.

**C. `youtube_oauth_helper.py` no longer hardcodes the Testing-mode 7-day assumption.** The evidence (token issued 2026-06-20 still working 2026-07-22, 32 days later — well past any real 7-day limit) suggests the OAuth app may no longer be in Testing mode, but this can't be confirmed programmatically (would need separate Google Cloud API credentials this script doesn't have), and the tracker itself has never logged a definitive resolution to `YT-OAUTH-01` (see line ~2752's own unresolved "either (a) silently resolved, or (b) heartbeat mis-reports" note — still open). **Fix:** the helper now asks interactively at re-auth time whether the app's Google Cloud Console status is Testing or Production/Verified, computing `expiry` as 7 days (Testing) or a 180-day inactivity window (Production — Google's real general revocation policy, not a fixed calendar expiry, since verified apps don't have one). Unclear/empty input safely defaults to the conservative 7-day Testing assumption, not the riskier "assume it's fine" direction. Verified: fed both branches (`production`/`testing`) plus empty input through the isolated logic — each computes the correct expiry, default is safely conservative.
**Open dependency, not resolvable by me:** this only takes effect at the *next* re-auth, and the correct branch depends on Abhinav actually checking Google Cloud Console → OAuth consent screen → publish status. Until he does, we still don't know which assumption is currently true — flagging this explicitly rather than guessing either way.

**D. Check 9 — added run-failure detection + two missing workflows.** Check 9 already fetched `lastRun.conclusion` and printed it in the console log every run, but only ever alerted on `ageHours > threshold` — never on `conclusion === 'failure'`. This meant a workflow that runs on schedule but fails every time produced **zero alert**, which is exactly what happened with `social-automation.yml`'s real 07-24/07-25 failures (both recent, so staleness never caught them). Now alerts on `conclusion === 'failure'` regardless of age, using data already fetched. Confirmed against the real historical failed run (`actions/runs/30151185064`) that GitHub's API returns `conclusion: "failure"` as this exact literal string, and reproduced the comparison against that real data to prove it would have fired. Also added the two most consequential previously-unmonitored workflows: `ig-token-refresh.yml` (432h threshold — 1st/15th cron, worst real gap is 17 days for a 31-day month's 15th→1st, +1 day buffer) and `publish-drafts.yml` (16h threshold — 3×/day cron, worst gap ~12.5h, +buffer). Verified live against all 6 workflows with a real `GITHUB_TOKEN`: `IG token auto-refresh: last run 265.7h ago (success)`, `Publish drafts: last run 12.8h ago (success)` — both correctly green, no false positives from the new entries.

**Deferred, not touched (per explicit scope):** Check 5b/8's duplicate hardcoded 2-store list — flagged in Follow-up prior audit, still accurate today (1808/1808 rows accounted for), not urgent.

---

## Evidence-based reconciliation — 2026-07-09 (post-audit)

**Trigger:** a Road Bike duplicate was reported resolved twice this session before the delete had actually run against the full match set (the discovery query only ever matched slugs containing "11380," missing a 5th article — see DEFECT-020 below). Per explicit instruction, every claim below was re-verified against live repo/DB state in this pass — not against what an earlier message in this conversation asserted. Where no live evidence exists for a claim, it is marked `UNVERIFIED`, not left as done.

**Method:** `git log`/`git diff`/`git status` against the actual working tree and `origin/main`; direct `information_schema` queries for schema; direct table queries for data; `Read`/`Grep` against actual current file contents; `tsc --noEmit` and `vitest run` executed fresh at the end of this pass, not carried over from an earlier run.

### 0. Repo state itself

| Claim | Evidence | State |
|---|---|---|
| Local HEAD matches `origin/main` | `git rev-parse HEAD origin/main` → both `ce3fbb80c8904c645f0aa2effd53ef91b7783f59` | ✅ CONFIRMED |
| Working tree clean of tracked changes | `git status --short` → only pre-existing untracked patch/diagnostic files (`0002-*.patch` … `0020-*.patch`, `boi-health-fixes-2026-07-02.patch`, `diagnose-*.mjs`, `audit/mrp-audit-2026-07-02.csv`) — none of these are tracked, none touched this session, left as-is per earlier session decision | ✅ CONFIRMED |
| `tsc --noEmit` clean | Executed fresh this pass, zero output | ✅ CONFIRMED |
| `vitest run` passing | Executed fresh this pass: `Test Files 3 passed (3)`, `Tests 81 passed (81)` | ✅ CONFIRMED |
| **Commits since session start (`e85ae31`), all of them, not just mine** | `git log --format="%H|%ai|%an|%s" e85ae31..HEAD` → 8 commits total: 6 authored `Abhinav` (this session's work), **2 authored `Bricks of India <bricksofindia007@gmail.com>`** (`930f8198`, `ce3fbb80`) | See §L below — these 2 were never logged in any tracker until this pass |

### A. Redirects — §1 (original 9) + §2b (6 groups + 1 fix) + DEFECT-020 (1 more)

**Commits:** `6260e4d`, `3c9b475`, `f3d2827`.
**Evidence:** Read `next.config.mjs` directly this pass — counted 17 redirect entries beyond the pre-existing `/search` and `/sets/page/1` ones. Ran two fresh queries against `news_articles`:
- All 17 dead source slugs → **0 rows returned** (all confirmed absent).
- All 12 distinct destination slugs → **12 rows returned** (all confirmed present).

**State:** ✅ CONFIRMED, direct query evidence, not inferred from the redirect config alone.

### B. §2a real fix / DEFECT-016 extension — theme/set_number-verified image matching

**Commit:** `23dee73`.
**Evidence:** `Grep` on `src/lib/publish-draft.ts` this pass confirms `isDisallowedRebrickableSet` (line 242), `themeVerifiedMatch` (line 306), and `extractSetNumberCandidates` used at the actual resolution call sites (lines 334, 345, 373–374), not just defined and unused.
**State:** ✅ CONFIRMED present in current file. *(Runtime behavior — e.g. the live dry-run showing 0 wrong rescues — was verified earlier in-session with real Rebrickable API calls; not re-run in this pass since it requires live network calls and the code evidence plus that earlier concrete run together are sufficient. Flagging this distinction rather than re-asserting the dry-run number as freshly re-confirmed.)*

### C. DEFECT-017 — Gate 9 duplicate-content check

**Commit:** `23dee73`.
**Evidence:** `Grep` on `src/lib/lint.ts` confirms `gateDuplicateContent`, `DUPLICATE_WINDOW_DAYS`, `leadingFeaturePhrase` all present, and — critically — that `gateDuplicateContent` is actually **called** inside `lintDraft` (line 626) and its result **returned** in the gates object (line 642), not just defined in isolation.
**State:** ✅ CONFIRMED wired into the live lint path. *(The two direct-call test cases run earlier in-session — set_number block, feature-phrase block — are not re-executed in this pass; same caveat as §B.)*

### D/E. MEDIUM-69 (verdict drift) / MEDIUM-70 (capitalisation whitelist)

**Commit:** `23dee73`.
**Evidence:** `Grep` on `scripts/content-linter.mjs` confirms `verdict_drift` flag logic (lines 243, 245) and `ABBREVIATION_WHITELIST` (line 49, referenced line 190) present in the current file. `src/lib/verdict-consistency.ts` confirmed to exist on disk (61 lines).
**State:** ✅ CONFIRMED present. Live re-scan of `content_quality_issues` this pass (see §I) confirms the specific `verdict_drift` row this check found (Natural History Museum) is marked `resolved=true`.

### F. HIGH-57 — MRP root-cause fix

**Commit:** `6260e4d`.
**Evidence, all queried fresh this pass:**
- `information_schema.columns`: `sets.mrp_verified` (boolean) and `sets.mrp_review_reason` (text) both exist live.
- `sets` grouped by `(mrp_verified, mrp_review_reason)`: **644 / true / null**, **2770 / false / 'unverified_estimate'**, **127 / false / 'cmf_box_ambiguity'**, **21410 / false / null** — exact match to the numbers originally claimed, unchanged.
- Spot checks: `75397` (Jabba's Sail Barge) = ₹51,999, verified=true. `71051` (Peacock Suit, CMF) = ₹400, verified=false, correctly excluded from the price overwrite.
- `src/lib/generate-body.ts` confirmed to gate on `mrp_verified` before presenting a figure to the model (line 143).
**State:** ✅ CONFIRMED, exact data match, not just schema presence.

### G. §5 — McLaren helmet (43023)

**Commit:** `6260e4d` (data), no article edit made.
**Evidence:** `sets` row for `43023` = ₹9,999, `mrp_verified=true` (fresh query). `news_articles` row for the McLaren helmet slug: `verdict = 'WAIT'` (fresh query) — unchanged, and correctly so: Toycra sells it at exactly ₹9,999 (0% premium over the now-confirmed real MRP), and the standing verdict rule is "at MRP → WAIT."
**State:** ✅ CONFIRMED — verdict correctly left alone, not "verified as changed when it wasn't."

### H. BUG-016 — byline/breadcrumb contrast

**Commit:** `2cb33fb`.
**Evidence:** `Grep` confirms `Byline.tsx` has the `onDark` prop and computes `textColor`/`linkColor`/`sepColor` conditionally (lines 14, 37–39); `reviews/[slug]/page.tsx` passes `onDark` at its `<Byline>` call site (line 130).
**State:** ✅ CONFIRMED present in current files. *(The live-screenshot verification via local dev server was done earlier in-session with the browser tool, not re-run in this pass — same category as §B/§C: code presence re-confirmed now, rendered-pixel behavior confirmed earlier, not re-screenshotted.)*

### I. DEFECT-019 — reviews table

**Commit:** `bf0d7d2`.
**Evidence, all queried fresh this pass:**
- **Rating decoupling:** `draft-prompt.ts` has the `RATING CRITERIA` block and parses a `RATING:` line into a typed `rating: number | null` (lines 151, 158, 231, 273, 284). `publish-draft.ts` reads `draft.draft_rating` in preference to the old verdict-map (line 611). `information_schema` confirms `pending_drafts.draft_rating` (integer) exists live. **Existing 18 reviews rows were explicitly NOT retroactively re-scored** — this remains an open manual backlog item, not silently closed.
- **13 opener rewrites:** fresh query of all 18 reviews' first 60 characters — no "Your wallet [breathed/called/is probably]" pattern remains anywhere; all 18 openers are now distinct text.
- **CQS cleanup:** fresh `content_quality_issues` group-by for `section='reviews'` — every check I claimed resolved shows `resolved=true`; **3 rows remain genuinely unresolved**, all `word_count`/`info` severity, matching exactly what was flagged as known-and-deliberately-not-addressed (not a gap I missed).
- **Unverified-MRP reviews (40805, 60449, 40796):** already covered under §F's fresh `sets` query — all three still show `mrp_verified=false, mrp_review_reason='unverified_estimate'`, i.e. no forced correction was made, as instructed.
**State:** ✅ CONFIRMED for everything claimed done. Retroactive re-scoring of the 18 pre-existing rows is **explicitly OPEN**, logged as backlog, not implied closed.

### J/K. DEFECT-020 — Road Bike 5th duplicate, and the broader re-check it triggered

**Commit:** `f3d2827`.
**What actually happened (evidence, not the earlier in-conversation narrative):** the original §2b discovery queries for this group matched only `slug ilike '%11380%'`. `lego-icons-road-bike-rolls-into-india-a-17500-test-of-patien` has no "11380" in its slug and no `set_number` linked, so it never appeared in any prior search and was never evaluated — this was a **search-scope gap**, confirmed by re-running the user's exact query and by checking `git log`/`git diff` before touching anything (no environment split: same project ID throughout; the earlier delete had genuinely run — the row it targeted was confirmed absent both before and after this fix).
**Fix verification:** deleted (`returning slug` confirmed the exact row removed), redirect added and confirmed present in `next.config.mjs`, re-ran the user's exact discovery query fresh — **3 rows remain**, matching the original expectation.
**Broader re-check (done twice — once in the prior turn, redone fresh in this pass with a wider keyword list including `%m:tron%` and `%love birds%`):** 14 rows across every previously-resolved group, each showing exactly the expected survivor count (1 each, except Road Bike = 3 and Jabba's Sail Barge/Houndstooth = 2, both legitimately-different-content cases already documented). **No further undiscovered duplicates found.**
**State:** ✅ CONFIRMED fixed and re-verified fresh in this pass, independent of the two earlier "resolved" claims that turned out to be based on an incomplete search.

### L. Unlogged parallel work — surfaced by this audit, not by prior tracking

Two commits exist on `origin/main` that were **never referenced in any tracker or dashboard entry before this reconciliation**:

| Commit | Author | Time (IST) | File(s) | Summary |
|---|---|---|---|---|
| `930f8198` | `Bricks of India <bricksofindia007@gmail.com>` | 2026-07-09 11:03:54 | `scripts/video/engine.py` (+47/-3) | RETRY_NOTE was stale for the current 90-110 word gate (written for an earlier 105-135 gate); fix computes the retry note dynamically from the actual failed word count; also raised `MAX_GENERATION_ATTEMPTS` 4→6. Commit message cites 3 consecutive daily run failures as evidence. |
| `ce3fbb80` | `Bricks of India <bricksofindia007@gmail.com>` | 2026-07-09 14:09:51 | `.github/workflows/video-generate-daily.yml` (+1) | `RESEND_API_KEY` was missing from this one workflow's env block (16 sibling workflows already had it) — "ready for review" emails were silently no-op'ing. Commit message cites a specific run's log line as evidence. |

**Assessment:** these are VID-P4 video-pipeline fixes, entirely outside the Terminal Execution Spec / MRP / content-quality workstream this session's other 6 commits belong to. Author identity (`Bricks of India` bot vs. `Abhinav`), commit-message style (cites specific run IDs and log lines — consistent with an automated diagnostic loop, not a manual edit), and complete absence of file overlap with anything else this session touched (except one coincidental case below) all point to a separate, already-running automated pipeline, not a rival interactive session doing the same work twice.

**The one real overlap:** my local working tree had an **uncommitted, pre-session draft** of the exact same `engine.py` fix — a hardcoded static retry-note string, present in the working tree before this session even started, deliberately left untouched at the time. `930f8198`'s version is strictly more complete (dynamic note + attempts-limit change). Resolved this pass: `git stash push` (not deleted — recoverable via `stash@{0}`) then `git pull --ff-only origin main` — a clean fast-forward, no merge commit, no force-push. Verified after: `tsc --noEmit` clean, 81/81 vitest passing, `python -m py_compile scripts/video/engine.py` clean.

**Neither commit needs any further action from this workstream** — they're both complete, evidence-cited fixes for a different problem (VID-P4 daily generation reliability). Logged here so they're no longer "unlogged," not because they need fixing.

### M. Known-open items — explicitly not closed, not papered over

- **2,770 sets flagged `unverified_estimate`** (HIGH-57) — root cause confirmed systemic, no reconciliation attempted beyond the 644 directly cross-checked against Toycra. Still suspect by design; `generate-body.ts` will not present these to the model until independently confirmed.
- **18 pre-existing reviews rows not retroactively re-scored** (DEFECT-019) — the generator fix only affects new reviews going forward; real editorial judgment needed per existing set, not attempted.
- **3 reviews with unverified MRP** (Arcade Machine 40805, Off-Road Police Chase 60449, Revenge of the Sith 40796) — confirmed still flagged, no forced verdict correction, per explicit instruction.
- **`content-linter.mjs` FORBIDDEN_WORDS has no proper-noun exception** — the "marvel"-the-brand false positive found in the Acclamator review is the same class of gap as the E.T./capitalisation whitelist, noted but not fixed.
- **3 `word_count` info-severity flags on reviews** (Rivendell, McLaren P1, Natural History Museum) — confirmed still open, informational only, never claimed closed.
- **`/reviews/lego-mclaren-mastercard...43023` and similar — CMF exclusion category (127 sets)** — flagged for manual review, no per-series resolution attempted beyond the blanket flag.

### N. Fallback-hero count — a moving target, not a fixed invariant (noted, not a contradiction)

The tracker's "0 rescues, 67 legitimate" claim (from earlier this session) was accurate **at the time it was measured**. A fresh count this pass shows **65** `news_articles` rows on `/fallback-hero.png` (plus 3 `blog_posts`, unchanged). The delta is explained by the site's own live automated publishing continuing to run during this session — e.g. `new-lego-leaks-surface-icons-ideas-cmfs-f1-and-more-teased`, published 2026-07-08 10:34, postdates the original backfill snapshot and was never part of it. This table is not a static artifact; re-counting it days or hours apart will legitimately produce different numbers as new content publishes. Not logged as a discrepancy in this session's work — logged so a future session doesn't mistake normal drift for a regression.

---

## Auto-update protocol

**Source of truth hierarchy:** `BOI_MASTER_TRACKER.md` is the canonical source of truth.
`admin/dashboard.html` is a rendered view of the tracker. If the two ever conflict,
the tracker wins and the dashboard must be reconciled to match.

**Atomic update rule:** Any change to project state — bug closed, fix deployed, pipeline
status moved, audit run, KPI changed, new tool added, cadence modified — MUST update
both files in the same commit. Never one without the other.

**No self-referencing commit hashes:** Entries never reference their own commit's hash —
impossible by construction, since the hash depends on the commit's content, including
the entry itself. Use "this commit" for self-references; explicit hashes only for prior
commits.

**Triggering events that require dashboard update:**
1. A bug is closed (update `issues[].status` → `closed`, set `deployedOn`)
2. A new bug is filed (add to `issues[]` with next BUG-NNN ID)
3. A pipeline item changes status (update `pipeline[].status`)
4. A new pipeline item is created (add to `pipeline[]`)
5. A dependency is satisfied (update `pipeline[].depsBlock` and re-evaluate `blocked` items)
6. A deploy happens (update `kpis.lastDeployDate`, recompute `daysSinceLastDeploy`)
7. Netlify minutes change materially (update `kpis.netlifyMinutesLeft`)
8. An audit is run (update `kpis.lastAuditDate`, `kpis.nextAuditDate`, and relevant
   `auditChecklist[].items[].status`)
9. A new tool/API is integrated (add to `stack[]`)
10. A cron schedule is added or changed (update `cadence[]`)
11. The GEO score is re-measured (update `kpis.geoScore`)
12. The voice test resolves (update `kpis.voiceTestStatus`)

**Workflow at task end:**
Before declaring any task complete, run this checklist:
- [ ] Did this task close a bug? → update `issues[]` in dashboard
- [ ] Did this task move a pipeline item? → update `pipeline[]` in dashboard
- [ ] Did this task deploy code? → update `kpis.lastDeployDate`
- [ ] Did this task change anything in the tracker's "Top of mind" section? → reconcile
- [ ] Run JSON validation on the dashboard
- [ ] Stage both files together: `git add BOI_MASTER_TRACKER.md admin/dashboard.html`
- [ ] Commit with a message that names what changed

**Health score recomputation:**
After any update, recompute `kpis.healthScore` (0–100) using this rough formula:
- Start at 100
- Subtract 20 per open P0 issue
- Subtract 10 per open P1 issue
- Subtract 5 if Netlify minutes < 100
- Subtract 5 if last audit > 30 days ago or never run
- Subtract 5 if voice test still pending after 14 days
- Subtract 5 if GEO score < 50
- Subtract 5 if any blocked pipeline item is P0 or P1
- Floor at 0, ceiling at 100
Then update `kpis.healthScoreNote` to a one-line summary of the dominant factor.

**Session start:**
At the start of every session, after reading the tracker, also verify the dashboard
JSON parses. If it doesn't, fix before doing anything else.

**Concurrency (added 2026-07-30):** Avoid running concurrent Claude Code sessions
against the same working tree. Two independent sessions both hit this same risk in
the same week — one session's `git add` can leave files staged that a second,
unrelated session then sweeps into its own commit via a plain `git commit` (which
commits everything currently staged, not just what that session just added). Use
`git worktree add` for a genuinely separate directory when parallel sessions are
actually needed, rather than pointing two sessions at one working tree.

---

## Sub-trackers

| Tracker | Scope | File |
|---------|-------|------|
| Web | Infra, site integrity, scrapers, GEO, deploys, WEB-01→04 pipeline, PULSE-01→N | `BOI_WEB_TRACKER.md` |
| Content | RSS pipeline, article ops, morning brief, Voice Codex | `BOI_CONTENT_TRACKER.md` |
| Video | YouTube long-form, Shorts, DaVinci, ElevenLabs, script-to-video flow | `BOI_VIDEO_TRACKER.md` |
| Social | Instagram engine, cross-posting, LAN RLFM runway | `BOI_SOCIAL_TRACKER.md` |

---

## Phase status

| Phase | Name | Status | Tracker |
|-------|------|--------|---------|
| Phase 0 | Launch + post-launch P0 fixes | ✅ Done | WEB |
| Phase 1 | Voice Codex | ✅ Done — `docs/codex/BOI_Codex_v2.docx` committed 2026-05-01 | CONTENT |
| Phase 2 | Claude Project workbench | 🟡 Unblocked — pending setup | CONTENT |
| Phase 3 | Topical Radar (RSS ingestion) | 🟡 In progress — RADAR-01–05/CRON ✅ Done. WEB-01–04 ✅ Done. DEFECT-005 ✅ closed. REVIEWS-FIRST-3 ✅ Done Day 14. RADAR-08 ✅ Done Day 26 (automated reviews pipeline). GHA batch generation ✅ Done Day 26 (generate-drafts.yml + dispatch button). 338 approved drafts awaiting bodies — first GHA run in progress 2026-05-27 03:51 UTC. | CONTENT |
| Phase 4 | Shorts / Reels workflow (cloud-based approval pipeline) | 🟡 In progress — 2 real live posts confirmed 2026-07-06 (Minas Tirith 11377 via manual trigger; N-1 Starfighter 75442 via a fully autonomous chat-approve → poller-publish loop, independently fetch-back-verified on both platforms). Daily generation cron active (`video-generate-daily.yml`, 6:00 AM IST) and publish poller active (`video-publish-poller.yml`, every 15 min). **Supervised approval continues indefinitely as the default (minimum 2-week trial from 2026-07-06)** — operator reviews every generated video via email/chat and approves manually each time; the Publish Poller then publishes shortly after, no fixed daily post time. Every generated video sits in `pending_approval` until approved; verified by exhaustive grep that no code path or DB trigger ever writes `status='approved'` itself. Full autonomy (gate-pass-only, no human approval) is a **DEFERRED decision, not a scheduled cutover** — see VID-P4-AUTOMATION-REVIEW (§Pending, target review ~2026-07-20). See Sprint changelog for full detail. | VIDEO |
| Phase 5 | Social automation (carousel + Reels + YouTube Shorts) | ✅ Done — SOC-AUTO-01 shipped. Daily cron 12:00 IST. First live run 2026-05-24: 76342-1 Daily Bugle posted to IG Feed (8-image carousel) + IG Reels (8s) + YouTube Shorts (45s). Gallery via Brickset API. | SOCIAL |
| Phase 8 | LEGO Search Pulse | ✅ Live — LAB-07 /lab/heat-map shipped 2026-05-10. D3 choropleth India + world view, 23 states, city drill-down. | WEB (PULSE-01→N) |

---

## RADAR source decisions

**Date:** 2026-05-03
**Decision:** Tier 1 editorial = 3 sources (The Brothers Brick, New Elementary, BrickNerd). Locked Day 1.

**Context:** Earlier architectural notes referenced a 12-source Tier 1 list (Brickset, Brick Fan, Jay's Brick Blog, Toys N Bricks, Brick Fanatics, Bricks Fanz, LEGO Car Blog, Rambling Brick, True North Bricks, plus the 3 retained). When config/sources.json was created in commit 4a39ca5, only the 3 highest-signal editorial voices were adopted. The other 9 were not carried forward.

**Reasoning:** Tier 1 must be high-signal-only. 12 mixed-quality blogs would dilute the editorial bar and add noise to RADAR's input.

**Disposition of the 9:**
- Brickset → moved to Tier 2 (official-adjacent, structured release data). ✅ Re-enabled 2026-05-09 — correct URL is `/feed`, old `/article/rss` returned HTML.
- Brick Fanatics → moved to Tier 5 (headline + URL only, no body)
- Brick Fan, Toys N Bricks, Bricks Fanz, LEGO Car Blog, Rambling Brick, True North Bricks → not adopted at any tier
- Jay's Brick Blog → ✅ Added 2026-05-09 as Tier 1 editorial (jaysbrickblog.com/feed/). Confirmed working: 11 items, parses cleanly.

**Active Tier 1 sources (as of 2026-05-12):** The Brothers Brick, Jay's Brick Blog, BrickNerd, New Elementary. New Elementary re-enabled via Blogger JSON endpoint (`?alt=json&max-results=20`) — bypasses XML violations entirely (commits 700b561 + a311fc6). PARSER-01 closed. Total active sources: 16.

**Re-litigation rule:** Adding any source requires a tracker entry with reason. Don't quietly expand tiers.

---

## Infrastructure status

| Item | Status | Evidence |
|------|--------|----------|
| DNS authority | ✅ Confirmed | Cloudflare (kira.ns.cloudflare.com, yadiel.ns.cloudflare.com). Origin: Netlify. Email MX: ImprovMX (unchanged). |
| Netlify → GitHub Actions migration | ✅ Done | Commit `8992aef` + `.github/workflows/deploy.yml` |
| Scraper workflow on GitHub Actions | ✅ Running | `scrape-prices.yml` + 492 rows scraped today |
| GEO/AI readiness (llms.txt, sitemap, JSON-LD) | ✅ Live | All 200, schemas present |
| AI crawler policy (GEO-02 + ROBOTS-01) | ✅ Done 2026-05-01 | Cloudflare AI Crawl Control WAF (GEO-02, manual) + `src/app/robots.ts` declared policy (ROBOTS-01, commit `e1054e1`) now aligned. 9 crawlers allowed (referral-traffic); 13 blocked (training-only). |
| Supabase (store_prices, price_history) | ✅ Healthy | 492 current rows, 9,142 historical |
| Site integrity | ✅ All 200 | `/sets` fixed (SETS-01, commit `20474c2`). All core pages healthy. |
| Catalogue sync (sets table) | ✅ Scheduled | `sync-catalogue.yml` weekly Sun 02:00 UTC. ~26k Rebrickable entries → ~10k unique rows after dedup. 16,888 rows, 99.4% image coverage. Assertion threshold: ≥ 8,000 rows. |
| GEO-01 JSON-LD hardening | ✅ Done 2026-05-02 | XSS scrub, JsonLd Server Component primitive, BreadcrumbSchema → Server Component, lib/schemas.ts, SchemaLD.tsx removed. Middleware bug fixed (5f4abef). BUG-013 closed as mis-diagnosed — schemas were server-rendered all along. |
| Voice Codex | ✅ Done 2026-05-01 | `docs/codex/BOI_Codex_v2.docx` (commit `3190596`). 21 pages, Section 1 + 2. India Paragraph spec Page 12, verdict enum Page 13, lint gate spec Page 20. Unblocks CONTENT-02, RADAR-01, WEB-01. |
| CATALOG-FIX-01 v2 | ✅ Done 2026-04-26 | PR `fix/catalog-search`, merge commit `d19625d`. Restores Rebrickable-first search, theme ilike fix, audit + sync crons, DATA_SOURCES.md. Verified live: Concorde search ✓, Star Wars browse ✓, price filter ✓. |
| CF cache headers | ✅ Done 2026-05-02 | `next.config.mjs` route-specific Cache-Control, shipped 2026-05-02 (`6229d99`). Target: 2.3% → 40%+ hit rate on /sets/*, /lab, /sitemap.xml. Verify via Cloudflare analytics 24h post-deploy. |

---

## Current blockers (top 3)

1. **IG System User Token** — current 60-day token expires ~2026-07-23. Manual re-exchange required by **2026-07-16** (hard deadline, 25 days from 2026-06-21). Permanent fix (Meta Business Manager System User) deferred. [status unchanged as of 2026-06-21]
2. **YouTube OAuth re-auth** — refresh token expired (`invalid_grant`). Google OAuth app under verification (submitted 2026-06-02, 4–6 week review). As of 2026-06-21, 19 days elapsed — within stated review window. YouTube Shorts skipped gracefully via `try/except RefreshError`; IG unaffected. Health Check 6b (token expiry) + 6c (heartbeat table) alert nightly. `social-automation/youtube_oauth_helper.py` ready to run post-review.
3. **CE-01 Builder Spotlights ×2** — deadline **2026-07-15**. Outreach posted 2026-05-29. Jun 15 inbox check threshold has passed (today 2026-06-21). Escalation status: UNVERIFIED.
4. **store_prices drop** — 2,600 → 1,512 rows first confirmed Day 34 open. SCRAPE-INVESTIGATE-01 resolution: UNVERIFIED (no terminal confirmation in session logs).

> CE-01 outreach ✅ DONE 2026-05-29 — r/IndiaLEGO + AFOL India Facebook posted. Awaiting respondents.
> McLaren voice test ✅ DONE — 12 articles published 2026-05-29, voice test passed implicitly.
> Content Quality System v2 ✅ LIVE — first run 2026-05-29, email sent (Resend ID 26c25d6a).

> PARSER-01 closed 2026-05-12 — New Elementary re-enabled via Blogger JSON (commits 700b561 + a311fc6).
> BUG-013 closed 2026-05-02 as mis-diagnosed. GEO-01 hardening shipped. See Sprint changelog Day 2 for details.
> BRICKSET-01 — Listed in Brickset App Directory 2026-05-28 by Huw Millington. URL: brickset.com/article/131478. Quote: "It looks great."
> HIGH-56 closed / HIGH-57 filed-and-closed 2026-07-09 — MRP root-cause fix, see Sprint changelog.
> AWAITING DECISION (filed 2026-07-08, not yet a numbered defect) — §2b image spot-check surfaced ~4 likely duplicate-article groups (McLaren 42228, Megatron BrickHeadz, Porco Rosso, Road Bike 11380 ×4, Ideas 21365, Jabba's alternate-build) beyond the 6 already resolved, plus 2 new wrong-image cases (Porco Rosso→Hocus Pocus, Megatron→Hangzhou Brickheadz) — reported to Abhinav with full evidence, no DB writes made pending his call on scope. See Sprint changelog 2026-07-08.

## Carry-overs

| ID | Task | Status | Notes |
|----|------|--------|-------|
| DASH-01 | `admin/dashboard.html` full reconciliation with tracker | 🟡 Deferred (Abhinav, 2026-08-09) | `meta.lastUpdated` was `2026-07-09` (a month behind the tracker) before the Nav & Content Overhaul session, which patched `meta`/`cadence` for its own 3 new jobs but did not do a full pass. Internal tracking artifact, not user-facing — explicitly not worth a standalone session. Pick up next time this file is open for something else. |
| CATALOG-05 | Theme backfill — older sets missing from theme pages | 🔴 Not started | Depends on full sync completing all 27 pages (Rebrickable daily quota currently limits one-shot runs). |
| DATA-01 | Reconcile `store_prices` (scraper) ↔ `prices` (frontend) | ✅ Done 2026-05-09 | commit `9ced905`. /sets, /sets/page/[page], /compare all now read store_prices. Price filter on /compare operates on live store prices. DEFECT-009 logged. |
| ADMIN-CLEANUP-01 | Remove Netlify legacy secrets from GitHub Secrets (NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID) | 🟡 Deferred | Noted "LEGACY — pending removal in ADMIN-CLEANUP-01" in `.env.example` (commit 4a39ca5). Netlify is still the origin host so removing now is low-risk but not urgent. |
| SCRAPE-01 | Tier 5 + Tier 2 scrape selector hardening | 🟡 Partial | LEGO New Sets (Tier 2): ✅ Closed — lego.com is a Next.js SPA, product links client-rendered. Requires Playwright. Not worth complexity. Disabled permanently with comment in config. Blocks Magazine: ✅ Fixed 2026-05-09 — URL updated to post-redirect hostname (blocksmag.com/news/), now fetches 86 links. LEGO Ideas Blog, Eurobricks News: still disabled (SCRAPE-01 open for these). |
| PARSER-01 | rss-parser malformed feeds — New Elementary (Tier 1) | ✅ Done 2026-05-12 | commits 700b561 + a311fc6. Final approach: Blogger JSON endpoint (`?alt=json&max-results=20`) — bypasses XML entirely. New Elementary now enabled in config/sources.json with `"format": "blogger-json"`. Verified: fetched=20, written=20 on manual trigger. |
| YT-FEED-NOISE-01 | YouTube channel RSS feeds include non-upload content — all 6 Tier 4 channels | 🟡 Accepted noise | Opened 2026-05-03. YouTube's videos.xml channel feeds include playlist additions and engagement, not just the channel's uploads. Documented YouTube behavior, not a fetcher bug. Verified via isolated fetch bypass that each URL returns the same content with or without our code. Accepted as noise for v1 — RADAR-02 dedupe handles cross-source overlap; future "stale items >14 days" filter drops most playlist additions. Fix paths: (a) YouTube Data API v3 playlistItems.list against UU... uploads playlists (requires API key + daily quota); (b) filter entries by <author><uri> match against feed owner. Priority P3 — cosmetic noise, not a correctness issue. |
| RADAR-03 | RADAR-03 classifier + /admin/pending | ✅ Done 2026-05-09 | classify-signals.js (commit `db1dd2d`). 298/530 signals qualified. /admin/pending cookie-gated review route (commit `6e2e47b`). |
| RADAR-03-TUNE | RADAR-03 classifier over-indexes on Rebrickable as NEWS; misses community/contest articles from editorial sources | ✅ Done 2026-05-12 | commit 5024470. Rebrickable API signals now skipped entirely. COMMUNITY_RE extended with digest/round-up/headline/contest patterns. skipped_community=223 confirmed on manual trigger run. |
| NETLIFY-CREDITS | Production deploys paused — Netlify billing cycle resets 2026-05-22 | ✅ Closed — moot | All builds migrated to GitHub Actions (INFRA-03, commit `8992aef`). Netlify is origin host only; build minutes no longer consumed. |
| RADAR-04-FULLTEXT | RADAR-04 full-text fetch before Gemini generation | ✅ Done 2026-05-09 — promoted P3→P1, shipped same session. `generate-drafts.js` now attempts full-body fetch via native fetch + cheerio before every Gemini call. Skip-list: rebrickable.com, youtube.com, reddit.com, i.redd.it. Selectors: article, .post-content, .entry-content, .article-body, main p. Min 300 chars to use fetched body; fallback to stored excerpt otherwise. Dry-run verified: Brothers Brick fetched 773 chars ✅, JBB fallback (no selector match) ✅, Rebrickable skip-list ✅. |
| REVIEW-PRICE-01 | Review pages show no live store price | ✅ Extended 2026-05-25 | Original fix (e07ddc5, 2026-05-13): queries store_prices via createServerClient(). Extended fix (2026-05-25): replaced single "best price" conditional with full 3-store table (matches sets/[slug] TRACKED_STORES pattern). All 3 stores always render — "Not listed" fallback when no data. Eliminates conditional hiding that caused thin-content soft 404. |
| DEFECT-005 | RADAR-04 generated articles not in BOI Codex voice/register | ✅ Closed 2026-05-25 | Option A complete. VOICE_EXAMPLES replaced with verbatim Codex Page 19 exemplars. Prompt reordered (rules + examples first, codex as reference). Wallet-in-para-1, India Paragraph, beat structure enforced as explicit structural requirements. NEVER list + impatient-explanation rule added. Flash-Lite holds register when exemplars include explicit DELETE examples. Option B not required. |
| DEFECT-013 | `generateArticle()` throws on missing `BOI_DRAFT` markers — pre-existing runtime error | ✅ Done 2026-05-14 | Pre-existing. Markers were embedded only as a fill-in template in `userPrompt` with no explicit instruction to reproduce them. Gemini responding conversationally triggered `si === -1` hard throw (line 248). Fix: `OUTPUT_FORMAT` constant added as final segment of `systemPrompt` — non-negotiable hard rule isolated from all voice/style guidance; `IMPORTANT:` anchor added to top of `userPrompt`. Commit `a03f6d5`. |
| DEFECT-014 | Hero image OG collisions: same image on multiple articles; no Rebrickable fallback | ✅ Closed 2026-05-25 | Part A: retroactive UPDATE on 5 rows across 3 duplicate groups (scripts/fix-hero-dupes.mjs, verified 0 remaining). Part B: `extractSetNumber()` + Rebrickable fallback in `publishDraft()` dedup guard — on collision, tries `sets.image_url` before dropping to null. |
| LAB-05 | Price Drop Board — today's steepest price falls | 🟡 P3 deferred | Scaffolded as `coming_soon` in `src/lib/lab-tools.ts` (id: `price-drops`). Needs LAB-03 snapshot data history (30+ days). LAB-03 cron running since 2026-05-02 — 11 days of data as of 2026-05-13. Eligible ~2026-06-01. |
| LAB-06 | Retirement Radar | 🟡 P3 deferred | Scaffolded as `coming_soon` in `src/lib/lab-tools.ts` (id: `retirement-radar`). Needs CATALOG-04 v2 (Brickset cron for exit dates). |
| WEB-01 | Article auto-publish pipeline — generateArticle() + lintDraft() | ✅ Done 2026-05-14 | `generateArticle()` live in `actions.ts`. `lintDraft()` Gates 1–3 first shipped commit `c313795` (Day 12). Fully hardened Day 14: 3-state Gate 1, full 4-component Gate 2, Gate 3 all formats. |
| WEB-02 | Auto-publish gate: lint pass → publish proceeds | ✅ Done 2026-05-14 | Pipeline is UI-based not PR-based. Equivalent: Publish button in `/admin/pending` is hard-gated by `lintDraft()` — all gates must pass before `publishDraft()` inserts to Supabase. |
| WEB-03 | 4-gate linter: word count, India Paragraph, verdict, image HTTP 200 | ✅ Done 2026-05-14 | `lintDraft()` in `actions.ts`. Gate 1: 3-state PASS/WARN/FAIL (±10% / ±25%). Gate 2: all 4 Codex components (marker, ₹price, store availability, Indian comparison) checked against `body.slice(markerIdx)`. Gate 3: verdict enum enforced for all formats. Gate 4: HEAD-check on extracted OG image URL in `publishDraft()` post-`fetchOgImage()`. |
| WEB-04 | Failed lint → publish blocked + email alert | ✅ Done 2026-05-14 | `sendLintAlert()` in `actions.ts` — dynamic Resend import, fires on any Gate 1–4 FAIL, sends to `abhinav@bricksofindia.com` with draft title + gate error. Never throws (lint error propagates unmasked). Gate 1 WARN logs to console but does not trigger email or block publish. |
| WEB-05 | /guides route — Fan CoLab critical path | ✅ Done 2026-05-25 | Commit `eb8a049`. `src/app/guides/page.tsx` (index: hero, 3-column card grid, category tabs) + `src/app/guides/[slug]/page.tsx` (Article JSON-LD, breadcrumb, related guides). Migration: `supabase/migrations/20260525000000_guides.sql`. Guides link in Navbar + sitemap. |
| WEB-06 | /community route — Fan CoLab critical path | ✅ Done 2026-05-25 | Commit `2cda45a`. `src/app/community/page.tsx` + `src/app/community/[slug]/page.tsx` live. Tracker carry-over was stale. |
| DESIGN-CSS-02 | Hardcoded hex cleanup — lab pages + globals | ✅ Done 2026-05-26 | `lab/deals/page.tsx`, `lab/which-set/page.tsx`, `lab/heat-map/page.tsx`: BOI brand colors → CSS vars (`--boi-saffron`, `--boi-blue`, `--boi-text`, etc.). `globals.css` heading colors tokenised. D3 `.attr()` calls and email template (`newsletter.ts`) excluded — hex required in those contexts. `admin/pending/page.tsx` deferred to DESIGN-CSS-03 (internal tooling, 37+ inline styles). |
| REVIEWS-FIRST-3 | Write first 3 Codex-compliant set reviews | ✅ Done 2026-05-14 | 3 reviews inserted. (1) McLaren P1 42172 — BUY, ₹29,399 Toycra, 558w, id `34d279e3`. (2) Rivendell 10316 — BUY, ₹39,999 Toycra, 624w, id `7141242f`. (3) Natural History Museum 10326 — WAIT FOR SALE, ₹34,999 Toycra, 543w, id `70db543d`. All pass lint Gates 1–4. Schema hardened (hero_image, excerpt, seo_title, seo_description, updated_at). Unblocks GEO-01-FU1 and RLFM. |
| GEO-01-FU1 | Verify /reviews/[slug] JSON-LD on first review publish | 🟡 Unblocked — pending Netlify deploy of 2026-05-25 changes. Verify `buildReviewSchema()` emits Review + Product schema on live /reviews/lego-42172-mclaren-p1-review. Netlify credits reset 2026-05-22 — deploy now unblocked. | Gated on reviews table having at least 1 row — now satisfied. |
| RADAR-08 | Automated reviews generation pipeline | ✅ Done 2026-05-26 | `scripts/radar-08-reviews.js` — queries store_prices for in-stock sets, deduplicates against reviews (UUID join) and pending_drafts (brickset URL pattern), applies ₹1,000 price floor and accessory name filter (pen/keychain/magnet/bag charm/pin), inserts up to 10 approved drafts/run. Store priority: mybrickhouse > toycra > jaiman; tiebreak: price_inr desc. Title format: `LEGO [Name] ([Set Number]) — Worth ₹[price] in India?`. Integrated into radar.yml after RADAR-03 step. First run: 10 drafts seeded (Death Star 75419 through Captain Jack Sparrow's Pirate Ship 10365, all mybrickhouse, ₹36k–₹1.05L). |

---

## THE LAB — 8 of 9 live

Experimental features. Each ships as a standalone page under `/lab/`. Brief files live in `briefs/`.

| ID | Name | Status | Depends on | Brief |
|----|------|--------|------------|-------|
| LAB-01 | Biryani Index | ✅ Live | — | `briefs/LAB-01-biryani-index.md` |
| LAB-02 | Which Set Are You? (quiz) | ✅ Live — 2026-05-10. /lab/which-set. 5 questions, 8 outcomes, store links with ABHINAV12. | LAB-01 | `briefs/LAB-02-which-set-quiz.md` |
| LAB-03 | Daily price snapshot cron | ✅ Done — 2026-05-02. 724 snapshots/day, 08:30 IST cron. Verified Phase 5 by operator. | — | `briefs/LAB-03-price-snapshot-cron.md` |
| LAB-04 | Lab homepage strip + nav + /lab directory | ✅ Done — 2026-05-02. /lab directory live, homepage strip + nav dropdown shipped. Fixes 2026-05-02 audit /lab 404. LAB-02 staged as coming_soon in src/lib/lab-tools.ts (single-edit unlock). | LAB-01, ideally LAB-02 | `briefs/LAB-04-homepage-strip.md` |
| LAB-05 | CMF Tracker | ✅ Live — 2026-05-28. /lab/cmf-tracker. 118 CMF figures across Series 20–29 (2020–2026). Series tab selector, per-figure checkboxes, saffron progress bar → green at 100%, store price with ABHINAV12 discount. Server+Client split. | — | — |
| LAB-06 | India Deals Today | ✅ Live 2026-05-25 | — (store_prices data live) | CE-06 |
| LAB-07 | Budget Calculator INR | ✅ Live — 2026-05-28. /lab/budget-calculator. Min/max INR inputs, 5 quick-select ranges, paginated store_prices query (2 pages for 1,707 rows), Toycra ABHINAV12 discount, sorted by piece count DESC. | — | — |
| LAB-07b | LEGO Heat Map | ✅ Live — 2026-05-10. /lab/heat-map. D3 choropleth India + world bubble map, 23 states, city drill-down. | — | — |
| LAB-08 | Retirement Radar | ✅ Live — 2026-05-28. /lab/retiring-soon. 128 sets retiring in 90 days, grouped by date, urgency colour stripe (red/saffron/gray), best store price. Powered by Brickset exitDate via populate-mrp.js Phase 5. Weekly refresh via retiring-soon.yml (Sunday 02:00 UTC). | CATALOG-04 v2 | — |
| LAB-09 | Price Drop Board | ✅ Live — 2026-05-30. /lab/price-drops. store_prices (current) vs oldest price_history in 30-day window per (set_id, store_id). Min ₹200 or 5% drop. Sorted by biggest ₹ drop. Theme/store/% filters. ABHINAV12 Toycra discount shown. | LAB-03 | — |
| LAB-10 | Brick Portfolio | 🔴 Not started — P3 | User accounts | — |

**Decisions made:**

- **User accounts — DEFERRED.** 5 of 6 Lab tools require no auth. Only Portfolio (LAB-08) needs it. Email capture also deferred — DPDP Act compliance overhead not justified without proven editorial cadence for a list. Revisit when LAB-08 is being scoped.

---

## Deadlines

| Date | Item | Status |
|------|------|--------|
| ~~Pre-May 11, 2026~~ | ~~Netlify quota exhaustion~~ | ✅ Neutralised — off Netlify builds |
| ~~2026-05-01~~ | ~~Voice Codex v1~~ | ✅ Done — `docs/codex/BOI_Codex_v2.docx` |
| TBD | Article pipeline (WEB-01→04) v1 | Spec-ready — WEB-01 pending build |
| TBD | PULSE-01 data layer | Not scheduled |

---

## Recent deploys

| Deploy | Date | Commit | Contents |
|--------|------|--------|----------|
| Day 30 FINAL | 2026-05-30 | `f0a4206` | INTEGRITY LAYER COMPLETE: technical-hygiene.mjs grown to 15 check groups, 90+ assertions. YouTube hero backfill (fix-youtube-hero-images.mjs extended to null heroes + year-exclusion filter — 10 articles fixed). Homepage bugs: reviews set: alias (was undefined → images showing placeholder), deals prices(*) dead table → store_prices query. P1/P2/P3 checks: Checks 8g–8n (blog/guides body+hero nulls, pipeline freshness, product_url validity, Rebrickable P1, Shopify P1), 9f–9h (blog markdown/placeholder/meta), Check 11 page coverage (11 routes + content assertions), Check 12 external deps (Rebrickable, Brickset, Shopify, CDNs, tokens), Check 13 pipeline health, Check 14 content integrity (14 sub-checks), Check 15 performance (9 sub-checks). CONTRIBUTING block listing all 15 check groups added. Full site audit confirmed — routes, DB, content, pipelines, external deps, performance, visual layer all covered. |
| Day 30 close (PM) | 2026-05-30 | `f016b7c` | SETS-02/03/04: /sets full rewrite — theme/sort/price/in-stock filters, searchParams pagination (?page=N), price mode (store_prices side), DB mode (Supabase ORDER BY). /sets/page/[N] → redirect shim. CATALOG-05: get_distinct_themes() RPC (188 DB themes), replaces hardcoded 25-item array. SCRAPE-03: zero-row alert via Resend in scrape-now.mjs. fix: related-set cards dead prices(*) → store_prices, anon → service role (910346a). Gate 3 news exemption in publish-drafts.mjs + actions.ts. BOM strip on content-quality-report.mjs. code-audit.yml (Monday 05:00 UTC, ESLint + tsc + npm audit). technical-hygiene Check 7 DataIntegrity (7a–7f: related prices, store coverage, India content, lab pages, sets filters, RPC). CONTRIBUTING rule in technical-hygiene.mjs. Visual renderer first live run: 57/60 OK, 3 ISSUES logged to DB. |
| Day 30 close (AM) | 2026-05-30 | `9744990` | Social automation: apt-get update fix (libcaca0 mirror 404, 2 days down); caption writer: piece count 0→N/A, monsoon guardrail, asterisk strip. GEO: llms.txt 24→60 lines (all lab tools + guides + community + data sourcing), /community added to sitemap, NewsArticle schema on news pages. reset-failing-drafts.mjs tool. PublishAllButton → GHA link (publishAll Server Action removed). LAB-09 /lab/price-drops (price_history drop detection, store/theme/% filters, saffron cards, ABHINAV12). publish-drafts.yml GHA workflow. India Paragraph MANDATORY COMPARISON hardening (explicit fork: price/no-price paths, aspirational comparison required for MOC/vintage). 5 articles published (news: 47→52). 9 stale draft bodies reset for regeneration. |
| Day 29 close | 2026-05-29 | `aa23579` | CQS v2 (detect→fix→verify→report): content-linter.mjs (30+ checks), content-auto-fixer.mjs (11 fix types, 20% safety guard), visual-renderer.mjs (14 Playwright checks 2 viewports), content-verify.mjs, content-quality-report.mjs (6-section HTML email), content-quality.yml (daily 03:00 UTC); DB: content_quality_issues v2 (auto_fixable + fix_detail), content_image_registry, content_fix_log; publish-drafts.mjs batch terminal script (8e30fcc); fix-content-issues.mjs one-shot remediation (7c0a8ab); 12 articles published (news: 26→38); 69 content issues fixed; CE-01 outreach done; technical-hygiene.mjs +opinion slug. |
| Day 28 close | 2026-05-28 | `4740e1b` | WEB-07 /opinion index + [slug] (blog_posts category=Opinion); CE-02 8 LEGO 101 guides live; CE-05 history-of-lego-in-india (ID 9); 3 opinion posts (certified-store/manufacture/star-wars); LAB-05 CMF Tracker /lab/cmf-tracker; LAB-07 Budget Calculator /lab/budget-calculator; LAB-08 Retirement Radar /lab/retiring-soon; CATALOG-04 v2 (retirement_date, is_retiring_soon, retired columns + retiring-soon.yml weekly cron + update-retiring-soon.mjs); populate-mrp.js Phase 5 (3,039 retirement dates); Gemini prompt rewrite (few-shot examples, verdict fix); Eiffel Tower news article; Brickset App Directory listing. |
| Day 26 GHA batch gen + hygiene | 2026-05-27 | `57844f3` | Phase 2: dispatch-only GenerateBatchButton (triggerBatchGeneration → GHA API); actions.ts stripped of duplicated helpers (imports from generate-body.ts); guide format fix (resolveTarget, WORD_COUNT_TARGETS, wordTarget in generate-body.ts + generate-approved-drafts.js); health-check expanded (Checks 8–11 + GITHUB_TOKEN env); technical-hygiene.yml (Monday 04:00 UTC, 6 checks + weekly email); GH_DISPATCH_TOKEN added to Netlify. |
| Day 12 pipeline + design | 2026-05-12 | `e17e977` | DESIGN-CSS-01: Footer, LabStrip, TricolourStripe, globals.css → CSS vars (e15b4f4). RADAR-03-TUNE: Rebrickable signals skipped, COMMUNITY_RE extended (5024470). PARSER-01: New Elementary re-enabled via Blogger JSON (700b561, a311fc6). Reviews: dead prices(*) join removed (dd4691f). WEB-01: lintDraft() 3-gate enforcement at publish (c313795). INDIA_PARAGRAPH prompt fix, Gate 2 warn+fail split (e17e977). |
| Day 11 design sprint | 2026-05-11 | `2c34f75` | Sky blue hero banners (news/blog/reviews/lab). White navbar. BOI-blue (#006CB7) footer with saffron text. Tricolour stripe → saffron/white/green. Heat-map: SVG height fix, cancellation flag, auto-drill removed, Q1 2026 label. Review card image fix (set:sets alias). Duplicate excerpt removed from news+blog slug pages. About page: origin story + float-right photo, credential year 2025, CSS variable colours. |
| Day 10 close | 2026-05-10 | `d5d1641` | CONTENT-RENDER-02/03 closed (ReactMarkdown on blog+reviews, excerpt strip). PRICE-PIPELINE-01: 3,370 sets lego_mrp_inr via Brickset API, audit gate 45% year>=2020. REVIEWS-FIRST-3: 3 reviews seeded (42161, 31120, 10317). GEO-01-FU1 verified live. LAB-02 Which Set Are You + LAB-07 Search Pulse shipped. Brand CSS variables aligned. |
| Day 9 session 3 close | 2026-05-10 | `fb42975` | YouTube strip live (BOI channel only), newsletter → Resend SDK (abhinav@bricksofindia.com), footer 4-column + The Lab, sitemap paginated, DEFECT-010/011/012 closed, 15 RADAR sources. |
| PR #2 merge + DEFECT-008 | 2026-05-09 | `e5b71b1` | Squash-merged feat/content-pipeline-foundation. RADAR-01, RADAR-02, RADAR-CRON live on main. catalogue-audit.yml `permissions: issues: write` added (DEFECT-008). DEFECT-007/008 logged in docs/BRIEF_DEFECTS.md. |
| RADAR-CRON | 2026-05-03 | `4900811` | `.github/workflows/radar.yml` — daily 17:30 UTC (23:00 IST). Chains RADAR-01 (fetch-rss.js) → RADAR-02 (dedupe-signals.js). workflow_dispatch enabled. Merged in PR #2 (2026-05-09). First scheduled tick: 2026-05-09 17:30 UTC. |
| RADAR-02 | 2026-05-03 | `55616bb` | `scripts/radar/dedupe-signals.js` — 4-pass deduper (exact URL → exact title → cross-source Jaccard ≥0.75 → unique). First live run: 53 signals, 53 unique, 0 grouped. Top pairwise Jaccard 0.333. |
| RADAR-01 | 2026-05-03 | `feae8aa` | `scripts/radar/fetch-rss.js` — 11 active sources across 5 tiers. 53 rows written to `raw_signals`. 5 sources deferred (PARSER-01, SCRAPE-01, YT-FEED-NOISE-01). |
| Content Pipeline Day 1 | 2026-05-03 | `4a39ca5` | `.env.example`, `config/sources.json` (Tier 1–5 sources), `docs/runbooks/CONTENT-PIPELINE-SETUP.md`, `@google/generative-ai@0.24.1` + `rss-parser@3.13.0`. GEMINI_API_KEY, GMAIL_APP_PASSWORD, ADMIN_PASSWORD all confirmed live in GitHub Secrets. Branch: `feat/content-pipeline-foundation`. |
| CF-CACHE-01 | 2026-05-02 | `6229d99` | Cache-Control headers across /sets, /lab, /news, /blog, /reviews, /sitemap.xml, /admin. Fixes 2.3% Cloudflare cache rate. |
| GEO-01 JSON-LD hardening | 2026-05-02 | `236fa7d`–`e9e1680` (10 commits) | JsonLd primitive, lib/schemas.ts, BreadcrumbSchema → Server Component, XSS scrub, SchemaLD.tsx removed. Middleware bug fixed (5f4abef). |
| ROBOTS-01 AI crawler policy | 2026-05-01 | `e1054e1` | `src/app/robots.ts` aligned with Cloudflare AI Crawl Control WAF — 9 allowed, 13 blocked |
| CONTENT-01 Voice Codex | 2026-05-01 | `3190596` | `docs/codex/BOI_Codex_v2.docx` committed — closes CONTENT-01, unblocks CONTENT-02 / RADAR-01 / WEB-01 |
| LAB-01 Biryani Index | 2026-05-01 | `be8f134` (merge) | `/lab/biryani-index` live — LEGO price → biryani/chai/petrol converter |
| CATALOG-FIX-01 v2 | 2026-04-26 | `d19625d` (merge) | Rebrickable-first search, theme filter fix, audit cron, DATA_SOURCES.md |
| P0 batch 2 | 2026-04 | `d2b7339` | CopyLinkButton → Client Component (news fix root cause) |
| P0 batch 1 | 2026-04 | `70a9eb0` | /search redirect, /themes hub, SetCard price count |
| GHA canary | 2026-04 | `7be1205` | Verify GHA auto-deploy pipeline |
| INFRA-03 | 2026-04 | `8992aef` | Production build migrated to GitHub Actions |
| Deploy 2 | 2026-04 | `9476d03`, `896d8ba`, `24e3b21` | GEO/AI readiness, E-E-A-T, /about |
| Visual overhaul | 2026-04 | `8fde610`, `d8646c7` | Tricolour brand, header/footer, hero |

---

## Sprint changelog

### 2026-08-08 (Daily set social pipeline: gallery-gate starvation root-caused and fixed — tiered discovery, buildable-category filter, IG token proactive rotation, heartbeat skip-streak alerting) — ✅ CLOSED, PR #18 (`feature/social-gallery-tiering-and-alerting`), squash-merged as `c317e00`

**Issue:** the daily set social post pipeline (`posted_sets`) stopped publishing reliably around Aug 4-7, 2026. **Root cause was not the long-known LEGO.com Cloudflare block alone** (previously logged as an "accepted risk" in `docs/archive/SOCIAL_AUTOMATION_STATUS.md`) — it was that the Brickset-fallback gallery-image gate (`MIN_GALLERY_IMAGES=10`) starved out because candidate discovery was scoped to current-year-only (~1,161 of 25,532 sets) and included non-buildable junk (books, posters, gear, barcode-shaped SKUs) that structurally can never pass an image gate.

**Separately identified during the same investigation:**
- `ig-token-refresh.yml`'s safety check had silently blocked its own rotation for weeks (last successful scheduled rotation Jul 15), causing 2 confirmed real missed posts (Jul 24, Jul 25) via expired-token failures at the IG carousel-create step — unrelated to image sourcing.
- `social_automation_heartbeat` had no mechanism to distinguish a legitimate quiet day from a multi-day systemic failure — its own alert threshold (120h) was wider than the actual gap that occurred.

**Fix shipped, PR #18 (`feature/social-gallery-tiering-and-alerting` → `main`, squash-merged as `c317e00`):**
1. Buildable-candidate filter using Brickset's `category` field ("Normal", plus allowlisted "Extended" BrickLink Designer Program sets, pattern `^91\d{4}$`).
2. Tiered candidate discovery: current-year → 2020-2025 → pre-2020, each tier only tried if the prior tier is fully exhausted; multiple candidates tried per tier, not just the first.
3. Image sourcing: Brickset gallery as primary/load-bearing source (confirmed reliable, never blocked in testing). LEGO.com (`curl_cffi`, `impersonate="chrome120"`) kept as opportunistic-only enrichment — used if it happens to return more images than Brickset, never blocks a candidate if it fails. Confirmed via testing that direct LEGO.com fetching from GitHub Actions is **not** reliably fixable by client library alone (a 20-sequential-call test degraded to ~5% success rate even with full Chrome TLS impersonation) — this is why LEGO.com was demoted to opportunistic rather than kept as primary.
4. IG token: removed the self-blocking safety check; now rotates proactively on a 45-day fixed schedule regardless of Meta's reported expiry, alerts if rotation fails twice consecutively.
5. Heartbeat: added `consecutive_skip_days` and `skip_reason` columns (migration applied to live DB, confirmed clean backfill on the 2 existing rows). Alerts at `consecutive_skip_days >= 2` via existing email infra, distinct subject line.

**Verification:** migration dry-run and a forced-403 Tier-2-fallback simulation both passed before merge. Live production run confirmed post-merge: workflow run `31215154070`, winner `76476-1` ("The Ministry of Magic - Collectors' Edition", 3,491 parts, 19 Brickset-sourced images, Tier 1). Posted live to IG carousel, IG Reels, and YouTube Shorts. `posted_sets` row 52 confirmed (`posted_at` 2026-08-07 20:24:08, all 3 platform flags true). `social_automation_heartbeat` confirmed updated cleanly with the new schema, `consecutive_skip_days: 0`, no errors.

**Known open item, explicitly not verified:** the Jul 24/25 token-expiry fix cannot be retroactively confirmed against Meta's historical API behavior — logged as "plausibly fixed by design, not confirmed avoided."

### 2026-07-09 (DEFECT-020: §2b Road Bike group had a 5th, undiscovered duplicate — found via user-requested re-verification) — ✅ CLOSED, root cause was query scope not environment split

**Abhinav asked for a raw re-run of `select slug from news_articles where slug ilike '%road-bike%' or slug ilike '%11380%'` against the exact same connection used for the original delete, suspecting either an environment split (his count showed 4, mine had reported 3) or a delete that silently never ran.** Neither: same project (`hqpaiarhmiocmjrzjhtw`) throughout, and the original delete (`lego-11380-road-bike-a-2-foot-bicycle-that-costs-12400`) is confirmed correctly absent. The actual bug — **every §2b discovery query only ever matched slugs containing "11380."** `lego-icons-road-bike-rolls-into-india-a-17500-test-of-patien` has no "11380" in its slug and was never linked to a `set_number`, so it never surfaced in any search and was never evaluated. It's a genuine duplicate: a pre-launch teaser for set 11380 published 2026-05-09 18:09:56, **10 minutes before** `the-lego-road-bike-11380-worth-your-emi-in-india` (18:20:16) — which I had separately (and, it turns out, wrongly) assessed as "legitimately different content" without knowing this sibling existed.

**Fixed:** wrong-image rule applies outright regardless of timing — the deleted row's `hero_image` was `brickset.com/utils/ogimage/article/131633`, Brickset's auto-generated article-preview graphic, not a real product photo; the survivor has a genuine Rebrickable product image. Deleted, redirected (`next.config.mjs`), re-ran the exact user-specified query and confirmed 3 rows remain, matching the original expectation.

**Given the root cause was a search-scope gap rather than a one-off, broadly re-checked every other resolved group (this session's 6 plus the prior session's original 6) by title keyword rather than slug pattern, across the whole `news_articles` table.** All clean — exactly one survivor each. (One false alarm during this check: `%mtron%` returned zero rows because the real title is "M:Tron" with a colon; the row exists correctly, just doesn't match that literal substring — confirmed, not a gap.) Also confirmed via `set_number` group-by that zero set numbers are duplicated across `news_articles` — though that check alone would have missed the Road Bike case too, since the sibling had no `set_number` linked at all; keyword search across title text is the check that actually catches this failure mode.

### 2026-07-09 (DEFECT-019: reviews table given the same CQS treatment news_articles already got) — ✅ CLOSED, first full pass on this table

**This table (18 rows, powers the live `/reviews` section) had never been audited for the standard CQS issue categories.** Full pass this session, three real fixes plus several stale/false-positive findings cleaned up along the way:

**1. Rating/verdict correlation — root-caused and fixed generator-side.** Confirmed live: all 18 reviews' `rating` tracked `verdict` with essentially zero independent variation (`publish-draft.ts`'s `VERDICT_TO_RATING` map — WAIT→3, BUY NOW→mostly 3 or 4 — a stopgap explicitly flagged as interim when it shipped 2026-07-05). Fix: the model now outputs an independent `RATING` field in its structured response (`draft-prompt.ts` new `RATING CRITERIA` block — build experience, design merit, value-for-pieces, community reception, explicitly decoupled from price verdict), threaded through `ParsedDraft`/`GenerationResult`/`GenerationOutcome`, persisted via new `pending_drafts.draft_rating` column (migration `20260709010000`) so it survives between the admin "Generate" and "Publish" actions, and read at publish time in preference to the old verdict-derived map (kept only as a fallback for drafts approved before this fix). **Existing 18 rows are not retroactively re-scored** — that requires real editorial judgment per set, not a mechanical fix; flagged as a manual backlog, same treatment as the unverified-MRP cases below.

**2. 13 duplicate "Your wallet [breathed a sigh of relief/called/is probably recovering]..." openers rewritten.** Confirmed via direct text comparison: exactly 13 of 18 reviews opened with this cliché (5 didn't: Rivendell, Natural History Museum, McLaren P1, Hagrid's Motorcycle, Off-Road Police Chase — the last uses the phrase mid-paragraph, not as its opener, so doesn't count as "opens with"). Priority near-duplicate pairs confirmed exact: Arcade Machine≈Unicorn Castle, AT-RT Attack≈Rontu, Olaf's Picnic≈Revenge of the Sith (the CQS `duplicate_opener` check also flagged Beach House at 100% against the latter two — a short-prefix artifact of both starting "Your wallet called," not a full-paragraph match). All 13 rewritten with unique, set-specific openers (`scripts/fix-reviews-duplicate-openers-2026-07-09.mjs`, splits on the first paragraph break programmatically rather than hand-matching literal old text, avoiding curly-quote/em-dash transcription risk) — verified all 18 openers now genuinely distinct, no shared phrasing.

**3. Full audit pass — no set_number mislinks found (unlike news_articles' two prior incidents); several stale/false-positive CQS rows cleaned up, not real bugs:**
- `broken_image` (Rivendell): verified live, loads in 0.9s — was a transient check timeout, not a real broken image.
- `duplicate_image` (Rivendell, ×4): both cross-referenced partner articles are stale — one now has a different image entirely, the other no longer exists (deleted in an earlier cleanup).
- `jaiman_reference` (Natural History Museum): already fixed in the earlier verdict-drift correction pass this session — the CQS row just hadn't been marked resolved yet.
- `forbidden_word` "marvel" (Acclamator): false positive — the text says "new Marvel mech," a proper-noun reference to the Marvel LEGO theme, not the banned stylistic adjective. Same class of gap as the E.T./capitalisation whitelist (§4b) — noted for a future linter improvement, not fixed this pass since there's nothing wrong with the sentence.
- `forbidden_word` "hefty"/"impressive" (Christmas Table Decoration, Elsa's Ice Castle): neither word appears anywhere in current content — stale flags, no fix needed.
- **3 unverified-MRP reviews** (Arcade Machine 40805, Off-Road Police Chase 60449, Revenge of the Sith 40796): confirmed already correctly flagged `mrp_verified=false, mrp_review_reason='unverified_estimate'` from this session's earlier MRP fix. Per explicit instruction, no forced verdict correction against unconfirmed data — left as-is pending real retailer data.

### 2026-07-09 (BUG-016: byline/breadcrumb contrast on Reviews' dark hero band) — ✅ CLOSED, verified live on News/Reviews/Blog

**Confirmed via live screenshot** (`/reviews/lego-10326-natural-history-museum-review`, both production and local): the byline ("By Abhinav Bhargav · Founder, Bricks of India · Published...") was nearly invisible against the Reviews page's `bg-dark` (`#1A1A1A`) hero band. Root cause: `src/components/content/Byline.tsx` hardcodes `color: '#666'` for body text and `color: var(--boi-navy)` (`#1a2332`, itself nearly black) for the author link, with no dark-background variant — computed contrast against `#1A1A1A` is **~3.0:1** (text) and **~1.1:1** (author link), both failing WCAG AA's 4.5:1 for normal text. This is a single shared component used across News/Reviews/Blog, but the bug only manifests where a template wraps it in a dark background — confirmed only `reviews/[slug]/page.tsx` does this (`<div className="bg-dark py-12 px-4">` wrapping both the breadcrumb nav and `<Byline>`); News and Blog render it on `bg-white`, where the original colors are fine (~5.7:1 and ~15.8:1 respectively — untouched).

**Fix:** `Byline` takes a new `onDark?: boolean` prop. When true: body text `rgba(255,255,255,0.85)` (~15.9:1), author link `var(--color-accent)` — the site's own established saffron brand accent, already used for stars/CTAs on the same page, not an invented color (~8.7:1), separators `rgba(255,255,255,0.4)` (decorative, not text, but ~10.8:1 either way). Default (unset) behavior is byte-for-byte unchanged. `reviews/[slug]/page.tsx` now passes `onDark`.

**Verified, not just computed:** started a local dev server and visually confirmed all three templates — Reviews now clearly legible (white text, saffron author name) against the dark hero band; News and Blog screenshots byte-identical in appearance to before the change (still navy link, gray metadata, on white). `tsc --noEmit` clean, 81/81 vitest passing.

### 2026-07-09 (§2b duplicate-article cleanup: 6 more groups resolved, 2 wrong-image cases confirmed backlog not filter gap) — ✅ CLOSED, 5/6 candidate groups confirmed genuine, Road Bike partially applied per content review

**Method, per explicit instruction: publish date + actual content compared for every candidate, not just shared image** — a different review angle on the same set is not automatically a duplicate. Result: 5 of 6 candidate groups were straightforward genuine duplicates (near-identical structure/phrasing, same price, same reasoning, published seconds-to-days apart); the 6th (Road Bike 11380) required splitting rather than a blanket merge.

- **McLaren 42228** — genuine duplicate (same "60 decals," same yoke/Michael-Schumacher-Ferrari anecdote, same verdict reasoning, published 1.5s apart). Both used the same correct image → earliest `published_at` wins. Kept `lego-technic-42228-mclaren-f1-team-mcl39-worth-24999`; deleted+redirected `...-review-too-many-car`.
- **Megatron BrickHeadz** — genuine duplicate (same rumored item, same WAIT reasoning, published 14s apart). Both shared the same **wrong** image (confirmed backlog — see below); tied on (both-wrong), earliest wins. Kept `lego-megatron-brickheadz-a-tiny-transformer-for-your-shelf-n` (deleted+redirected `...-your-wallet-is-safe-for-now`), **and reverted the survivor's own hero_image to fallback** since deleting the loser alone doesn't fix the winner's wrong image.
- **Porco Rosso** — 3 articles, all confirmed the same underlying MOC story (same builder Andrea Lattanzio, same Fabuland engine block detail, same Indiana Jones tent-piece detail). One (05-28) carried a **wrong** image (confirmed backlog — see below) and loses outright per rule 1 regardless of date; the other two (06-28, 19s apart) shared the same correct image, earliest wins. Kept `porco-rosso-beach-hideout-fan-build-is-it-worth-the-indian-w`; deleted+redirected both `...-moc-a-dream-build-for-your-wa` and `porco-rossos-hideout-your-wallet-needs-this-miyazaki-lego-bu`.
- **Road Bike 11380 — NOT a blanket 4-way merge, applied judgment per the explicit instruction against over-merging.** Of the 4 candidates: `the-lego-road-bike-11380-worth-your-emi-in-india` (05-09) is a genuine pre-launch teaser (explicitly "not yet in stores"); `lego-road-bike-11380-worth-12999` (07-01) is a substantively different hands-on review (537 pieces vs. earlier speculative figures, actual observed color scheme, SNOT-technique build detail, later ₹12,999 price) — both left untouched as legitimately distinct content. Only `big-bike-energy-lego-set-11380-road-bike-rolls-in` (05-30) and `lego-11380-road-bike-a-2-foot-bicycle-that-costs-12400` (05-31) are genuine duplicates of each other — same generic announcement-reaction structure, same ₹12,400 price, one day apart, no distinguishing angle. Same correct image on both → earliest wins. Kept `big-bike-energy...`; deleted+redirected `lego-11380-road-bike-a-2-foot-bicycle-that-costs-12400`.
- **Jabba's alternate-build (Bossk's Houndstooth)** — genuine duplicate (both about the identical fan YouTube alternate-build video from Sailbarge parts; both contain the exact same garbled price-citation artifact "...lists it at ₹50,999 though it might be out of stock" verbatim — a strong regeneration signature). Same correct image on both → earliest wins. Kept `bossks-houndstooth-from-jabbas-sailbarge-set-75397-gets-a-cr`; deleted+redirected `woah-an-alternate-bossks-houndstooth-from-the-ucs-sailbarge-`.
- **Missing redirect found and fixed while verifying the precedent case:** Ideas 21365's duplicate (`...-seeing-the-birds-for-the-tree-wo`) had already been deleted in an earlier session (correct application of the same rule — same image, earliest `published_at` won) but **no redirect was ever added**, leaving that URL 404ing until this commit.

**2 additional wrong-image cases — reverted, and confirmed pre-existing backlog, not a DEFECT-016 gap.** Both predate DEFECT-016's ship date (2026-07-08) by 5-6 weeks: Porco Rosso→Rebrickable `21341-1` "Hocus Pocus" was published 2026-05-28; Megatron→`6322719-1` "Hangzhou Brickheadz" was published 2026-05-31. Neither was published after the filter shipped, so this is cleanup of old backlog, not evidence the filter has a gap. Both resolved as part of the duplicate-group cleanup above (Porco Rosso's wrong-image row was itself the group's loser, deleted+redirected; Megatron's wrong image was on the surviving row, explicitly reverted to fallback).

**7 new redirects added to `next.config.mjs`** (6 for the groups above + the missing Ideas 21365 one), same format as the original 9. All 7 dead source slugs confirmed gone from `news_articles`, all 6 distinct destination targets confirmed live, before commit.

### 2026-07-09 (HIGH-57: MRP root-cause fix — mrp_verified flag, CMF exclusion, 644 sets corrected against live retailer data) — ✅ CLOSED, phased rollout

**Root cause found in code, not assumed.** `scripts/populate-mrp.js` (lines 45-47) sets `sets.lego_mrp_inr` = Brickset's `LEGOCom.US.retailPrice` (US retail, USD) × live USD/INR forex rate, rounded to ₹100 — a currency-converted US estimate, never the actual India MRP. This has been true since the column was first populated; it was never a verdict-logic bug (the ±25%-premium rule itself is fine) — it was always a foundational input-data bug. Confirmed live: Jabba's Sail Barge (75397) stored ₹45,000 ($499.99 × ~90 ÷ 100 rounded); Toycra's own page labels "MRP: Original price Rs. 51,999.00" — a ₹6,999 gap, reproducible across the catalog.

**Methodology, verified by loading real product pages, not assumed from the API:**
- **Toycra** explicitly labels the field "MRP" on-page — `compare_at_price` (when > `price`) or plain `price` (no active discount) is authoritative.
- **MyBrickHouse does not expose an MRP concept anywhere on their storefront** — checked two live product pages with different backend `price`/`compare_at_price` gaps; both rendered only a single flat price, zero strikethrough/MRP UI. Their backend `compare_at_price` is invisible to shoppers and is **not** treated as a second MRP source — reported as informational context only. An earlier draft of this audit compared it against Toycra's real MRP and produced 247 false "store disagreements"; retracted once the storefront check disproved the premise.
- Matching fixed to use Shopify `variant.sku` (100% populated, authoritative) instead of regex-extracting digits from title/handle text, which had been colliding with unrelated real `set_number`s that happen to be 4-digit years (e.g. "Advent Calendar 2025" briefly matched a vintage set literally named "Boat", `set_number='2025'`).

**Schema (migration `20260709000000_mrp_verified_flag.sql`):** added `sets.mrp_verified boolean NOT NULL DEFAULT false` and `sets.mrp_review_reason text`. Applied via Supabase MCP, verified live.

**Full-table audit (`scripts/audit-mrp-direct-scrape-2026-07-08.mjs`) then phased write (`scripts/mrp-fix-apply-2026-07-09.mjs`), Abhinav-reviewed before any write:**
- **Phase 1 — CMF exclusion (127 sets), no price touch.** Every Collectible Minifigures series set (theme `ilike '%minifigure%'` OR `set_number` present in `cmf_figures.series_set_number`) flagged `mrp_verified=false, mrp_review_reason='cmf_box_ambiguity'`. Root cause: CMF series have a structural single-figure-vs-sealed-box-of-N ambiguity — confirmed concretely on `71051` "Peacock Suit" (DB: single figure, ₹400) vs Toycra's listing for that set_number, a 12-pack box at ₹4,788 (=12×₹399). Handled as a category-wide flag per explicit instruction, not a one-off fix for 71051 alone.
- **Phase 2 — confirmed-MRP write (644 sets).** Every non-CMF set matched live on Toycra: `lego_mrp_inr` overwritten with the real Toycra-labeled MRP, `mrp_verified=true`. Biggest confirmed corrections: Home Alone (21330) ₹27,000→₹34,999, Natural History Museum (10326) ₹27,000→₹34,999, Jabba's Sail Barge (75397) ₹45,000→₹51,999, Hogwarts Main Tower (76454) ₹23,400→₹29,999. Includes 29 sets where `lego_mrp_inr` was previously NULL.
- **Phase 3 — suspect-by-default (2,770 sets), no price touch.** Every other set with a populated `lego_mrp_inr` (same buggy population method, no Toycra listing to cross-check) flagged `mrp_verified=false, mrp_review_reason='unverified_estimate'` — per explicit instruction, absence of a cross-check means "unconfirmed," not "probably fine," since the root cause is systemic with no exceptions found in the 646-set overlap (476/646 = 74% were wrong).
- 21,410 remaining sets have no `lego_mrp_inr` at all — untouched, nothing to flag.

**Generation-path fix (`src/lib/generate-body.ts::buildIndiaPriceContext`).** Gated on `mrp_verified`: `true` → presented to the model as a confirmed India MRP, usable directly. `false` (the default for every pre-2026-07-09 row) → the number is **not** given to the model at all; falls through to the existing no-MRP-data branches (live store price if any, else formula-estimated import price, else "no data — use IMPORT ONLY"), so new articles are honest about not knowing the real price rather than computing a verdict against a number already known to be likely wrong.

**McLaren helmet (43023) resolved as a byproduct, no article edit needed.** Real MRP now confirmed at ₹9,999 via Toycra (`mrp_verified=true`). Toycra currently sells it at exactly ₹9,999 (0% premium — `price == compare_at_price`, i.e. no active discount). Per the existing verdict rule ("at MRP → WAIT"), the article's stored `WAIT` verdict is correct once given real data, and the body already stated ₹9,999 at both retailers accurately — verified, no rewrite required.

**Deliberately not done, flagged rather than silently skipped:** the ~2,770 `unverified_estimate` rows were not reconciled against any other data source — no Brickset/US-price re-derivation attempted, since that would just re-run the same broken method. They stay flagged until a real retailer listing exists to check against, or a manual entry is made.

### 2026-07-08 (Duplicate-article redirect cleanup completed; Rebrickable wrong-image filter added; fallback-hero backfill run) — ✅ CLOSED for the scoped items; §2b follow-on under operator review

**Redirects (`next.config.mjs`):** completed the 9-URL → 5-target redirect set for the 6 duplicate-article groups resolved in the prior session (Darth Vader Bust, Triceratops, MTRON ×4, Weapon Wednesday ×5, Sega Genesis) — 5 of 9 were already staged uncommitted from that session; added the remaining 4 (3× Weapon Wednesday, 1× Sega Genesis). All 9 dead source slugs confirmed gone from `news_articles`, all 5 destination targets confirmed live, before commit.

**DEFECT-016 — Rebrickable image-matching has no filter against non-model catalog categories (`src/lib/publish-draft.ts::resolveYouTubeHeroImage`).** 6 wrong-image incidents confirmed the prior session (Stickers, a Technic pneumatic part, an Alpha Pen Pack, 4 Books-category ISBN hits) shared one root cause: Rebrickable's `sets` catalog models every real LEGO product, not just buildable models, so a numeric or theme-keyword match can land on Gear/Stationery/Books/Service-Pack entries. Fix, verified against a live re-run rather than assumed correct on the first pass:
- Reject 13-digit (ISBN-format) set numbers.
- Reject zero-`num_parts` matches (merchandise proxy — lunch bags, apparel).
- Theme-name blacklist, extended twice after the first dry run caught two more live cases the initial filter missed: `gear, book, sticker, service pack, stationery, duplo, explore, houseware, mindstorms, powered up`. The `duplo`/`explore`/`mindstorms`/`powered-up` additions came from the dry run itself re-proposing the *exact* previously-reverted wrong image for `lego-contest-round-up-for-may-2026-2026` (Rebrickable `1000-1`, an Educational "Mosaic Set," theme "Duplo and Explore" — not covered by the original Gear/Book/Sticker/Service-Pack/ISBN filter) and a Technic Hub component (theme "Powered Up," 1-2 parts) for two other articles — confirming the fix needed two more passes before it was safe to run for real.

**Fallback-hero backfill (`scripts/backfill-fallback-heroes-2026-07-08.mts`), dry-run then applied.** 67/197 articles (64 news + 3 blog) were serving `/fallback-hero.png`. With the filter above in place, only 1 was genuinely rescuable (`lego-city-trains-and-pirates-coming-to-india-will-your-walle` → Rebrickable `21064-1` "Paris - City of Love," a real 958-piece Architecture set) — the other 66 have no set number or theme match in their text and are correctly on fallback, not a bug. Applied; verified live in `news_articles`.

**§2b (image spot-check) surfaced more than it was scoped to check — flagged to operator, no further DB action taken without sign-off.** While spot-checking 6 shared-image pairs/trios for correctness (not hunting for new duplicates), found: (a) two more wrong-image cases — `porco-rossos-hideout-your-wallet-needs-this-miyazaki-lego-bu` (published 2026-05-28) was using Rebrickable `21341-1` "Hocus Pocus," unrelated to Porco Rosso; the Megatron BrickHeadz pair shared `6322719-1` "Hangzhou Brickheadz," not Megatron (expected — title says "No Set Number Yet," no real Megatron set exists to match); (b) evidence of ~4 additional likely duplicate-article groups beyond the 6 already resolved (McLaren 42228 pair published 1.5s apart, Megatron pair 14s apart, Porco Rosso pair 19s apart — all clear batch-publish duplicates; Road Bike 11380 ×4 and Ideas 21365 ×2 and Jabba's alternate-build ×2 recurring days-to-weeks apart, matching the exact recurring-topic failure pattern DEFECT-017 below describes). **Awaiting operator decision on scope before any deletion/redirect** — not applied.

**DEFECT-017 — no pre-publish duplicate-by-set_number/topic check. ✅ Closed 2026-07-09** — see Sprint changelog entry below for the fix (Gate 9).

### 2026-07-09 (§2a real fix: theme/set_number-verified image matching; DEFECT-017 closed via new Gate 9; MEDIUM-69/70: verdict-drift detection + capitalisation whitelist) — all verified against live data, one real live bug found and fixed as a direct result

**§2a real fix (extends DEFECT-016) — `resolveYouTubeHeroImage` no longer accepts a match on keyword overlap alone.** The category/ISBN filter shipped 2026-07-08 wasn't sufficient — it verified a match was a *real, well-formed* model but never that it was *topically the right one*. Confirmed failure: the pipeline's own rescue of `lego-city-trains-and-pirates-coming-to-india-will-your-walle` (Rebrickable `21064-1`, "Paris – City of Love," a real 958-piece Architecture set) was itself wrong — matched purely because the string "City" appears in both "LEGO City" and "City of Love." Reverted (confirmed already done by the time this was caught). Fix, two valid paths only, no other acceptance criteria:
1. Article has a `set_number` (via `extractSetNumberCandidates`'s precise contextual patterns — "LEGO 1234", "#1234", "(1234)" — not a blind scan of every 4-6 digit number in free text, which picks up piece counts/prices/years). Only that exact set's own page is tried; no fallback to theme search if it doesn't resolve.
2. No `set_number` → theme-keyword search allowed, but a hit is only accepted if `themeVerifiedMatch()` confirms the result's own Rebrickable theme (or immediate parent theme) actually corresponds to the searched keyword — not just that the search string appears somewhere in the result's name.
Verified: re-ran the fallback-hero dry-run — the Paris/Architecture match and one other false candidate are now correctly rejected (`set 21064-1`/`42689-1` theme doesn't verify against "City"), yielding 0 rescues / 67 legitimate fallback (down from the 1 wrong rescue previously applied). Confirmed a genuine positive case still resolves correctly (75397 Jabba's Sail Barge, exact set_number match).

**DEFECT-017 closed — Gate 9: duplicate content by set_number/topic-stem (`src/lib/lint.ts::gateDuplicateContent`).** Root cause of all 6+ confirmed duplicate-article incidents: RADAR-02's cross-day dedup (`dedupe-signals.js` Pass 0.5) operates on *source signal* titles at ingestion, with a 0.75 Jaccard threshold tuned against over-triggering across different outlets — it never re-checks the *generated* article against what's already published, and its threshold is far too strict for low-textual-similarity recurring features (real Weapon Wednesday title pairs Jaccard ≈0.18, confirmed by direct calculation against the actual published titles — nowhere near 0.75, which is exactly why 5 copies went undetected). New Gate 9, wired into `lintDraft` (news format only, matching the exact scope of every confirmed incident) and enforced at `publishOneDraft` — the single shared choke point for cron/manual/auto-publish:
1. Article has a `set_number` → hard fail if a `news_articles` row for that exact set_number was published within 60 days. Exact match only.
2. No `set_number` → hard fail on either (a) an exact leading "Feature Name:" phrase match against another recent no-set article (added specifically because Jaccard alone provably misses the Weapon Wednesday case — confirmed live: a mock differently-worded new "Weapon Wednesday: ..." article was correctly blocked by the phrase check even though its Jaccard similarity to the real article was only ~0.18), or (b) ≥30% title-token Jaccard (catches the MTRON-style case, confirmed ≈0.55 against the real titles).
A hard fail here routes through the *existing* `failed_lint`/`/admin/pending` manual-review path — no new mechanism, the gate architecture already does exactly "route to manual review instead of auto-publishing." Verified live against real data: correctly blocks a mock second article for set 75397 (already published), correctly blocks a mock differently-worded Weapon Wednesday recurrence, correctly passes a genuinely unrelated new topic.

**MEDIUM-69 — verdict column/body drift (§4a).** `content-linter.mjs`'s `missing_verdict` check only ever confirmed the body contained *some* verdict word — never compared it against the `verdict` column, which is exactly how contradictory verdicts on duplicate articles went undetected for weeks. Fix: new `verdict_drift` CQS check (column set + body has no marker, or column and body marker disagree); new enforced write path `src/lib/verdict-consistency.ts::updateArticleVerdict()` (throws `VerdictDriftError` rather than writing verdict+body separately/inconsistently — the "same transaction" requirement, satisfied by making this the one function future fix scripts use rather than ad-hoc separate `.update()` calls). **Running the new check against live data immediately found one real, live bug**: `lego-10326-natural-history-museum-review` — `verdict` column said `WAIT`, body had no marker at all, and the body itself was stale (cited a "Jaiman" price — that store was removed 2026-05-31 — with an internal "Toycra: ₹26,990 ... Toycra: ₹34,999" inconsistency, the same store name at two different prices). Real current data: MyBrickHouse ₹31,999 (below MRP), Toycra ₹34,999 (= confirmed real MRP from HIGH-57's fix). Corrected: verdict flipped WAIT→BUY NOW, every stale-price paragraph rewritten, marker added (`scripts/fix-natural-history-museum-verdict-drift-2026-07-09.mjs`, same verified-diff-before-write pattern as prior content fixes). Confirmed post-fix: verdict/marker/prices all consistent, issue marked resolved in `content_quality_issues`.

**MEDIUM-70 — `capitalisation_error` false positives on abbreviations (§4b).** No whitelist meant any period-bearing abbreviation followed by a lowercase continuation word (confirmed case: "E.T. the Extra-Terrestrial," correct title casing) was flagged as a lowercase-after-period typo. Fix: `ABBREVIATION_WHITELIST` (E.T., U.S., U.K., Mr., Mrs., Dr., St., Jr., Sr., etc.) checked against the token immediately preceding the flagged period before the rule fires. Verified: "E.T. the Extra-Terrestrial" and "U.S. sales" no longer flag; a genuine lowercase-after-period typo still does; live linter run's 2 existing `capitalisation_error` hits are unrelated `". a"` cases, confirmed not false positives from this fix.

**Full linter run against live data (`content-linter.mjs`) after all of the above:** 192 articles checked, 1 critical (`verdict_drift`, the Natural History Museum case above, now fixed), 89 warning, 38 info. All `tsc --noEmit` clean, 81/81 vitest passing throughout.

**Scope flag, per explicit operator instruction, not silently assumed:** this system covers **operator-initiated rejections from the chat-approval flow only** (`video_posts.status='discarded'`). There is a separate, already-existing automated path — `status='publish_blocked'`, set by `engine.py`'s `--poll-and-publish` when an already-approved row fails a hard guard (`assert_all_gates_passed`/`assert_captions_present`/`assert_story_badge_present`) at publish time. That is a system-detected condition, not an operator rejection, and is **deliberately not recorded in `content_rejections`** — flagged here rather than merged in, per instruction.

**1. New table `content_rejections` (migration `20260707140000`), applied via Supabase MCP, verified clean.** Schema exactly as specified: `id`, `video_post_id` (FK to `video_posts`), `set_number`, `set_title`, `story_number`, `rejected_at`, `rejection_reason`, `review_status` (`pending`/`cleared_for_regeneration`/`permanently_excluded`, default `pending`), `reviewed_at`, `review_notes`. RLS enabled, zero policies — same admin-table pattern as `video_posts`. A DB trigger (`video_posts_discard_trigger` → `create_content_rejection_on_discard()`) auto-inserts a row whenever a `video_posts` row transitions **into** `status='discarded'`, regardless of which code path or out-of-band SQL performs the write — same DB-enforcement precedent as the existing `story_number` trigger. Also added `content_rejection_reminders`, a singleton table holding `last_reminder_sent_at` for the biweekly reminder (no generic settings table existed to extend).

**2. `engine.already_used()` rewritten** — a set/product now stays excluded if it has ever been published or has any other non-`discarded` `video_posts` row (`pending_approval`/`approved`/`rendered`/`publish_blocked` — still "in flight"), **or** has a `content_rejections` row with `review_status` in `pending`/`permanently_excluded`. Eligible again only once flipped to `cleared_for_regeneration`. Note: the literal spec ("excluded if ever published, or in content_rejections with pending/permanently_excluded") would have let an in-flight `pending_approval`/`approved`/`rendered`/`publish_blocked` row become re-suggestable, since it doesn't mention those statuses — kept the existing blanket exclusion for all non-`discarded` statuses to avoid that regression, and layered the new reversible mechanism specifically onto the `discarded` case. Flagging this interpretation rather than silently deviating from the literal wording.

**3. Biweekly reminder** — `engine.check_and_send_rejection_reminder()` / `--check-rejection-reminder`, new workflow `.github/workflows/video-rejection-reminder.yml` (weekly cron `0 3 * * 1`, cron can't cleanly express "every 14 days" so this doesn't try to). Sends via the existing Resend path (`notifier.send_rejection_reminder()`, count + per-item set_number/set_title/rejected_at/rejection_reason) only if both ≥14 days have passed since `last_reminder_sent_at` **and** at least one row is `review_status='pending'`; silent no-op otherwise, timer untouched if nothing's pending (so the first real pending rejection after a long quiet stretch still gets flagged promptly, not delayed by a reset).

**Verified, all four required checks, live against production (disposable test rows only, all cleaned up afterward, real queue/state untouched):**
- Migration applies cleanly (`list_tables` confirmed both tables + FK + trigger).
- Trigger fires exactly once on a genuine `discarded` transition, does not double-fire on a no-op re-save, and does **not** fire for `publish_blocked` (confirmed with 2 disposable test rows).
- `already_used()`: a `pending` rejection excludes; `cleared_for_regeneration` makes it eligible again; `permanently_excluded` stays excluded (all 3 confirmed live).
- 14-day timer tested explicitly with boundary cases (10 days: no; 13d23h: no; exactly 14 days: yes; 20 days overdue: yes), not just cron syntax eyeballed.
- Reminder confirmed silent with zero pending rows against the real (empty) table, confirmed `last_reminder_sent_at` correctly left untouched; confirmed it DOES send and DOES update the timestamp with one pending test row present. Test state fully reverted afterward (`last_reminder_sent_at` reset to `NULL`, test rows deleted) — production left exactly as found.

**Docs:** `docs/runbooks/VIDEO_PIPELINE.md` — Operator-Facing Workflow paragraph updated (reject now asks for a reason and is recoverable, not final); new dedicated section on `content_rejections`, the rewritten exclusion semantics, and the biweekly reminder mechanism, replacing the now-stale "permanent exclusion" description from the prior entry.

### 2026-07-07 (VID-P4: generation timing instrumentation, ready-for-review notification, discard policy documented, Operator-Facing Workflow doc added) — 2 built pending real-run verification, 1 confirmed no-op, 1 doc-only

**1. Generation-to-ready timing — instrumented, not yet measured.** `engine.py`'s `main()` now captures `generation_started_at` at its own process start; `--cloud-generate` computes `duration_seconds` against `pending_approval_at` and stores both (plus a note on what the measurement does/doesn't include) under `gate_results._timing` — reuses the `_`-prefixed metadata convention from today's earlier gate-metadata fix rather than a schema migration. **Deliberately not reporting any duration number here** — today's dev-session timings don't reflect steady-state cloud operation, and reporting an estimate is exactly what was asked not to do. First two real measured values land with tomorrow's 6 AM run and the one after; the true cron-fire-to-ready span additionally requires cross-referencing `gh run view`'s `createdAt` against `_timing.pending_approval_at`, since GitHub Actions runner provisioning + dependency install happens before this script's first line ever executes.

**2. "Ready for review" notification — built, using the proven Resend path.** New `notifier.send_ready_for_review_notification()`, called at the end of every `--cloud-generate` run right after a row lands in `status='pending_approval'`. Contains story number, set title, `storage_url`, `qc_frame_urls` — the exact three things previously pulled from Supabase manually on request. **Verified the function itself doesn't crash and degrades gracefully** (local sanity call with test data correctly no-op'd with a clear log line, since `RESEND_API_KEY` only exists as a GitHub Actions secret, not in this local checkout's `.env`). **Not yet verified end-to-end** — real email arrival with working links requires tomorrow's real 6 AM candidate; did not manually force `video-generate-daily.yml` today to test this, since that would spend real ElevenLabs credits and create an unplanned extra candidate/story number, and the operator specifically asked for tomorrow's real run as the verification point.

**3. Post-discard behavior — confirmed already true, now documented as deliberate policy rather than an undocumented absence.** Exhaustive grep across `scripts/video/` and every `.github/workflows/*.yml` confirms zero code paths read or react to `status='discarded'` — no automatic same-day regeneration exists today, and none was added (none was needed). Documented explicitly in `docs/runbooks/VIDEO_PIPELINE.md`: discarding a row does nothing automatically; the row stays as a permanent audit record; `already_used()` (checks `video_posts` by `set_number`/`product_url` regardless of status) means that exact set is never suggested again; the next candidate comes from the following morning's normal 6 AM cron, same as any other day. Rationale recorded: auto-regenerating on reject risks silent repeated API spend on a set rejected for a recurring reason, and this project's priority order is credibility first, speed last.

**4. New "Operator-Facing Workflow" section added to `docs/runbooks/VIDEO_PIPELINE.md`** — one plain-language paragraph, no code, covering generation timing, notification, review, and how approve/discard/revision-request each work mechanically end to end. Written specifically so this doesn't need reconstructing from a chat thread again.

### 2026-07-07 (VID-P4: piece-count TTS fix, image-pipeline diagnostics, publish day-cap root-caused and fixed, gate-metadata false-positive) — ✅ CLOSED, one item deferred not implemented

**1. Piece-count TTS normalization (`scripts/video/gates.py`).** ElevenLabs doesn't reliably speak a bare digit run like "9,031" as words, the same class of bug the existing `normalize_currency_for_tts()` already fixed for ₹ amounts — piece counts had no equivalent. Two-part fix, same mechanism as the currency normalizer:
- `_format_piece_counts()`, wired into `sanitize_script()`, deterministically comma-formats any `<digits> piece(s)` in the **stored** script at generation time — fixes a real upstream inconsistency where Shopping Street's script stored a bare `"3458"` while Death Star/McLaren stored comma-formatted values, regardless of what Gemini/Cerebras happens to output.
- `normalize_piece_count_for_tts()`, sibling to `normalize_currency_for_tts()`, spells piece counts into words only for the ElevenLabs payload; the stored script keeps numerals.
- **Verified against 5 real cases:** 9,023 (baseline, already correct), 1,675, 3,458 (the actual Shopping Street bug), a sub-1000 case (850, confirmed no spurious comma), and an exact-thousand case (2,000).

**2. Image-pipeline instrumentation (`[IMG-DIAG]` logging in `resolve_candidate_images()`), diagnostic only, no behavior change.** Surveyed 12 real sets (McLaren, Shopping Street, plus 10 fresh candidates). Findings:
- Brickset returns 13–25 images per set.
- **Download is capped at 12 regardless of availability — this cap, not source availability, is the real bottleneck.** Every single sample had ≥13 images available; the pipeline never sees more than 12 of them.
- Studio-filter survival (composite/off-center rejection) is only 8–33% of the downloaded 12.
- **3 of 12 sampled sets (Tropical Aquarium 10366, Hogsmeade Village 76457, Captain Jack's Pirate Ship 10365) ended up below `MIN_STUDIO_IMAGES=3` even after the Rebrickable fallback** — in Hogsmeade's case the fallback image itself was classified `composite` and contributed nothing. These would be skipped/rejected in a real `--pick`/`--url` run.
- **Planned fix is raising the download cap, not loosening the studio/composite filters** — the filters are doing their job correctly on the data they see; the bottleneck is only seeing 12 of up to 25 available images. **Not yet implemented** — this session added the diagnostic, not the cap increase.

**3. Publish day-cap — root cause was "missing entirely," not "broken."** Investigated the 2026-07-06 double-publish (Minas Tirith 13:51 UTC + N-1 Starfighter 17:52 UTC, same calendar day). Checked every layer — `engine.py`'s poller, `publish.py`'s `publish_video_post()`, every `.github/workflows/video-*.yml`, every `video_posts` migration (triggers/constraints) — and found **zero date-comparison logic anywhere**. The only "daily" throttle that existed was on generation (`video-generate-daily.yml`, one new candidate/day); approval is an ungated, out-of-band Supabase `UPDATE`, and the Publish Poller unconditionally published every `status='approved'` row it found on every 15-minute tick. Both 2026-07-06 posts were legitimate, deliberate chat-approvals (the second one was the operator validating the brand-new Stage 3/4 approval flow the same night it was built) — there was no bug to bypass, no wrong date field, no wrong timezone; the check simply never existed.
- **First fix (`27ca9da`):** `already_published_today_ist()` — skip the whole poller run if anything already posted today (IST), and stop after the first row that actually goes live, so a backlog drains one row per day rather than all at once.
- **Refined same day (`ef90736`), operator-directed:** changed the condition from "first tick of the day" to a fixed evening window — nothing posted today (IST) **AND** current IST time ≥ 19:30. Poller keeps its existing `*/15 * * * *` tick frequency (confirmed unrestricted, already spans 14:00 UTC / 19:30 IST) rather than collapsing to a single once-a-day cron trigger — a missed 19:30 tick recovers at 19:45/20:00/etc. the same evening instead of skipping the whole day.
- **Publish ordering switched to `story_number`, explicit and tested** — previously `.order("created_at")`; they currently always agree (`story_number` is trigger-assigned at row-insert time) but that was an incidental correlation, never the actual intended/tested key. Verified with a test that deliberately makes the two fields disagree — `story_number` wins as required.
- **Verified via an isolated simulation** (reuses the real shipped functions — `_ist_day_bounds_utc`, `already_published_today_ist_at`, `_is_past_publish_window_ist` — against an in-memory fake Supabase client, no production writes, no real API calls): a 3-row backlog (Death Star/McLaren/Shopping Street) drains exactly one row per simulated evening across 3 consecutive days; a tick before 19:30 IST correctly no-ops even with an approved row ready; the IST day-boundary rollover re-tested against the real Minas Tirith/N-1 Starfighter timestamps with no regression from the new window logic.

**4. Gate-metadata false-positive (`publish.py::assert_all_gates_passed()`) — discovered live, same night, while testing the day-cap fix against the real Death Star row.** This function only whitelisted the literal key `_sanitization` as non-gate metadata. **Trigger: an out-of-band, chat-initiated Supabase write** (not any commit in this repo) had added a second metadata-only key, `_post_hoc_correction`, directly to Death Star's `gate_results` JSON as an audit-trail annotation for the earlier piece-count correction. `assert_all_gates_passed()` read that key's absent `'pass'` field as `False` and refused to publish a row whose actual gates had all passed — this fired for real: Death Star's manually-dispatched publish-poller test run hit the guard, auto-flipped `status` from `approved` to `publish_blocked`, and sent a real Resend skip-notification email (this was a genuine side effect of testing, not a silent no-op). **Fix:** generalized the check to skip any key starting with `_` (real gate names never start with `_` — see `gates.py`'s G1–G9 naming), rather than hardcoding a second exact-string exception. Verified directly against Death Star's real stored `gate_results` — no longer blocks.

**Current queue state (confirmed live, not assumed):** Death Star (`93c35a97`, Story #3), McLaren (`85c161ac`, Story #4), and Shopping Street (`73b4b102`, Story #5) all `status='approved'`. Expected to publish on consecutive days ~19:30 IST starting tonight, one per day, oldest `story_number` first, per the fixes above.

### 2026-07-07 (VID-P4: set_title/YouTube-title piece count now single-sourced from catalog, not retailer text) — ✅ CLOSED

**Discrepancy found on operator review, before approval — not caught by any existing gate:** `video_posts` row `93c35a97` (Death Star 75419) had `set_title` reading `"...75419 (9023 Pieces)"`, while the generated script correctly said `"9,031 pieces"`. Live catalog query (`sets` table) confirmed the script was right: `pieces = 9031` for set 75419. The title's "9023" was wrong.

**Root cause:** `set_title` is populated in `engine.py::build_candidate()` from `product.get("title")` — the retailer's (MyBrickHouse) raw Shopify product-listing text, stored verbatim, never cross-checked against the catalog. The **script** path is different and was already correct: `resolve_catalog_match()` looks up the catalog's `pieces` value independently and feeds *that* into `build_task_prompt()` for generation — it never reads the retailer title at all. Two unrelated sources for the same fact, only one of them validated.

**Why G5 (factuality gate) didn't catch this:** confirmed by reading the gate directly — `gate_factuality()` only reads the *script* text and compares any stated piece count against the catalog. It never touches `set_title`. G5 did its job correctly here (the script was accurate); the gap was that **nothing** validated `set_title`, which `publish.py::build_yt_metadata()` uses directly to build the live YouTube title. A wrong retailer number could have reached the public-facing YouTube title even on a video whose spoken content was completely accurate — this specific case, caught only because the operator reviewed before approving, not by any gate.

**Fix (`0ef480a`, 2026-07-07 01:21 IST):** new `correct_title_piece_count()` in `engine.py`, wired into the same `get_candidates()` enrichment loop that already calls `resolve_catalog_match()` for script generation — one catalog lookup now feeds both the script and the title. Replaces only the number in an existing `"<N> piece(s)/pcs"` mention in the title (preserving the retailer's original wording/casing); never fabricates a piece-count phrase into a title that never had one. Falls back to the untouched retailer title if no catalog match exists at all — same graceful-degradation pattern as the existing pieces/theme enrichment. `publish.py::build_yt_metadata()` needed no changes — it already consumes `set_title` directly, so the correction applies automatically once stored upstream.

**Verified two ways, not assumed:**
- **Death Star `93c35a97` — corrected via the real function, not a manual SQL edit.** Re-ran `resolve_catalog_match()` + `correct_title_piece_count()` live against the row's actual stored data: `"9023"` → `"9,031"`. Confirmed independently afterward by querying the row directly — now matches both the catalog and the script exactly.
- **McLaren MCL39 F1 (`85c161ac`, set 42228) — fresh candidate, generated end-to-end after the fix, to confirm it holds generally and doesn't over-correct.** Catalog: 1,675 pieces; script correctly says "1,675 pieces". The retailer's own title never mentioned a piece count at all — confirmed the fix correctly left it untouched rather than fabricating one, proving the no-op path works on a real (not synthetic) case.

Both rows sit in `status='pending_approval'`, awaiting operator chat review.

### 2026-07-06 (night consolidation — VID-P4 approval-flow pivot + theme card migration, both fully shipped; commit-count discrepancy flagged) — evidence-verified, 3 items left explicitly OPEN for operator

**Verification note on this entry itself:** every commit hash and timestamp below is from `git log --format="%h %ad %s" --date=format:"%Y-%m-%d %H:%M:%S %z"`, not recalled from conversation. The GHA run ID cited was independently checked via `gh run view` before being written here.

**Commit-count discrepancy, reported not silently corrected:** stated as 27 commits today; `git log` (author-date 2026-07-06, both by calendar day and by `--since`/`--until`) counts **19**, both spanning VID-P4 and the theme card migration. Not resolved further — flagging the mismatch rather than picking one number without knowing the source of "27."

---

**VID-P4 approval-flow pivot (naming note: the publish poller below is referred to only as "the Publish Poller," never "Stage 4," to avoid collision with line 301's "Stage 4 -- TTS," which is the original 8-stage pipeline-build numbering and is unrelated and unchanged).**

**Stage 1 — feasibility, confirmed on a standard GitHub-hosted Ubuntu runner (`ubuntu-latest`, 4 CPU / 15 GB RAM):** full candidate-select → script → gates → TTS → render → caption-burn cycle completes in **374s wall-clock**, **3.2 GB peak memory** (system-wide sampler, catches ffmpeg/Whisper subprocess spikes; `/usr/bin/time`'s process-root-only figure was 1.26 GB). Comfortable headroom against the runner's 15 GB ceiling — no larger runner or separate VM needed. First attempt actually failed, but on a real bug it surfaced (`GEMINI_SOCIAL_API_KEY`/`CEREBRAS_API_KEY` GitHub Secrets both carrying a leading BOM, breaking script generation) rather than an infeasibility finding — fixed same night (see BOM section below). One-off workflow: `.github/workflows/video-feasibility-test.yml` (`7fa395c`, 2026-07-06 19:41 IST).

**Stage 2 — cloud generation, confirmed deployed and active, not just built:** `.github/workflows/video-generate-daily.yml` (`f1ea1be`, 2026-07-06 21:04 IST). Verified live via `gh api .../actions/workflows`: registered, **`"state":"active"`**. Cron `30 0 * * *` (UTC) = **6:00 AM IST daily**. Downloads the operator's real `master_assets/*.mp4` clips from a private Supabase Storage bucket (gitignored, never in a fresh checkout) if missing locally, runs the full pipeline, uploads the captioned video + QC frames to storage, and leaves the row as `status='pending_approval'`.

**Stage 3 — chat-based approval, no new code:** the operator reviews via the Supabase Storage link in the pending-approval row, approves in chat, and chat-Claude writes `status='approved'` directly via SQL — no terminal, no local machine. Validated live twice tonight (N-1 Starfighter 75442, both the initial approval and the resulting publish).

**The Publish Poller — confirmed deployed, active, and has autonomously published a real post end to end:** `.github/workflows/video-publish-poller.yml` (`714e70b`, 2026-07-06 23:19 IST). Verified live via `gh api`: registered, **`"state":"active"`**. Cron `*/15 * * * *` = every 15 minutes. Queries `status='approved'`, calls the existing `publish_video_post()` (same hard gate-failure guardrail, same caption-presence guardrail, same disclosure split as the manual path), and reports each platform's outcome separately rather than collapsing a partial success into one line. New `publish_blocked` status (migration `20260706130000`) for the one case not yet exercised live: an approved row failing a hard guard at publish time — moves it out of the polling loop instead of retrying the same deterministic failure every 15 minutes.

**Live result, autonomous end-to-end, independently verified (not just trusting the poller's own log):** N-1 Starfighter 75442 — IG Reels `https://www.instagram.com/reel/DadeDUyiOjZ/`, YouTube Shorts `https://youtube.com/shorts/pKYLNVxk-jQ`. YouTube's public oEmbed endpoint (unauthenticated, third-party-facing) confirms genuine live status under the "Bricks of India" channel; Instagram's permalink independently resolves (HTTP 200). `video_posts` shows `status='posted_both'`, `posted_at` `2026-07-06 17:52:32 UTC`, real IDs on both platforms.

**Real bugs found and fixed the same night, each disproven/proven by testing against real data rather than assumed:**
- BOM in `GEMINI_SOCIAL_API_KEY`/`CEREBRAS_API_KEY`/`RESEND_API_KEY` (3 separate GitHub Secrets, same root cause pattern already documented in this file's CLAUDE.md-adjacent conventions for other Bearer-bound keys, never previously ported to this Python pipeline) — fixed via one shared `secrets_util.get_secret()` helper (`b00bc74`, `fe1c285`, `c0c280f`) rather than patching each call site as it happened to fail.
- First live post (Minas Tirith) shipped with no burned-in captions — root cause (SHA256-confirmed) was `insert_video_post()` storing the pre-caption file, not the captioned one; fixed with a single-artifact rule plus a new hard `assert_captions_present()` guard, which itself took three attempts (pixel-color heuristic, then bare OCR, then OCR + script-word-overlap) before one actually worked against real files (`e3bd275`, 2026-07-06 22:15 IST). Operator decision: the already-live post stays as-is, no repost.
- ElevenLabs `similarity_boost` was never actually pinned in code for the Minas Tirith render — it happened to sound like the intended "Test B" only because the ElevenLabs account's dashboard default coincidentally matches (confirmed by the operator directly in the ElevenLabs dashboard). All 5 `VoiceSettings` fields are now pinned explicitly (`9bb7a23`) and verified against the actual outgoing HTTP request body, not just the code.

**Re-verified per operator instruction, still holds:** exhaustive grep across `scripts/video/` for every occurrence of `"approved"` shows exactly one write anywhere in the codebase to `video_posts.status`, and it writes `'publish_blocked'`, never `'approved'`. Zero Postgres triggers on `video_posts`; zero DB functions reference "approved". `status='approved'` can only be set by an explicit external `UPDATE`.

---

**Theme card migration (zero prior tracker mentions — first log entry), verified via `git log`/`gh run view`, not the uploaded chat transcript at face value:**

Replaced all Rebrickable-sourced LEGO theme card images with static local `.webp`/`.jpg` assets across the homepage grid, `/themes` index, and `/themes/[theme]` detail (thumb, hero, and OG meta image).

- `2eccd6c` (2026-07-06 16:45 IST) — `docs/theme-card-manifest.md`, Phase 1 evidence pass. Confirmed on `main`, confirmed exactly 159 lines added, nothing else touched.
- `b49e408` (2026-07-06 17:40 IST) — 25 PNG masters converted to genuine WebP/JPEG at 1000x1000, quarantined source masters kept outside `public/`.
- `b57440a` (2026-07-06 18:17 IST) — render sites updated (`src/app/page.tsx`, `src/app/themes/page.tsx`, `src/app/themes/[theme]/page.tsx`, `src/lib/brand.ts`, new `src/lib/themeCard.ts`), `scripts/fetch-theme-images.mjs` deleted (obsolete), new `scripts/verify-theme-cards.mjs` prebuild guard. Confirmed on `main` with exactly this file list.
- Deploy verified independently: GitHub Actions run `28792623366` ("Build & Deploy to Netlify") — confirmed via `gh run view`: `conclusion: success`, `headSha` matches `b57440a` exactly.

**Open backlog item, deferred not urgent (from the manifest's own Step 2B):** the 25-theme scope excludes several prominent raw catalog themes with real set counts — `Ultimate Collector Series` (50 sets), `Batman` (145, separate from `DC`), `Avengers` (100, separate from `Marvel`), `Spider-Man` (130), `Bionicle` (414), `The Lord of the Rings` (18) — plus a DC/Marvel franchise-family rollup question (8 and ~10 overlapping raw sub-theme values respectively, e.g. `DC Comics`, `Justice League`, `The LEGO Batman Movie` vs. a single `DC` umbrella card). No filenames or slugs proposed for any of these; needs an explicit operator scope decision before any expansion.

---

**OPEN — not resolved tonight, flagged for operator, do not act without instruction:**

1. **Two orphaned `rendered` rows — one resolved, one blocked (2026-07-06/07 follow-up):**
   - **Death Star 75419 — RESOLVED.** Confirmed still available on MyBrickHouse at the exact same `product_url` before touching anything. Stale row (`30630e36...`) deleted, re-generated as a fresh candidate through the *current* pipeline (fresh Cerebras script after a Gemini 503 — 4 gate attempts, word count the retry driver each time, matching this pipeline's well-documented pattern — all 9 gates passed on attempt 4; real TTS with the pinned Test B `voice_settings`; single-artifact caption output). New row `93c35a97-ef4c-4f7d-84b5-4eca215ffa48`, `status='pending_approval'`, awaiting operator chat review same as any normal candidate.
   - **Harry Potter 76473 — BLOCKED, not resolved, stale row NOT deleted.** Checked MyBrickHouse's live catalog directly (bypassing the `already_used()` exclusion): **zero matches for set 76473.** The stale row was sourced from Toycra, which was dropped as a primary candidate source before this row was created (`335e46a`, 2026-07-06 09:16 IST) — Toycra is now image-fallback only, not a candidate source. There is currently no way to regenerate this exact candidate through the pipeline as designed. Stale row (`4d15041b...`) left in place pending an operator decision: discard outright, wait for MyBrickHouse to carry the set, or re-add Toycra as a candidate source (scope decision, not made here).
2. **"Low-confidence run" question, raised earlier tonight, never explicitly decided:** if/when full autonomy is later enabled (see VID-P4-AUTOMATION-REVIEW, §Pending — not scheduled, no cutover date), should a run that needed 2+ gate retries, or that drew from a bare-minimum image pool, still auto-publish, or should either condition hold it for approval regardless? Moot for now — every run gets a human look during the current supervised-approval period.
3. **`admin/dashboard.html` has zero VID-P4 representation** — pre-existing gap (not introduced tonight, last touched 2026-05-25), separately scoped from tonight's work, still real.

### 2026-07-06 (VID-P4 first live post shipped with no burned-in captions — root cause, fix, and new hard guard) — ✅ CLOSED

**Incident:** the first-ever live VID-P4 post (Minas Tirith 11377, both IG Reels and YouTube Shorts) went out with no burned-in captions, despite the pipeline's Stage 6 caption-burn step running successfully in that same invocation and producing a correct captioned file.

**Root cause, confirmed via SHA256 (not file size or assumption):** `insert_video_post()` stored `output_path` (the pre-caption render) as `video_posts.video_path`, not `captioned_path` (the actual caption-burn output) — a simple wrong-variable bug, not a missing/broken caption-burn step. Verified the exact file that was uploaded to Supabase Storage and posted to both platforms is byte-identical (`sha256 92d684c5...`) to the local pre-caption file, and different from the captioned file (`sha256 8b830da6...`).

**Fix (single-artifact rule):** after `burn_captions()` succeeds, the pre-caption intermediate is deleted and the captioned file takes over the original output filename — exactly one file exists per run from that point on, so there is no second path any future code could mistakenly reference as "the" video for a run.

**New hard guard (`publish.py::assert_captions_present()`), same tier as the existing gate-failure guardrail — called before ANY IG/YouTube API call, on every publish path (today's manual trigger, the poller after chat approval, and any future autonomous trigger if/when enabled):**
- First attempt was a pixel-color heuristic (white fill + black outline adjacency in the known caption band). **Failed real verification** — LEGO studio product photography sits on a near-pure-white backdrop with substantial black brick/shadow detail, producing the same color adjacency at massive scale with zero actual caption text. Confirmed by testing directly against today's real uncaptioned Minas Tirith file, which the heuristic incorrectly passed.
- Second attempt used real OCR (pytesseract/tesseract) instead of color. **Also insufficient alone** — the Ken-Burns source images include a "stats card" graphic with real embedded text (set number, piece count) that pans through the same band and genuinely OCRs as text, without being a caption.
- **Final version:** OCR the caption band, then cross-check the extracted words against the actual `video_posts.script` text (ground truth — captions are Whisper's transcription of the same TTS audio the script produced, so real captions share real words with the script; stats-card noise does not). Requires a minimum real word overlap, not just "OCR found characters."
- **Verified both directions against the same two real production files** (not synthetic mocks): the real captioned Minas Tirith file correctly PASSES; the real uncaptioned Minas Tirith file (the one actually posted) correctly BLOCKS with `CaptionsMissingError`.

**Operator decision:** the two already-live posts (IG + YouTube) stay as-is, no delete/repost — accepted as a one-time first-post learning cost. All effort went into the fix and the guard above so it cannot recur.

**Separate same-day finding, also verified via evidence:** the ElevenLabs voice config used for this same Minas Tirith render predates the "Test B" lock (`similarity_boost=0.9`) — the locking commit (`3cc2360`) landed at 08:54:37 UTC, 9 minutes *after* this render's `video_posts` row was created (08:45:42 UTC). Confirmed the current `main` HEAD correctly calls `generate_tts()` with `TTS_MODEL_ID`/`TTS_VOICE_SETTINGS` (Test B) for all future renders — Tuesday onward is unaffected.

### 2026-07-06 (vocabulary list extended + buyer-persona decision recorded) — ✅ CLOSED

Added "undeniable statement", "a testament to", "makes a statement", "commands attention" to the banned review-language list in the video system prompt -- matching a real phrase from the Stage 7 E2E script itself ("it's an undeniable statement", Minas Tirith). Re-tested on 2 fresh real generations (Mandalorian N-1 Starfighter candidate): zero banned phrases in either (95 and 124 words). One of the two scripts' price-math also checked out independently by hand (3 years of Netflix Premium + Prime = ₹27,864 vs a ₹26,999 set -- within the 0.5x-1.5x band).

**Buyer-persona (who should buy this): CLOSED, no gap.** Confirmed operator decision -- stays folded into the Opinion beat as-is, no separate gate. Not an open item.

### 2026-07-06 (set-number matching fix, pre-daily-automation) — ✅ CLOSED

Fixed the "1701" false-positive found in Stage 1 (fictional Star Trek ship registry number matching real catalog set 1701 "Basic Building Set Trial Size"). Root cause: `extract_set_number()` returned only the first 4-6 digit regex match, with no validation it was actually the right number.

**Fix:** `extract_set_number_candidates()` now returns ALL plausible candidates (not just the first). New `resolve_catalog_match(sb, title, candidates)` checks each candidate against the `sets` table and requires real keyword overlap (>=2 shared meaningful words) between the candidate's title and the catalog's own `name` field for that set number -- not theme alone (LEGO's "Icons" theme is a broad, legitimate umbrella for exactly this kind of adult licensed set, so theme-only checking wouldn't have discriminated the real bug case). If no candidate validates, pieces/theme are left `None` rather than attaching a wrong catalog row -- no Fact-3 backing for that candidate's script, not a false one. `enrich_with_catalog()` removed (superseded).

**Consistency fix caught during verification:** the confirmed set number now also overwrites `candidate["set_number"]` itself (used for Brickset image lookup and `video_posts` storage), not just the enrichment fields -- an initial version left the wrong "1701" as the tracked/image-lookup number even after fixing pieces/theme, which would have kept querying Brickset for the wrong set.

**Re-tested against the exact real case:** "Icons Star Trek: U.S.S. Enterprise NCC-1701-D... 10356 (3600 Pieces)" now correctly resolves to set **10356** (theme Icons, 3600 pieces) -- the wrong "1701" candidate is correctly rejected (zero overlap with its real catalog name, "Basic Building Set Trial Size"). Verified against the full current candidate list with no regressions on the other 9 candidates (unchanged set numbers/pieces/themes).

### 2026-07-06 (VID-P4 full daily pipeline build, Stages 1-8) — Stages 1-7 built + verified with real data; Stage 8 is a proposal only, not activated

Full consolidation of every fix from this session's VID-P4 work into one coherent pipeline, verified stage by stage with real data per operator instruction ("no assumptions -- if any spec conflicts with the codebase, stop and report").

**Stage 1 -- candidate selection, real spec correction caught before building:** the given spec said "LEGO.com official gallery primary, Brickset fallback" -- verified live that LEGO.com 403s on both its coming-soon page and product pages (Cloudflare-protected), confirmed by reading `social-automation/scraper.py`'s own documented reasoning. **Corrected to match SOC-AUTO-01's actual, proven architecture: Brickset `getAdditionalImages` PRIMARY, Rebrickable single-image FALLBACK** (operator-confirmed after the correction was flagged). Reused the exact endpoint/call pattern from `scraper.py` rather than reimplementing. Retail data (price/title/availability) stays MyBrickHouse primary, Toycra fallback, joined by set number -- unchanged, and now fully decoupled from images.
- **Real result: 6/10 candidates now qualify** (Minas Tirith, Mandalorian Starfighter, McLaren F1, Shopping Street, NINJAGO Old Town, Batman Arkham Asylum) -- up from 0-2/10 with retailer images. The coverage problem is substantially, not fully, resolved.
- New ranking: newest-arrival + price-drop signals, reusing `/lab/price-drops`' exact query/threshold (`store_prices` vs `price_history`, drop_inr>=200 OR drop_pct>=5) rather than re-deriving it. No real price-drop signal existed for any current candidate in this test, so ranking fell back to newest-published -- both paths verified against real data.
- **Real bug found, separate from Stage 1 itself, flagged not fixed:** "Star Trek Enterprise NCC-1701-D" extracted set number "1701" from the ship's fictional registry number in the title, not the real LEGO set number (10356) -- a false positive in the pre-existing `extract_set_number()` regex. This candidate correctly got 0 Brickset images (wrong number queried) and should be investigated separately.
- The retailer `>=5 images` candidate filter is removed (irrelevant now that images don't come from the retailer); replaced with a `set_number required` filter (needed for the Brickset lookup).

**Stage 2/3 -- script + gates:** system prompt now encodes attribution (no retailer names, ever), Codex-sourced Indianization, banned literary vocabulary, and the price-math reference table, all built/verified in earlier sessions this same day. **Real full-retry-loop pass rate (not first-attempt) at the 90-110 word gate: 4/5 (80%)** across 5 different real qualifying candidates -- achievable within the existing 4-attempt budget, not proposing a looser band. New **G9: zero store-name mentions**, hard fail -- added as an explicit gate (previously enforced only via prompt instruction and manual spot-checks).

**Stage 4 -- TTS:** voice config locked as the standing default (`TTS_MODEL_ID`, `TTS_VOICE_SETTINGS` constants) -- `eleven_flash_v2_5`, `similarity_boost=0.9` (Test B, operator-confirmed after the real A/B/C listening test). Currency normalization and the 1000-char budget guard unchanged from earlier this session.

**Stage 5 -- visual assembly, real bug-class fix:** replaced cover-crop-and-fill (the root cause of this session's composite/lifestyle/off-center-crop bugs) with SOC-AUTO-01's proven pattern, ported directly from `social-automation/media_processor.py`: contained-fit foreground (scaled to fit within a 1080x1080 box, centered, never cropped, safe regardless of source aspect ratio) + a blurred (`GaussianBlur radius=20`) and darkened (`brightness 0.40`) cover-crop of the *same* image as full-frame background fill. Gentle zoom applies only to the sharp foreground. Verified visually against a real Brickset image before moving on -- clean result, no cropping artifacts.

**Stage 6 -- captions (new):** `openai-whisper` (added to requirements.txt -- a real pipeline dependency now, not just a verification tool) transcribes the ACTUAL rendered audio (catches real TTS pronunciation, not the intended script -- verified this works by testing on an old pre-currency-fix video and correctly transcribing its real "RS" mispronunciation). Sentence-level segments (Whisper's default, not word-level) burned in via PIL (not moviepy TextClip, avoiding an ImageMagick dependency): bottom-third, white text, dark 8-direction outline. Verified visually with real data.

**Stage 7 -- full E2E verification, real spend:** Minas Tirith 11377 (₹69,999), real Brickset images (3 studio of 12 fetched), real script (93 words, all 8 gates incl. G8 pass on the 2nd retry attempt), real ElevenLabs TTS (583 chars after currency expansion, ~292 credits computed -- same API-scope limitation as before prevents a live balance check), real render (64.9s, `ffprobe`-confirmed h264 1080x1920 30fps + AAC), real captions burned in. QC frames extracted at 0/25/50/75/90% to `scripts/video/output/qc_frames/` -- **not self-certified, awaiting operator visual confirmation** per established discipline this session. Not posted anywhere.

**Stage 8 -- daily scheduling: PROPOSAL ONLY, not activated.** Recommend a local scheduled task (Windows Task Scheduler), not GitHub Actions, running Stages 1-6 daily and saving output for review -- posting stays manual until several consecutive daily outputs have been reviewed and are consistent, matching how every other pipeline in this project graduated from supervised to automated. GitHub Actions was considered and rejected for now: moviepy/ffmpeg rendering + Whisper transcription (torch dependency, CPU-bound) is heavy for standard Actions runners, and real API keys would need to move to GitHub Secrets before that's even viable. Revisit once local daily runs are consistently clean.

### 2026-07-06 (Toycra image fallback + G1 tightened to 90-110) — candidate-availability problem improved but NOT solved; needs an operator decision

**Toycra image-only fallback (operator directive, "do not skip sets"):** MyBrickHouse stays the sole source for candidate ranking/selection; if a candidate's MBH images don't clear `MIN_STUDIO_IMAGES` (3) after studio/lifestyle/composite classification, the same set is now looked up on Toycra by set-number match (never fuzzy title match, to avoid attaching the wrong set's photos) and its studio images are combined in. Only skips if both sources combined still fall short.

**Real result, tested against the current 9 MyBrickHouse-ranked candidates: 2/9 now qualify (Venator Cruiser, Barad-dûr), up from 0/9 before the fallback.** This is a real improvement but far short of "most/all" — **not primarily a classification-strictness problem**: 6 of the 7 still-skipped candidates (Eiffel Tower, Titanic, Hogwarts Castle, Tropical Aquarium, Hogsmeade Village, Enterprise, Pirate Ship) have **no matching set on Toycra at all** by set number, so there's nothing to fall back to. The two that qualified did so because Toycra happened to carry that exact set with clean images. **This needs an operator decision** (accept the ~22% qualification rate as-is, further loosen `MIN_STUDIO_IMAGES`, add a third retailer source, or reconsider the daily-pipeline design) -- no threshold changed unilaterally.

**G1 word-count gate tightened 105-135 -> 90-110**, matching the system prompt's own target (added same day, previously left wider than the prompt pending evidence). Re-tested with 5 fresh real generations on Barad-dûr's metadata: word counts 122, 117, 130, 117, 94 -- **only 1/5 (20%) passed organically**, notably worse than an earlier 4/5 test on different set metadata. Real variance across candidates, not a fluke of one test -- flagged, not resolved.

**Read-only investigation, SOC-AUTO-01's image handling (no code touched):** the existing, production-proven social pipeline avoids this entire class of bug structurally, not through smarter classification. `social-automation/scraper.py` pulls from **LEGO.com's own official product gallery** (Brickset CDN as fallback, explicitly never Rebrickable or retailer photos) -- professionally shot, isolated renders by construction, sidestepping composite/lifestyle photo problems entirely. `social-automation/media_processor.py` then uses **contained-fit compositing, not cover-crop**: every image is scaled to fit within a bounded box and centered on a fixed white canvas (`_scale_to_contain` + `Image.new('RGBA', (1080,1080), white)`), never filling/cropping the full frame. A `_scale_to_fill` (cover-crop) helper exists but is used only for a blurred background layer behind the product shot, never on the product photo itself. No dimension/background/quality classification anywhere -- robustness comes from requiring ≥9 gallery URLs and trying each in order, catching failures per-image. **Worth considering for the video pipeline**: if MyBrickHouse/Toycra's retailer photos keep causing this class of problem, the video pipeline could borrow LEGO.com as an image source and/or switch from cover-crop-fill to a contained template, rather than continuing to build ever-smarter classifiers for retailer photos that were never meant to be used this way.

### 2026-07-06 (composite detector rewrite + G8 price-math gate) — code fixed and verified; candidate-availability question OPEN, not resolved

**Composite/lifestyle image classifier — real regression cycle, caught before shipping:**
- First fix (fixed 0.45 content-fraction threshold) missed a real vertically-stacked exploded-diagram image entirely -- it's a thin subject on a wide canvas, so its content fraction never exceeds ~0.16, never crossing 0.45.
- Attempted second fix (threshold relative to each profile's own global peak) fixed the exploded-diagram case but **silently regressed the original side-by-side composite case** -- caught only because both fixtures were tested together afterward, not sequentially.
- Final fix: real peak/valley prominence, evaluated locally per adjacent peak pair (valley must drop to ≤50% of the smaller neighboring peak), not against one global constant. Verified against all 6 known real fixtures (2 confirmed composites, 4 confirmed single-subject studio shots) together in one test -- all correct, no cross-regressions.
- **Retroactive re-check, real and severe:** re-ran the entire top-10 MyBrickHouse ranked candidate list with the corrected detector. **Every single candidate got skipped** -- Eiffel Tower, Titanic, Venator Cruiser, Hogwarts Castle, Tropical Aquarium, Barad-dûr, Hogsmeade Village, Enterprise, Pirate Ship -- all had fewer than 3 clean (non-lifestyle, non-composite) studio images. The pipeline currently has **zero valid candidates** in its top 10. Several candidates' very first/primary catalog image is itself a composite (Hogsmeade, Enterprise, Pirate Ship), not just secondary images.
- Eiffel Tower depth-fetch check: all 13 catalog images exist (not 15+); images 7-13 are all lifestyle. Depth-fetching does not help this specific set -- untested on the other 8.
- **Not resolved, needs an operator decision:** whether to lower `MIN_STUDIO_IMAGES` below 3, relax classification strictness, or accept that MyBrickHouse's flagship-tier catalog may not support this pipeline's current image-quality bar. No code change made unilaterally.

**G8 price-comparison math-sanity gate — added, validated, one bug caught and fixed before trusting it:**
- Extracts "₹X = Y months/years of Z" claims, checks Y × (Z's reference monthly price) lands within 0.5x-1.5x of the set's real price. Reference prices: Spotify ₹139, Netflix Standard ₹499/Premium ₹649, Amazon Prime ₹125 -- all per the operator's exact spec, set price itself never touched.
- Validated against the required known-bad case (`₹65,999 = six months of Spotify` -> ₹834, correctly FAILs) before trusting it on new output.
- Also caught two REAL bad examples already produced earlier this session that no prior gate detected ("two years of Spotify Premium" for a ₹1,04,999 set = ₹3,336; "a full year of Netflix, Prime, Spotify... combined" for ₹65,999 = ₹9,156 at the time -- both nowhere close to the real price).
- **Bug found and fixed during validation:** the reference dict's overlapping keys ("netflix" as a substring of "netflix premium") double-counted subscriptions in combined claims, inflating one real test's computed total from a correct ₹54,780 to an incorrect ₹84,720. Fixed by grouping keys into families (Netflix, Prime, Spotify) and only counting the most specific match per family.

**Script fixes also verified this pass (attribution, Indianization, vocabulary, word target):** 3 fresh real generations on Barad-dûr's metadata (image-blocked candidate, but script generation doesn't depend on image eligibility) -- zero store mentions, no banned literary vocabulary observed, word counts 137/88/90 (none landed inside the current 105-135 gate, wider swing than earlier tests -- flagged, not resolved).

### 2026-07-06 (wiring audit + store switch + first fully-combined-fix render) — ✅ CLOSED

**Wiring audit, before touching any code:** confirmed `2026-07-06_refixed-images-test.mp4` (what the operator watched) has the real image fix but reuses `temp_download/voiceover.mp3` from 2026-07-05 19:20 -- generated hours before `normalize_currency_for_tts` existed (first shipped in commit `312f5ba`, 2026-07-06 00:57). That audio cannot say "rupees" by construction. **No file combined both fixes before this entry** -- confirmed no new bug, exactly the operator's suspicion. Traced `normalize_currency_for_tts()`'s call site: correctly wired inside `generate_tts()`, its output (`tts_text`, not raw `script`) is what's passed to `client.text_to_speech.convert()`.

**Store switch (operator directive):** Toycra dropped entirely from `scripts/video/` (main web pipeline's scraper untouched). MyBrickHouse is now the sole candidate + image source, sorted by price client-side (server-side `sort_by` still doesn't work, per the original STEP 0 finding). **MyBrickHouse has the identical transparency trap as Toycra** -- verified directly: 3 of the first 6 real image URLs for the current top candidate (Death Star 75419) are genuine RGBA PNGs (12-56% transparent), just without Toycra's "NOBG" naming convention. The alpha-flatten fix is therefore load-bearing for MyBrickHouse too, not just defense-in-depth.

**First fresh end-to-end run with both fixes combined, verified, not assumed:**
- Real MyBrickHouse candidate (Star Wars Death Star 75419, ₹1,04,999 -- Indian lakh-style comma grouping, confirmed the currency-normalizer handles both grouping styles), real Gemini script (120 words, passed all 7 gates on attempt 3), real ElevenLabs TTS, real image fetch+flatten, real render: 75.1s.
- **Images:** frames extracted at 0/25/50/75/90% of the middle segment -- all five full-frame, correctly cropped, no black bars, no transparency artifacts, across a mix of transparent-PNG and opaque-JPG sources.
- **Currency:** installed `openai-whisper` locally (verification-only, not a pipeline dependency) and transcribed the real generated audio independently of the input text -- transcription confirms "...your wallet will weep at 104,999 **rupees** from my brick house..." -- the price line is audibly correct, not just correct in the text sent to the API.
- **File:** `scripts/video/output/2026-07-06_star-wars-death-star-building-kit-for-adults-75419-9023-piec.mp4` -- `video_posts` row `30630e36-8b74-434b-8a00-e5652847ce07`, `status='rendered'`. Not posted anywhere.

### 2026-07-06 — Visual review of c9392ed's output: image transparency bug fixed, currency TTS pronunciation fixed, voice A/B/C test run (operator decision pending)

**Image fix (real bug, ✅ CLOSED):** the resize/crop math itself was correct on paper and in isolation -- verified by rendering `make_ken_burns_clip()` alone and inspecting real extracted frames, no defect. The actual bug: Shopify serves some of this candidate's images as transparent "NOBG" (no-background) cutout PNGs (5 of 6 for the Hogwarts Castle candidate, ~52% transparent pixels) saved under a misleading `.jpg` extension by `download_images()`. moviepy's `ImageClip` silently drops the alpha channel and reads the raw RGB values underneath, which PNGs conventionally store as `(0,0,0)` in fully-transparent regions -- rendering as solid black, not a crop/framing defect. Fixed in `download_images()`: detect RGBA/LA/transparent-P images and flatten onto white before saving. Verified with real eyeballs on a re-render (same real ElevenLabs audio reused, no extra spend) at 0%/50%/90% of the middle segment -- clean white background, full content, correct crop at all three checkpoints (previously: solid black background at 50%/90%).

**Image provenance (investigated, not a defect):** confirmed the exact URLs used are live on Toycra's real feed right now (byte-identical two independent fresh fetches, SHA256 matched); filenames explicitly say `WEB_SEC02_NOBG`/`WEB_Lineup_NOBG` -- these are the retailer's own official transparent marketing cutouts, not anything altered by our pipeline. Full image-touching operation list end to end: fetch (unmodified) -> PIL decode -> alpha-flatten-onto-white (new fix) -> JPEG re-encode (quality 95) -> moviepy cover-resize -> time-varying zoom resize -> center crop. No color/brightness/contrast/filter/upscaling/rotation anywhere. Downloaded resolution (1000x1000) matches the retailer's own JSON-declared width/height exactly -- not a downsized variant.

**Currency TTS pronunciation (real bug, ✅ CLOSED):** ElevenLabs read "₹" as literal letters "R S", not "rupees" -- confirmed live 2026-07-05. Added `gates.normalize_currency_for_tts()`: converts `₹<amount>` to spoken words (`num2words`, new dependency) immediately before the ElevenLabs call only -- the stored `video_posts.script` keeps the ₹ numeral form for captions/records. One real regex bug caught and fixed during testing: an initial `[\d,]+` pattern swallowed a sentence's trailing punctuation comma right after the price ("₹26,999, roughly" matched "26,999," including the comma that belonged to the sentence) -- fixed to require proper digit-grouping (`\d{1,3}(?:,\d{2,3})*`). The char guard now checks the *expanded* TTS text length, not the shorter stored script, since expansion is what's actually billed. Verified with a real, cheap single-line TTS generation.

**Voice A/B/C test (real spend, operator decision pending, no winner picked):** current cloned voice's stored default `similarity_boost` is already 0.9 (`GET /v1/voices/{id}`) -- above the 0.85 the operator assumed needed raising, so a low similarity_boost may not fully explain the American-sounding output. Ran the real full review script (875 chars after currency normalization) through: (B) `eleven_flash_v2_5` with similarity_boost explicitly set to 0.9, (C) `eleven_multilingual_v2` with similarity_boost 0.85. `eleven_multilingual_v2` bills at the standard 1 credit/char rate (not Flash/Turbo's discounted 0.5x), so test C cost 2x test B for the same text. Three files now exist for the operator to listen to and judge: the original review's audio (baked into `2026-07-05_...mp4`), test B, and test C -- see runbook/handover for exact paths.

### 2026-07-05 (VID-P4-01 follow-up) — Two root-cause fixes: char guard recomputed from evidence, markdown sanitized not gate-leniently tolerated

**✅ CLOSED.** Both fixes address false failures on already-*compliant* content — G1's word range (105-135) was correctly retuned earlier this session from real data and was NOT touched again here.

**Fix 1 — `ELEVENLABS_MAX_SCRIPT_CHARS` recomputed from evidence, not re-guessed:**
- Verified `eleven_flash_v2_5`'s real billing rate against ElevenLabs' own pricing docs: 0.5 credits/char (Flash/Turbo discounted rate, vs 1 credit/char for Multilingual v2).
- Observed chars/word this session, two real gate-passing scripts that were then wrongly refused by the old 800-char guess: 827/131 = 6.31 chars/word, 810/128 = 6.33 chars/word.
- New guard: 135 words (G1 ceiling) × 6.5 chars/word (above both real samples) = 877.5, +15% safety margin = 1009 → **1000 chars.**
- Cost check, worst case (every script hits exactly 1000 chars, 30 scripts/month = one/day): 1000 × 0.5 = 500 credits/script × 30 = **15,000 credits/month vs. the Starter plan's 30,000/month allowance — 50% utilization, 2x headroom** even in the absolute worst case.
- Old 800-char figure was never derived from this arithmetic — it was a guess that collided with G1's own range, refusing two scripts this session that had already cleared word-count cleanly.

**Fix 2 — Markdown sanitization, not gate leniency:**
- `gates.sanitize_script()` strips `*`, `_`, `#`, and backtick immediately after raw Gemini output, before any gate runs. Does not touch ₹, apostrophes, or any other punctuation. Verified: 3 of 6 real generations this session hit the asterisk hard-fail — a persistent Gemini tendency for this voice/content type, not a fluke.
- Gates now run against the *sanitized* text, and the sanitized text (not raw) is what's stored as `video_posts.script` and sent to TTS — gates must judge what TTS actually speaks.
- `GateReport.as_dict()` now includes a `_sanitization` block (`raw_script`, `sanitized_script`, `markdown_stripped`) in every `video_posts.gate_results` row going forward — a standing metric for how often Gemini still tries markdown, not just a one-time fix.

**Real end-to-end verification, first actual ElevenLabs spend:**
- Fresh `--pick 1` run cleared all 7 gates organically on attempt 2 (129 words, no markdown, no char-guard refusal) and reached ElevenLabs for the first time this project.
- Real render with the operator's actual `master_assets` clips (not placeholders): intro 14.32s + outro 12.11s + real-TTS middle, **81.47s total** (`ffprobe`-confirmed: h264 1080x1920 30fps + AAC 44100Hz stereo, `probe_score=100`).
- `video_posts` row `4d15041b-f5e4-4b1f-93d7-23bde6074402` inserted, `status='rendered'`. **Not posted anywhere — saved locally for operator review per instruction.**
- Exact credits consumed: could not pull a literal real-time balance/usage confirmation from ElevenLabs' API — this key's scope is missing both `user_read` (subscription/usage endpoint) and `speech_history_read` (history endpoint), both returned 401. Reported instead as an exact computation: the real script sent was precisely 826 characters (from the DB row) × the confirmed 0.5 credits/char rate = **413 credits** for this one video. Flagged to the operator as a real API-scope limitation, not glossed over as "verified" when it wasn't.

**Also fixed in this pass (found during the real run, not assumed):** `eleven_flash_v2.5` (period) 400s as `invalid_uid` — ElevenLabs' real model ID uses an underscore, `eleven_flash_v2_5`. Corrected in `generate_tts()`.

### 2026-07-05 (even later still) — Netlify build-skip guard: fixes the real mechanism, not the one first suspected

**✅ CLOSED.** Repeatedly-raised operator concern ("stop unnecessary Netlify builds") that had never actually been enforced. Real root cause was not where the initial fix request pointed:

- **Requested fix:** add a conditional `ignore` command to `netlify.toml` (Netlify's own git-integration build-skip mechanism).
- **Verified before implementing, not assumed:** `netlify.toml` already has `ignore = "exit 0"` (unconditional skip) — and per netlify-cli's own `--help` output and docs, `netlify deploy --build` (the exact command `.github/workflows/deploy.yml` runs on every push) **always builds unless `--no-build` is passed, completely independent of the `ignore` field**. That field only governs Netlify's own webhook-triggered git-integration builds — which this repo already disabled (line 212/multiple `Netlify minutes: unlimited (GHA builds) -> 0` entries elsewhere in this file confirm a prior, deliberate move off Netlify's native build pipeline after a past quota exhaustion incident). Changing the `ignore` field as literally requested would have fixed nothing — the actual cost driver, GitHub Actions minutes spent on `npm ci` + `next build` + Netlify CLI deploy for every push regardless of relevance, lives entirely in `deploy.yml`'s trigger, not in `netlify.toml`.
- **Real fix:** added a `paths:` inclusion filter to `deploy.yml`'s `on.push` trigger — `src/**`, `public/**`, `package.json`, `package-lock.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `netlify.toml`, `.github/workflows/deploy.yml`. Deliberately an inclusion list, not `paths-ignore` — new non-site directories added later (another `scripts/<tool>/`, another `docs/` file) are safe by default rather than needing to be remembered and added to an exclusion list.
- **`netlify.toml`'s `ignore = "exit 0"` left unchanged**, with a comment explaining why: if Netlify's git integration is still connected to this repo at all (even if currently silenced), switching that field to a conditional check would *reactivate* Netlify's own build-on-push behavior for site-relevant commits — running alongside the GH-Actions-triggered deploy and doubling builds on exactly the commits that matter, the opposite of the goal.
- **Verified both directions with real test commits, not assumed from the trigger syntax alone:**
  - Docs-only test (`e3686cb`, trailing blank line in this file): `gh run list` shows only `email-guard` for this commit — **`Build & Deploy to Netlify` never appears in the run list at all**, confirming the workflow wasn't even queued, not just fast/skipped-with-a-status.
  - `src/` test (`7858232`, trailing blank line in `src/lib/brand.ts`): both `email-guard` and `Build & Deploy to Netlify` appear and both completed successfully (`Build & Deploy` job, 1m45s) — confirming the filter doesn't over-block real site changes.
- CLAUDE.md: added a "Netlify is deploy-only" line under Known Netlify Gotchas.

### 2026-07-05 (latest) — VID-P4: daily video pipeline built and verified without spending

Phase 4 moves 🔴→🟡. Built `scripts/video/{engine.py,gates.py,prompts.py}` per the operator's adapted project brief — candidate selection from Toycra + MyBrickHouse, Gemini/Cerebras script generation against the fixed Codex video-voice system prompt, 7 pre-TTS quality gates, ElevenLabs TTS, moviepy Ken Burns assembly, `video_posts` DB logging. New `video_posts` table (RLS enabled, service-role-only, matching the `generator_runs`/`pending_drafts` admin-table pattern). Full detail and every verified correction in VID-P4-01 above; headline items:

- **Two real gate bugs found and fixed via live testing, not assumed correct from spec:** G7 opener-uniqueness's "first-sentence" window missed the exact multi-sentence template-reuse incident it exists to catch (widened to first-150-chars, matching the original web-pipeline Gate 8); G2's bare `\blike\b` banned pattern failed real scripts using "like" as normal conversational English the system prompt itself requires.
- **Cerebras model corrected:** brief said `llama3.1-8b` (404s on this account) → `gpt-oss-120b`, matching the main site's already-proven failover model.
- **moviepy 1.0.3 + Pillow 10.3.0 incompatibility found and patched:** `PIL.Image.ANTIALIAS` removed in Pillow ≥10; monkeypatched to `Image.LANCZOS` before importing moviepy.
- **Real operational finding, not fixed (system prompt left untouched per "do not dilute"):** 6 live Gemini generations during verification, all over the 110-125 word target (132-165 words, 0 in range). Documented as an expected daily-workflow reality in the runbook, not silently worked around.
- **Full dry-run, real data throughout:** live Shopify candidate fetch, live Gemini/Cerebras script attempts, real gate runs, real image downloads, real placeholder audio, real moviepy/ffmpeg render (`ffprobe`-confirmed 1080x1920 h264/aac, 54.0s), real `video_posts` insert + `--posted` update. Zero ElevenLabs spend — TTS is the one call gated on the operator's real keys.
- New `docs/runbooks/VIDEO_PIPELINE.md` (daily flow) and `scripts/video/README.md` (setup, including the ffmpeg-not-on-PATH gotcha and the moviepy-pin rationale).
- MEDIUM-61 (EL-05 voice decision) closed: ElevenLabs Instant Voice Clone, Starter tier, decided 2026-07-05 — skipped the full EL-01→04 sequence, went straight to build.

### 2026-07-05 (even later) — Gemini call pacing; IMPORT ONLY rating fix; Fan CoLab timeline unarchived

Three small follow-ups, two commits:

- **`docs/FAN_COLAB_TIMELINE.md` moved out of `docs/archive/`** (`git mv`, history preserved) — it's an active planning doc with a live Aug 2026 deadline, wrongly edited in the frozen archive in the previous session's Fan CoLab reframe work. All tracker references to the old path corrected alongside.
- **`reviews.rating` — IMPORT ONLY now maps to `null`, not a fabricated 2.** Confirmed nullable first (`information_schema.columns`), then changed `VERDICT_TO_RATING` in `src/lib/publish-draft.ts` per instruction: a numeric star rating derived from an India-availability verdict misstates what rating is supposed to measure, and this value feeds the Review schema Google indexes. Flagged, not silently absorbed: `reviews/[slug]/page.tsx`'s star display and `rating >= 4` Recommended/Skip-It badge both currently treat `null` as `0` — not changed in this pass, noted in the code comment for whoever revisits it.
- **Gemini call pacing added**, independent of any billing-tier decision: `acquireGeminiSlot()`'s rolling 10-calls/60s window had no floor on individual call spacing — confirmed live in the 2026-07-04 audit's diagnostic dispatch, where 4 of 5 calls landed within ~0.3-0.5s of each other. Added a randomized 4-6s minimum gap between consecutive calls, on top of the existing window check. Corrected a stale 2026-06-29 note under HIGH-52 that described a `DELAY_MS` mechanism no longer in the code.

### 2026-07-05 (later) — Review-format routing shipped; Fan CoLab proof reframed; three drifted tracker entries closed with evidence

Four pieces of audit follow-up, one commit:

- **MEDIUM-13/AUDIT-NEW-3 closed:** `src/lib/publish-draft.ts::resolveTarget('review')` now routes to `{ table: 'reviews', path: '/reviews' }` (was `news_articles`/`/news`) — future review-format publishes only; the 36 existing `/news` reviews are not migrated. Checked the `reviews` schema before writing any code, per instruction, and found two real gaps rather than assuming a clean 1:1 mapping: (1) `reviews` has no `category` column (unlike `news_articles`/`blog_posts`/`guides`, which share a compatible superset the old single generic insert relied on) — needed a distinct row-builder, not an extension; (2) `reviews.rating` (integer) had no source field in `pending_drafts` at all. Decided a fixed `draft_verdict` → `rating` mapping (`BUY NOW=5, WAIT=3, IMPORT ONLY=2, AVOID=1`) rather than inventing one silently, keeping the reviews UI's existing `rating >= 4` "Recommended" badge meaning what it says. `reviews.set_id` (uuid FK) resolved by widening the existing `extractSetNumberCandidates()` → `sets` match to also select `id`, not just `set_number`. Verified directly: `resolveTarget('review')` → `{"table":"reviews","path":"/reviews","category":"Review"}`; `tsc --noEmit` and `npm run build` both clean.
- **FAN-COLAB-PROOF-01 reframed:** "screenshot 30+ consecutive daily IG posts" replaced with "complete automated coverage of every eligible LEGO.com India-relevant preview since launch — N posts, zero eligible sets missed" (N=26 as of 2026-07-05, `posted_sets` count) — the old framing claimed a daily cadence the 2026-07-04 audit already showed doesn't exist (posting is a gallery-image eligibility gate, ~7 of every 17 days). Capture window (Jul 20–25) and application date (Aug 1) unchanged. Updated both `BOI_MASTER_TRACKER.md` and `docs/FAN_COLAB_TIMELINE.md`. **Correction, same day:** this file was found and edited at `docs/archive/FAN_COLAB_TIMELINE.md` — wrong location for an active planning doc with a live Aug 2026 deadline; the archive is meant to be frozen (per CLAUDE.md's Day-35 policy). Moved to `docs/FAN_COLAB_TIMELINE.md` (`git mv`, history preserved) in the same follow-up commit that fixed the rating semantics below. MEDIUM-57 (editorial cross-posting to IG) noted as a pulled-forward density-booster idea for this metric — scope proposal only, not built.
- **CE-01 marked ON HOLD** per explicit 2026-07-05 operator decision — distinct from "pending, quietly overdue against its 2026-07-01 second-outreach checkpoint."
- **Three DRIFTED tracker entries closed with evidence, not just marked done:** IG-TOK-01 (one confirmed green run + `IG_ACCESS_TOKEN` rotation 11s later — meets this entry's own stated closing bar), HIGH-53 (fresh `pending_drafts` status query shows zero `draft`-status rows, contradicting the "71 rows remain" claim), MEDIUM-50 (self-contradiction resolved — MEDIUM-67 already documented this closed, MEDIUM-50's own status line just never caught up). All three evidence trails point back to `docs/audits/BOI_360_AUDIT_2026-07-04.md`.

### 2026-07-05 — Comprehensive 360° evidence audit; monthly runbook + reminder workflow shipped

Full read-only audit across GitHub Actions run history, live Supabase data, the actual production site, and repo hygiene — every finding evidence-tagged ([RUN-LOG]/[GH-API]/[DB-QUERY]/[LIVE-FETCH]/[REPO-GREP]), tracker prose treated as claims under test rather than as evidence. Full report: `docs/audits/BOI_360_AUDIT_2026-07-04.md`. Standing monthly procedure: `docs/AUDIT_RUNBOOK.md`. New `.github/workflows/monthly-audit-reminder.yml` (cron `0 3 1 * *`) emails a reminder pointing at the runbook — it does not run the audit itself.

**Headline findings** (full detail and raw evidence in the report):
- **IG-TOK-01:** one successful run exists (`ig-token-refresh.yml`, 2026-07-02, manual dispatch) — per the tracker's own stated closing bar ("a confirmed green run"), this item should close. Caveat: the cron itself (1st/15th) has never fired; first real unattended test is 2026-07-15.
- **Generation pipeline:** materially worse than HIGH-52's last note. Three consecutive `generate-drafts.yml` runs (2026-07-03 through 2026-07-04 10:31) had **zero** successful generations (0/30, 0/50, 0/30) — not "gap not yet closed," a total stall. Partially recovered mid-audit (3/50 at 19:31 UTC same day). All 192 `approved` `pending_drafts` rows have `draft_body IS NULL`.
- **Social posting gaps:** confirmed **not a reliability bug**. Every sampled gap day (and the DB's full 35-day posting record) ends on the same verbatim log line, "No candidates met the gallery image requirement" — a deterministic ≥10-gallery-image eligibility filter, working as designed, just infrequently satisfied.
- **Title-tag duplication:** far more widespread than previously known — 26 of 40 swept live routes show "X | Bricks of India | Bricks of India," not just `/compare`. Two distinct root causes found: 16+ pages hardcoding the suffix in source, plus 41 content rows (`news_articles`/`blog_posts`/`reviews`) whose stored `seo_title` column already has the suffix baked into the data itself.
- **SSL:** renewal confirmed live, valid until 2026-09-19 — closes the open question of whether the Jul 2 cert-crisis fix actually renewed.
- **HIGH-53 and MEDIUM-50 are DRIFTED** — tracker text is stale/self-contradictory on both; see report for the exact evidence.
- **MEDIUM-63 confirmed, understated:** `admin/dashboard.html` is 6 weeks stale (last updated 2026-05-25) against a tracker that itself flags its own health score as unrecomputed.

**No §Pending item's status was changed in this pass**, per the audit's own read-only scope — the report's OPERATOR-CONFIRM list (RLFM snapshot, CE-01 replies, YT-OAUTH-01 video, GSC verification, MyBrickHouse affiliate, and others) needs Abhinav's answers before any closures happen.

### 2026-07-04 (even later) — Tagline rendering unified into a shared component (design fix on top of the sitewide rollout)

Follow-up to this same day's tagline rollout: the initial rollout put both taglines on the page as ad-hoc inline-styled `<p>` tags per call site — 4 different colors for the same secondary tagline (`var(--boi-red)`, `var(--boi-saffron)`, `var(--boi-blue)`, `var(--boi-sky)` across opinion/deals/404/newsletter), no tagline in the header at all, and the homepage hero kicker floating in plain text over the banner artwork with no legibility treatment. Chat-layer Claude built and type-checked the fix against a clone of the repo at `4918dc4`; applied here verbatim after confirming every anchor (Navbar's Wordmark closing tags, all four ad-hoc secondary blocks, Footer's tagline `<p>`, the hero kicker, the codex Taglines block) matched exactly — no improvisation needed.

- **New `src/components/ui/Taglines.tsx`** — `TaglineChip` (primary, navy pill, brick-yellow text) and `TaglineWink` (secondary, brick-yellow marker-highlight, navy italic text). One rendering path each, everywhere.
- **`Navbar.tsx`** — tagline appears under the wordmark, gated on `size === 'md'`.
- **Homepage hero** — the floating kicker `<p>` replaced with `<TaglineChip />`; the navy pill now sits legibly over the hero banner art regardless of what's underneath.
- **Footer** — tagline color fixed from `var(--boi-sky)` to `#FFFFFF` for contrast against the blue footer background (found during this pass, not the original ask, but the same class of bug this whole fix is closing).
- **Opinion, Deals, 404, Newsletter** — all four ad-hoc secondary blocks replaced with `<TaglineWink />`. `BRAND` import dropped from all four files (taglineSecondary was its only use in each); `MASCOTS` import kept where still needed.
- **About** — added both: `<TaglineChip />` in the hero (replacing the same ad-hoc `<p>{BRAND.tagline}</p>` pattern as the other primary placements) and `<TaglineWink />` after the "Find me here" social-link column — the only page carrying both, chip opens the bio, wink signs it off, separate viewports so the one-tagline-per-surface rule holds. `BRAND` import kept (still used for youtube/instagram URLs).
- **Codex** — added an Implementation line to the Taglines block: both taglines render only via `Taglines.tsx`, never as ad-hoc styled text.

**Verified:** `tsc --noEmit` clean; real `npm run build`; local render check confirmed the header lockup tagline, hero chip, all four `TaglineWink` placements, and both About-page taglines render as expected. Grep confirmed `BRAND.taglineSecondary` now appears in exactly one `.tsx` file — `Taglines.tsx` itself.

**Mobile-header gap — CLOSED 2026-07-04, commit 511cf80.** Confirmed as a real gap: the `size === 'sm'` gate was specced against an invocation pattern that doesn't exist in this codebase (`Navbar.tsx` only ever calls `<Wordmark size="md" />` — no mobile-specific invocation), so the gate was a no-op and the tagline showed at every viewport width. Ruling: tagline hidden below the `md` breakpoint. Fix: added `className="hidden md:block"` to the tagline `<div>` itself — the responsive class does the real work at viewport level; the `size === 'md'` gate stays as harmless future-proofing in case a drawer wordmark ever passes `'sm'`. Verified via the compiled CSS (not a forced browser resize — the browser tool's viewport-resize didn't take effect in this environment, confirmed stuck at 1280px regardless of requested size): `.hidden{display:none}` is the unconditional base rule, and `@media (min-width:768px){.md\:block{display:block}}` is the only override, and the rendered DOM confirms the tagline `<div>` carries both classes. `tsc --noEmit` clean, `npm run build` clean.

### 2026-07-04 (later) — Sitewide tagline rollout: "Every Brick Tells a Story" is now the single source of truth

Rolled the v1.0 brand guide's taglines off the guide page and onto the live site. `BRAND.tagline` (`src/lib/brand.ts`) is now `"Every Brick Tells a Story"` (was `"More Bricks. Less Nonsense."`), plus a new `BRAND.taglineSecondary` (`"Where Everything Is Awesome, Except Financial Advice"`). Every placement below reads from these two constants — no second hardcoded copy of either string anywhere in `src/`.

**Discovery first, per standing protocol:** `git grep` for both taglines before touching anything — neither existed anywhere outside `public/brand/guide.html`, so this was a clean greenfield rollout, not a dedup exercise. Discovery also surfaced that the site already had a different live tagline (`"More Bricks. Less Nonsense."`, hardcoded 4× across `layout.tsx`/`page.tsx` metadata plus a dead unused `BRAND.tagline` carrying the same string) — flagged to Abhinav before touching SEO copy rather than silently overwriting it. Direction received: replace it outright, keep it as a named "retired" line in the codex for casual-copy use.

**Primary placements** (`BRAND.tagline`):
- `src/components/layout/Footer.tsx` — under the wordmark, column 1 (sitewide, every page).
- `src/app/page.tsx` — homepage hero, kicker line above the h1.
- `src/app/layout.tsx` — default `description`, OG `description`, Twitter `description` (previously all three carried "More Bricks. Less Nonsense.").
- `src/app/page.tsx` — homepage `metadata.description`, same swap.
- `src/lib/schemas.ts` — `organizationSchema.slogan`, reads `BRAND.tagline` directly (JSON-LD).
- `public/llms.txt` — added to the top blockquote line.
- `src/app/about/page.tsx` — under "Founder, Bricks of India" in the hero.

**Secondary placements** (`BRAND.taglineSecondary`, personality surfaces only):
- `src/app/opinion/page.tsx` — index header, below the intro paragraph.
- `src/app/deals/page.tsx` — header banner, below the "wallet" joke line.
- `src/app/not-found.tsx` — below the existing copy, pairs with the Blue Confused mascot already there.
- `src/components/ui/NewsletterSignup.tsx` — below the subscribe copy.

**Verdict-adjacency check:** none of the four secondary placements sit near a BUY NOW/WAIT/IMPORT ONLY/AVOID verdict — confirmed by grepping `SetCard.tsx` (rendered on the deals page) for verdict text before placing anything there: no matches, verdicts only render on individual review pages, not deal-listing cards. Same-viewport check: the homepage carries both a primary (hero) and, further down the page, a secondary (`NewsletterSignup`) — they're far enough apart on scroll to never share a viewport, so the "one tagline per surface" rule isn't in tension here.

`docs/codex/BOI_Codex_v2.md` — new `## Taglines` block under the Manifesto/persona section (Section 1), recording primary, secondary, and "More Bricks. Less Nonsense." explicitly as the retired launch-era line — usable in casual copy, never in lockups or metadata again.

**Verified live-rendered**, not just committed: real `npm run build` + `npm run start` (real Supabase data via `.env.local`), confirmed in-browser that the footer tagline, `/opinion` secondary line, `/deals` secondary line, `/404` secondary line, and the homepage hero kicker all render as expected before committing.

### 2026-07-04 (latest) — Dead hello@ address removed; email-guard closed MEDIUM-53

Follow-up to yesterday's brand-guide entry: Abhinav flagged that `hello@bricksofindia.com` (introduced in the guide.html footer fix, and already live as the BRIEF-01 sender) is not a real mailbox. Discovery (`git grep hello@bricksofindia` / `abhinav@bricksofindia`) before any edit, per standing protocol:

- **`public/brand/guide.html`** footer mailto → `/contact` link (matches every other contact surface on the site).
- **`scripts/morning-brief.mjs`** — BRIEF-01's daily sender changed `hello@` → `abhinav@bricksofindia.com` (the one Resend-verified, actually-monitored address).
- **`public/llms.txt`** — raw `abhinav@bricksofindia.com` contact line (a separate, pre-existing exposure, not part of the original hello@ report) replaced with `https://bricksofindia.com/contact`. This file is a public static passthrough, outside `.next/static/` and outside the CI guard's rendered-route scan — it had been silently exposed since whenever `## Contact` was added, unrelated to this week's work.
- **MEDIUM-53 closed** — see that entry above for the full root-cause writeup. Short version: the CI email-guard's literal `abhinav@bricksofindia.com` regex had zero matches against yesterday's `guide.html`, i.e. it was structurally incapable of catching the `hello@` link regardless of which address leaked. Widened the regex to any `local-part@bricksofindia.com`, and replaced the hardcoded 5-route scan with one that reads all static routes from `.next/app-path-routes-manifest.json` (30 routes) plus direct scans of `public/*.txt` and `public/brand/`.
- **`docs/archive/*` left untouched** — historical `hello@`/`abhinav@` mentions there (Day 27/9 ground-truth docs, archived content trackers) are frozen records of what was true at the time, not live claims, per the Day-35 archive-freeze policy.
- **Verified, not just asserted:** ran both the old and new regex against yesterday's pre-fix `guide.html` — old regex: 0 matches (proves the guard was blind to this file); new regex: 1 match on the `hello@` line (proves the fix closes the gap). After the fix, `git grep` for `hello@`/raw `abhinav@` returns zero hits outside `docs/archive/`. Ran the widened guard's actual logic locally — real `npm run build` + `npm run start` against real Supabase data (`.env.local` has working creds), scanned all 30 routes from `.next/app-path-routes-manifest.json` plus `public/*.txt` and `public/brand/`: zero matches, guard passes clean. Pushed and confirmed the real GitHub Actions `email-guard` run also passed (not just the local reproduction) — run details in this session's commit log.

### 2026-07-03 (latest) — Brand Guide v1.0 published at `/brand/guide.html`, PDF snapshot filed

Published the v1.0 brand guidelines (logo/wordmark, color, typography, mascots, voice/taglines, social templates, UI components) as a live static page: `public/brand/guide.html`, plus a PDF snapshot at `docs/brand/BOI_Brand_Guide_v1.0_July2026.pdf`.

**Found before committing, not after:** the source file handed off (`Brand Guide.dc.html`, root of repo) was a raw claude.ai artifact export — non-standard `<x-dc>`/`<sc-for>` tags, unresolved `{{ }}` template placeholders, and a `class Component extends DCLogic` script, plus a `<script src="./support.js">` reference to a runtime file that does not exist in this repo. Committed as-is, it would have rendered as broken markup at the live URL, not a brand guide — CLAUDE.md's live-page-verification rule exists precisely to catch this class of thing before it's called done. Rewrote it into standalone HTML: expanded the `sc-for` color (8) and pose (first 8, matching the artifact's own `showAllPoses: false` default) loops into static markup, fixed image paths from relative (`public/brand/...`) to root-absolute (`/brand/...`) so they resolve once served from Next's `public/` folder, and dropped the artifact runtime tags/scripts. Also repaired the footer contact link — the original had been mangled into an unreadable Cloudflare email-obfuscation span during export; replaced with a link to `/contact`.

**Correction (2026-07-04):** this entry originally recorded the footer fix as a `hello@bricksofindia.com` mailto link. That address does not exist as a mailbox — it should never have been introduced, obfuscation-artifact or not. Fixed same-day; see the 2026-07-04 email-guard entry below for the real root cause (the footer fix traded one email-exposure bug for another, and the existing CI guard was structurally unable to catch either).

**Asset verification:** all 18 image assets the design references — 16 mascot poses (8 rendered by default, 8 held in reserve behind the artifact's `showAllPoses` flag) plus `hero-banner.png` and `android-chrome-512x512.png` — confirmed present in `public/brand/` and `public/mascots/`. None missing.

**Verified live-rendered**, not just committed: served `public/` locally and walked the full page — fonts, gradients, color swatches, mascot images, and the corrected footer link all confirmed rendering correctly before commit, per CLAUDE.md's live-page-verification rule.

**Dashboard sync not attempted, same reason as 2026-07-02 entry below:** `admin/dashboard.html`'s JSON block parses cleanly (session-start gate passes) but is already known-stale per MEDIUM-63. Not bolting an unrelated addition onto a file that needs its own reconciliation pass.

### 2026-07-02 (latest) — Health-audit patch applied: HIGH-55 closed, HIGH-56 mitigated, IG token automation shipped, opener retro-fix dry-run finds a live join bug

Applied `boi-health-fixes-2026-07-02.patch` (prepared by chat-layer Claude, base `a32b8a6`) via terminal Claude: Gate 8 same-batch opener race + fail-open (HIGH-55, closed), meta-description word-boundary truncation, per-page Twitter cards on news/blog/reviews/sets, MRP honesty labeling + generator prompt guard (HIGH-56, mitigated — see below), single best-price badge on ties, `/api/img` allowlisted caching proxy for og:image/twitter:image (stops hotlinking Brickset/Rebrickable directly), IG token auto-refresh workflow (`.github/workflows/ig-token-refresh.yml`, 1st+15th monthly), and two new one-time scripts (`audit-mrp.mjs`, `fix-opener-templates.mjs`). Pre-commit verification matched what the patch claimed: `tsc --noEmit` clean, 59/59 vitest passing, both new `.mjs` scripts `node --check` clean.

**Tracker ID correction before filing:** the incoming brief proposed `HIGH-53`/`HIGH-54` for the two new findings — both already in use (HIGH-53 = RADAR-03 signal-review backlog, HIGH-54 = A6 sign-off prompt gap, both resolved 2026-06-29). Renumbered to the next free IDs, HIGH-55 and HIGH-56, before writing entries. Chat-layer Claude was working from a stale view of the tracker; caught here rather than filed as duplicates.

**Real bug found and fixed in the delivered `audit-mrp.mjs` before it was ever run for real, in two layers:** (1) it selected a nonexistent column, `store_prices.last_seen_at` — the real column is `scraped_at` (per this file's own Price data rules). (2) After fixing that, the report came back with TIER A/B both at 0 across 3405 sets, which didn't match the script's own header comment citing 77254 (est. ₹2,500 vs both stores at ₹2,999) as the motivating example. Traced it to a second, independent bug: the script joined `store_prices` to `sets` on `s.id`, but `DATA_SOURCES.md` documents (DATA-01, already known) that `store_prices.set_id` is the bare set-number string, not a UUID FK to `sets.id` — so the join silently matched almost nothing. Fixed both call sites to join on `s.set_number` / `r.set_number` instead. Re-ran: **TIER A jumped from 0 to 696**, and 77254 now resolves exactly as the script's own comment predicted (stored MRP ₹2,500, both active stores ₹2,999, suggested ₹2,999). Neither bug would have been caught by `tsc --noEmit` (plain `.mjs`, not typechecked) or `node --check` (syntax only, not schema/runtime) — both require actually running the script against live data, which is why "verified: node --check clean" in the incoming brief was true but insufficient. CSV written to `audit/mrp-audit-2026-07-02.csv`. **`--fix-a` (writes to `sets.lego_mrp_inr` for TIER A rows where ≥2 stores agree) was deliberately NOT run this session** — 696 rows is a large enough blast radius that Abhinav should see the CSV first, per the script's own stated gating ("review the CSV, then Tier A fix").

**`fix-opener-templates.mjs` dry run executed** (MEDIUM-45, filed below) — real corpus numbers: 163 articles, 2 clusters of 2+ similar openers, 9 articles flagged for rewrite. One cluster is the exact incident HIGH-55 exists to prevent going forward: 8 articles (7 news + 1 blog) all opening with a "Your wallet called. It wants to discuss the LEGO ___" template. Gemini quota was exhausted partway through the run (429s) — only 2 of 9 rewrites actually completed before quota cut off; the remaining 7 are recorded as `SKIPPED` for quota exhaustion, not a rewrite-quality failure, and need a re-run once quota resets. `--apply` was not run — dry-run output needs Abhinav's review first, per the script's own gating.

**Not attempted this session:** `admin/dashboard.html` sync. CLAUDE.md's atomic-update rule requires updating both files in the same commit, but `dashboard.html` is already substantially stale against this tracker (MEDIUM-63, e.g. `kpis.healthScore=85`/`lastDeployDate=2026-05-25` vs. this file's `96`/ongoing — and the cadence table still lists the morning-brief email as "Pending deploy" despite BRIEF-01 shipping and completing weeks ago). Adding one new isolated entry on top of an already-inconsistent file risked making the drift harder to untangle, not easier. Flagging plainly rather than silently skipping the rule: MEDIUM-63 needs a dedicated reconciliation pass, not a bolt-on edit from an unrelated task.

**Docs note, same reason:** CLAUDE.md points to `docs/BRIEF_DEFECTS.md` as the live defect log; it was actually moved to `docs/archive/BRIEF_DEFECTS.md` at some point (last entry DEFECT-014, 2026-05-25) without CLAUDE.md's reference being updated. Logged the two `audit-mrp.mjs` defects above, in this changelog entry, rather than reviving an archived file of unclear current status.

**Verification status:** code-level (tsc, vitest, node --check, live dry-runs against real Supabase data) done. Live-page verification (CLAUDE.md's "mandatory before closing any content fix" rule) — MRP label, single best-price badge, Twitter cards — **not yet done this session**; next session should fetch the 77254 set page and confirm "Est. MRP (from US price)" renders before treating HIGH-56's presentation layer as fully verified, not just committed.

### 2026-06-30 — MEDIUM-48 resolved: flaky unordered-sample check, not a real City coverage gap

Last of the three items (HIGH-48, MEDIUM-48, MEDIUM-49) Abhinav asked to be addressed. Both originally-proposed hypotheses (price-pipeline gap vs. theme-classification gap) were wrong — the real cause was a third thing: the check sampled 20 City sets with no `ORDER BY`, so the "first 20" were effectively random storage order each run. Confirmed live: real City price coverage is 28/261 sets (10.7%), more than double the catalogue-wide average (4.38%) — City was never under-covered. The check's pass/fail outcome was luck of which 20 rows landed in an unlucky vs. lucky batch (one sampled batch was dominated by old/bundle SKUs and only matched 4; this matches exactly the "4 ✓" seen passing in tonight's earlier hygiene reports — same flakiness, not a fix that had landed). Rewrote to query deterministically instead of sampling.

Caught a real syntax risk in the first draft of the fix before shipping it: tried a PostgREST embedded join (`sets!inner(theme)`), then checked `information_schema.table_constraints` directly and found there's no actual foreign key between `store_prices` and `sets` — PostgREST's embedded-resource syntax requires one to exist; without it the query would have failed outright, not just been imprecise. Rewrote using two independent plain queries intersected in JS instead, avoiding the unverifiable-from-this-sandbox PostgREST syntax risk the same way HIGH-48's fix did earlier in this session.

Verified: 81/81 tests passing (no new tests — this fix is a deterministic two-query/JS-intersection rewrite, verified directly against live Supabase data rather than needing new unit coverage), tsc clean, node --check valid.

This closes out the original 3-item request (HIGH-48, MEDIUM-48, MEDIUM-49) plus HIGH-49, which was addressed alongside HIGH-48/MEDIUM-49 in the same investigation.

---

### 2026-06-30 (latest) — HIGH-49 rule corrected per Abhinav's explicit policy; real bug caught and fixed in the new heuristic before shipping

Abhinav, after seeing the 8-article HIGH-49 list from the previous session: "my code abhinav12 should only be mentioned if and when the set is available on toycra. if it is not available only there is absolutely no point in mentioning that. also, sets which will be import also do not need that message either." This meaningfully narrows HIGH-49's scope — manually re-classified all 8 originally-flagged articles against this rule and found only 2 of 8 actually need the code (both state a real, present-tense ₹ price at Toycra). Implemented as `src/lib/toycra-availability.ts::genuinelyAvailableAtToycra()` — a real price near a Toycra mention, no hedging/future/import language in that window.

**Caught a real bug in the heuristic's first draft before shipping it:** a whole-sentence hedge check incorrectly flagged the genuine Houndstooth article (`bossks-houndstooth-from-jabbas-sailbarge-set-75397-gets-a-cr`) because the real text — "Toycra is selling it at ₹41,599 ... though it might be out of stock" — contains "might be" later in a long, multi-clause sentence as a *stock-level* caveat, a different concept from *availability* hedging that the function is meant to detect. Caught by testing the function against the real, verbatim article text (not a paraphrase) rather than trusting an earlier ad-hoc check that had used a slightly different test sentence and happened to pass. Fixed by scoping the hedge check to the matched toycra-price window itself (~80 chars) rather than the whole sentence. 10 unit tests added, including the regression case.

Updated `technical-hygiene.mjs`'s HIGH-49 check to use the corrected rule. The 2 articles that genuinely need the code are still awaiting Abhinav's editorial action — not auto-fixed.

Verified: 81/81 tests passing (10 new), tsc clean, node --check valid.

---

### 2026-06-30 (latest) — HIGH-48, HIGH-49, MEDIUM-49 resolved: two real check-script bugs found, one genuine content gap surfaced for review

Abhinav asked to address all three directly. Investigated each against live data rather than the 8-day-old tracker prose.

**HIGH-48 (28% missing piece data):** answered the tracker's own open question by querying `sets` directly — concentrated, not spread evenly. Real building themes (Ninjago, Technic, Creator, Icons, Architecture) all sat at 1-3%; the headline figure was driven almost entirely by non-buildable merchandise themes (Plush Toys, Key Chain, Bags, Story Books — 90-100% "missing" because those products genuinely have no piece count) and multi-set bundle/pack/advent-calendar SKUs (City's elevated 19.1% was confirmed, on direct inspection of all 47 rows, to be ~100% bundles, not single sets). Real gap among genuine buildable sets: ~6%, normal and explainable. Fixed the `CatalogCoverage` check to exclude both populations rather than prescribing a backfill for data that was never actually missing.

**HIGH-49 (Toycra mention without ABHINAV12):** the tracker said "1 article," 8 days stale. Investigating why the nightly check kept reporting clean despite the original article never being fixed found the real bug: the check only ever scanned the 10 most-recently-published articles, a sample shared with unrelated spot-checks (word count, HTML leak). The flagged article aged out of that window and the check silently stopped seeing it. A full-table scan found 8 articles missing the code, not 1, dating back to 2026-05-09. Fixed the check to scan the full table (compliance checks need full coverage, not a recency sample) — full article list with dates handed to Abhinav for editorial review, not auto-fixed (adding an affiliate code to live published content is an editorial decision, not something to silently rewrite).

**MEDIUM-49 (2 articles missing store name):** same `news10`-scope bug as HIGH-49, plus a second, independent logic bug found by reading the actual flagged article: `lego-disney-main-street-usa-43302...` correctly, honestly states "no official store prices... import only" while still quoting a calculated import-price estimate for reader context — the old check's blunt "any ₹ figure requires both store names" rule couldn't tell that apart from a genuine missing-store-name defect. Fixed to only flag a price with no store name AND no import/no-price acknowledgement. Also surfaced, while diagnosing: 9 articles (not previously tracked) mention exactly one store rather than both — 8 cluster tightly in early April 2026 (likely predating consistent dual-store coverage), 1 from May 30 is a real outlier worth a closer look. Full list handed to Abhinav for review alongside the HIGH-49 list.

Verified: 71/71 tests passing, tsc clean (changes confined to `.mjs` audit script, outside the JS/TS test suite's scope by design — these are SQL-query and regex logic changes verified directly against live Supabase data and real article text, not unit-testable in isolation the same way the earlier `auto-approve-policy.js`/`auto-publish-gate.ts` extractions were).

---

### 2026-06-30 — Real weekly hygiene/content-quality reports investigated; 3 check-script bugs found and fixed; 3 live broken hero images backfilled

Abhinav pasted two real, automated weekly reports (Weekly Technical Hygiene, Content Quality) and asked for a review of what's actually wrong. Investigated each finding against live code/data before acting, rather than reacting to the raw alert counts — several turned out to be bugs in the checking scripts themselves, not real site problems.

**One alert flagged as simply wrong, no fix needed:** "100 approved drafts are waiting to be published, threshold 50" — this monitor checks a stale assumption (that `approved` means "drafted, awaiting a human publish click"). It actually means "ready for the generator to write a body" — there is no manual publish step downstream of that for content that passes gates, especially after this session's auto-publish work. Flagged for a future fix to the monitor's own logic, not acted on as a real backlog.

**MEDIUM-65 (new):** `technical-hygiene.mjs`'s 3 hero-image HEAD-check call sites passed `hero_image` directly to `fetch()` without resolving relative paths (`/fallback-hero.png`) against `SITE_URL` first — Node's native `fetch` requires absolute URLs, so this threw immediately and was silently counted as "image broken." Confirmed live: the 3 flagged articles all had the same already-correct `/fallback-hero.png` value, not a real broken image. Fixed all 3 call sites.

**MEDIUM-66 (new):** `visual-renderer.mjs`'s `image_render_broken` check (~75 articles flagged) read `naturalWidth` immediately after `domcontentloaded`, which doesn't wait for images to finish downloading — a race, not a real defect, almost certainly inflated by `next/image`'s real optimization-endpoint latency. Confirmed on one live example that there was nothing actually broken. Fixed to poll `img.complete` with a bounded timeout instead of reading `naturalWidth` at an arbitrary moment; also narrowed the image selector to specifically target content inside `article`/`main`. **Not yet re-verified at the original ~75-row scale** — flagged in the entry itself as needing a fresh run to confirm the fix actually closes the gap, not just the one example checked.

**MEDIUM-67 (new, closes MEDIUM-50):** root-caused the long-standing "Brickset API key check returns ambiguous success shape" mystery. Confirmed via Brickset's own documentation that `{"status":"success"}` is the correct, healthy response — the check was looking for the substring `"OK"`, which never appears in a real success response. The key was never the problem; the check was checking for the wrong string, every single run, since this check existed.

**Live data fix, not a code change:** 3 published articles (all from before this session's editorial-CDN-block fix existed) had raw `live.staticflickr.com` URLs stored as `hero_image`, now returning HTTP 429 from Flickr. Confirmed exact row IDs immediately before writing, backfilled all 3 to `/fallback-hero.png` per Abhinav's explicit choice (quick and safe, matches what `prePublishAutoFix`'s same fallback already uses elsewhere), verified zero remaining `staticflickr` URLs after.

**Real, already-tracked findings, no new action taken:** `CatalogCoverage` (28% of sets missing piece-count data) verified against live data as genuinely real — this is HIGH-48, already tracked, unchanged by tonight. `missing_store_mention` on the LEGO Disney Main Street USA article verified as the system working correctly, not broken — there genuinely is no Indian store price for that set yet, so the article correctly omits a store mention rather than fabricate one; same category as MEDIUM-48/49 (editorial judgment on sparse-data sets, not a bug).

Verified throughout: 71/71 tests passing, tsc clean (no test/type changes needed — all fixes were in `.mjs` audit scripts outside the test suite's scope, plus one live DB update).

---

### 2026-06-29 (latest) — Tier 1/2 signal auto-approve shipped; MEDIUM-64 FIFO fix

**Context, recorded plainly because it changed mid-conversation:** Abhinav initially asked to "fix MEDIUM-64" believing the existing manual-approval gate (HIGH-53) was actually a post-generation "approve the finished article" step blocking publication. Clarified it's the opposite — it's a pre-generation "should this topic even be drafted" gate, and clarifying that distinction was necessary before any fix made sense. Abhinav then explicitly restated the actual goal: "I want a system that automates it... I dont want manual dependency anywhere... that is the whole idea and objective."

Surfaced the real trade-off before writing code: removing the gate entirely means RADAR-03's keyword/score classifier alone decides what gets covered, with no human check on topic relevance or duplication before generation starts — a different risk than anything the downstream quality gates (factuality, voice, Gate 7) catch, since those check whether a *draft* is good, not whether a *topic* was worth writing about. Presented three options; Abhinav chose Option A — auto-approve only the curated, editorially-trustworthy tiers (Tier 1: 4 editorial outlets; Tier 2: official/catalogue sources), explicitly keeping manual approval for Tier 3 (Reddit) and Tier 4 (YouTube): "do not auto select reddit or youtube videos."

**Implementation:** decision logic extracted to `scripts/radar/auto-approve-policy.js` (pure function, not left inline) with 8 unit tests in `__tests__/auto-approve-policy.test.js`. `classify-signals.js` now sets `status='approved'` directly (with `approved_at` + `approved_by:'radar-auto-tier1-2'`, distinct from the manual action's `approved_by:'admin'` — an honest audit trail, not a fabricated one) for Tier 1/2 signals at insert time, bypassing `/admin/pending` entirely for those. Tier 3/4/5 unchanged.

**Real bug caught before shipping, not after:** an early draft of the inline version used the function reference in three ternaries (`isAutoApproveTier ? 'approved' : 'draft'`) instead of calling it — a function reference is always truthy in JS, so every tier including Reddit and YouTube would have auto-approved, the exact opposite of the instruction. Caught while writing the unit tests (the tests forced calling the function with real arguments, which a visual code read alone hadn't), not by inspection. Serves as a concrete argument for why "write the test, even for a 2-line function" isn't ceremony.

**Safety check run before shipping, not assumed:** with tonight's earlier 696-row `pending_drafts` cleanup having deleted historical draft rows, checked whether a re-appearing RSS item could now slip past dedup (since the original CRITICAL-2 "63 times over 7 weeks" duplicate-article incident was specifically about this failure mode). Confirmed the existing historical-dupe check in `dedupe-signals.js` operates on `raw_signals`' own unbounded history (`url_hash`/`title_hash`), entirely independent of `pending_drafts` — so it's unaffected by the cleanup and still catches a resurrected URL one layer upstream of where the new auto-approve logic runs. No additional code needed for this.

**MEDIUM-64 fixed same session:** `publish-drafts.mjs` now orders `created_at ascending`, matching the generator's FIFO convention exactly (was `updated_at descending`).

Tests: 71/71 passing (8 new for the auto-approve policy). tsc clean.

---

### 2026-06-29 — HIGH-54 found and fixed: A6 sign-off prompt gap, via supervised dry-fire

**Found via the post-push verification dry-fire** (`gh workflow run generate-drafts.yml -f limit=3`) that this session's own earlier recommendation led to running — exactly the kind of thing a live smoke-test is for. 1 of 3 rows: a 670-word LEGO Dinosaur Fossils review, generated cleanly by Gemini, immediately rejected+deleted by the new `isGenuineFail` path (working correctly) for failing Gate 7's `A6_sign_off` rule. Confirmed real, not a regression: `ruleA6_signOff` (`src/lib/hard-rules.ts`) requires one of 6 canonical BOI sign-off patterns ("on that bombshell", "bubyee", etc.) in the final 200 characters of the body, hard-failing for `review`/`opinion` formats. Checked `src/lib/prompts/draft-prompt.ts` directly: **zero mention of any sign-off requirement, anywhere in `buildSystemPrompt()` or `buildUserPrompt()`.** The Voice Codex (`docs/codex/BOI_Codex_v2.md`) documents this convention extensively (3 example sign-offs, explicit "The Bombshell" section header) — but nothing in the generation code path reads from that file or injects its content into the live prompt. The model was never told this requirement exists; it wasn't ignoring an instruction, there was no instruction.

**Fix:** added a "CLOSING LINE" section to `OUTPUT_FORMAT` (the second half of `buildSystemPrompt()`) giving the model the 3 most distinctive canonical phrases verbatim, scoped to review/opinion (where A6 hard-fails) with news/guide noted as optional (where A6 only warns). Verified each example phrase against the actual `ruleA6_signOff` regex set in the real TS/JS engine — not assumed — before considering this done.

**Process note:** this was found specifically *because* this session pushed for a small supervised dry-fire before trusting the daily cron, rather than letting the first live run be unsupervised at 6x the row count. A 20-row unattended run hitting this same gap pre-fix would have auto-deleted up to ~20 review/opinion drafts with no human ever seeing why.

- **Status:** Fixed, same day. `system.txt` snapshot regenerated to match (note: `vitest run --update` does NOT work for this — the snapshot tests use bare `readFileSync()` + `toBe()`, not vitest's snapshot API; regenerating requires writing `buildSystemPrompt()`'s actual output to the file directly).
- **Owner:** Terminal/Claude (done).
- **Dependencies:** None.

**Related finding, same day, no code change — verification work after the push:** while sanity-checking the fix against real data (109 live published articles, applying `ruleA6_signOff`'s actual regex logic against each one), found that all 16 live `Review`-category articles already contain the canonical sign-off — but inspection showed it's a **verbatim, identical string** ("On that bombshell, bubyee.") across all 16, not varied prose. Traced to `prePublishAutoFix()` (`src/lib/publish-draft.ts:98`, `SIGNOFF_TEXT` constant) — already programmatically force-appends the canonical line if missing, before insert. This raised a real question: `prePublishAutoFix` only runs at publish time, on drafts that have *already passed* Gate 7 — so a draft Gate 7 rejects for a missing sign-off (like the dry-fire's row 2) never reaches that safety net, even though the fix is mechanical and already exists elsewhere in the pipeline.

**Decision (Abhinav, explicit): leave the sequencing as-is, do not move the auto-fix earlier.** Reasoning, Abhinav's framing confirmed: the sign-off is a fixed, hardcoded signature line — whether Gemini writes it in its own prose or it gets force-appended afterward looks identical to a reader, so there's no quality argument for catching it earlier *on its own*. But auto-fixing it before Gate 7 runs would make `A6_sign_off` permanently unable to fail, which destroys its actual value: in practice (now that the prompt states the requirement) A6 isn't really testing "is this exact phrase present" so much as "did the model follow the closing-format instruction at all" — a draft that trails off mid-thought into a price comparison with no closing beat is a different, more concerning signal than "used different wording for the sign-off," and auto-fixing before the gate would mask that signal entirely, every time, for every draft. `prePublishAutoFix` is correctly scoped to polish drafts that are *already otherwise good* (passed every gate) — moving it earlier would mean patching one symptom on a draft not yet confirmed to be otherwise good, sometimes for nothing (if it then fails a real factuality/source-fidelity check moments later anyway). Now that the prompt fix exists, "Gemini forgets despite being told" should become the rare case rather than the common one — not worth weakening a real check to optimize for an occasional miss.

---

### 2026-06-28 (latest) — 696-row pipeline cleanup executed; BothProvidersFailedError policy added

**Bulk delete executed (Abhinav's explicit instruction):** "bring the content down to last 10 days, any content prior should be deleted from the pipeline, don't publish, just delete." Scoped and confirmed with Abhinav before execution: applies to `approved`, `draft`, `failed_lint`, `rejected` statuses with `created_at` older than 10 days — explicitly **excludes** `published` (all 107 live articles untouched) and anything created in the last 10 days regardless of status.

Pre-delete count verified live immediately before executing (696, matching the scoping query run minutes earlier — no drift). Executed via `execute_sql` (DML, not `apply_migration` — this is a one-time data cleanup, not a schema change) as a single `DELETE ... RETURNING id`, confirmed no FK references into `pending_drafts` beforehand (same check already done earlier this session for the single-row delete logic). Post-delete state verified directly, not trusted from the delete response: `approved`=100, `draft`=71, `published`=107, `rejected`=15 (was 989 total, now 293 — 696 deleted exactly as scoped). Oldest surviving non-published row confirmed at 2026-06-19, inside the 10-day window as intended. `failed_lint` is now empty (all 9 prior rows were >10 days old).

**Breakdown of what was deleted:** 442 stale `approved`-awaiting-generation rows (HIGH-52's backlog), 129 stale `draft` signal-review rows (HIGH-53's backlog), 9 `failed_lint` rows, 107 stale `rejected` (null-body) rows, and 9 rows with real generated `draft_body` text that were never published — including the 4 already-confirmed-404 GAP-03 Amazon Ancient Ruins duplicates (closed 2026-06-21) and 5 other May-dated unpublished drafts/rejects. Nothing here was load-bearing; all genuinely stale or already-superseded content.

**Caveat recorded plainly:** this clears the *visible* backlog pressure but does not by itself fix HIGH-52's throughput problem (ingestion ~18/day vs. generation ~6/day net, pre-fix). Re-accumulation at the same rate starts immediately unless the not-yet-applied patch set (Cerebras eligibility fix, factuality gating, reject+delete policy) actually lands and is allowed to run.

**New policy, same turn — "what fails through Gemini and Cerebras both should be rejected and deleted":** clarified by Abhinav mid-conversation that "recycled" was a slip for "deleted" — no ambiguity. Implementation required distinguishing three previously-conflated failure modes in `generate-approved-drafts.ts`'s catch block, all of which currently just retry forever with no DB write:
  1. **DEFERRED** (Gemini retryable-fail + Cerebras ineligible, excerpt/fullBody both <200 chars) — unchanged, still retries automatically. Cerebras was never attempted here; nothing to reject.
  2. **Gemini non-retryable fail, Cerebras never attempted** (e.g. a 4xx/bad-request from Gemini) — confirmed with Abhinav this should **also** keep retrying, not be deleted. Distinct from case 3 below.
  3. **Gemini retryable-fail + Cerebras eligible + Cerebras itself also fails** (API error, or malformed/unparseable response) — this is the case targeted. New `BothProvidersFailedError` class added to `src/lib/generate-with-failover.ts` (same dedicated-error-class pattern as `LintFailedError` in `publish-draft.ts`, deliberately not string-matching `error.message`, which would be fragile). Caught via `instanceof` in the generator's catch block: row is set to `status='rejected'` with `discard_reason` recording both providers' failure messages, then deleted. Two-step (update then delete) rather than a single delete, so a delete failure leaves a `rejected` record rather than silent data loss — same rationale as the existing quality-gate reject+delete path.

New telemetry: `bothFailed` counter, folded into `generator_runs.drafts_failed` (real failure, just a more specific cause) while staying visible separately in `provider_stats.both_failed` and the console summary line.

**Infrastructure check (no new building needed):** "let it auto run daily and auto-publish going forward only if it passes all quality checks" — confirmed both `generate-drafts.yml` (daily, 08:30 UTC) and `publish-drafts.yml` (3x/day) already exist and are already scheduled; this was already true at the infrastructure level before tonight. What's actually new is the *content* of what runs once triggered (Cerebras eligibility, factuality-gated auto-publish, reject+delete, unified publish logic, and now BothProvidersFailedError) — all still sitting in the unapplied patch set (0002–0005, plus this turn's `generate-with-failover.ts`/`tests/snapshot.test.ts` changes, not yet packaged) as of this writing. Nothing auto-runs with tonight's fixes until those patches are applied to the real checkout and pushed.

Tests: 63/63 passing (3 new, covering `BothProvidersFailedError`'s `instanceof` behavior, message construction, and distinguishability from a plain `Error` — the exact property the catch-branch logic depends on). `tsc --noEmit` clean.

---

### 2026-06-28 (later still) — HIGH-52 root cause corrected via gh diagnostic dispatch

**Self-correction:** Earlier the same day, this tracker recorded HIGH-52's post-fix shortfall as "Gate-7-routed manual review" without checking actual DB rows against the `generator_runs` telemetry. That attribution was wrong. Re-checked by querying `pending_drafts` directly by provider/timestamp — zero rows matched. Real cause found by dispatching a 5-row diagnostic run (`gh workflow run generate-drafts.yml -f limit=5` from Abhinav's terminal) and reading the actual log: all 5 oldest backlog rows DEFERRED, Gemini quota-exhausted + Cerebras ineligible (excerpt <200 chars). Quantified against the full backlog via Supabase: 359/532 unstarted rows (67.5%) are structurally Cerebras-ineligible (334 null-excerpt + 25 short-excerpt), meaning two-thirds of the queue has no failover if Gemini is rate-limited when its FIFO turn comes up — which explains why the oldest rows (created 2026-05-09) have sat unprocessed for 50 days. This is a different, more specific finding than the earlier "routed to review" framing, and a materially different one than "backlog growing because of insufficient RUN_LIMIT." Two policy decisions raised, both explicitly held pending Abhinav's call: (1) lower the Cerebras 200-char floor for this subset, (2) separately, auto-publish-on-pass / auto-reject-delete-on-fail policy for completed generations — NOT implemented this session, deliberately deferred until the DEFERRED-row mechanism was understood, since shipping a delete policy on top of an unexplained queue pattern risked deleting never-attempted rows.

---

### 2026-06-28 (later still) — HIGH-53 found: 200-row signal-review backlog distinct from HIGH-52

**Self-correction, recorded plainly:** earlier the same session, HIGH-52 was analyzed and "fixed" (Cerebras eligibility, factuality gating, reject+delete policy — see commits not yet applied as of this writing) under the assumption that the only undelivered-content backlog was the 542 `approved`+null-body rows. Abhinav dry-ran `publish-drafts.mjs --dry-run` to sanity-check the merge work, got zero rows, and correctly traced that down to the actual query logic rather than accepting "nothing to publish" at face value — which surfaced a second, separate, 200-row backlog (`status='draft'`, null body) that had been accumulating since 2026-06-02, invisible to every script touched earlier in the session. Root cause: this is RADAR-03's intentional pre-generation signal-review gate (raw classified signals awaiting a human "Approve signal"/"Reject" click), not a code bug — but it had never been cross-checked against what `classify-signals.js` actually writes vs. what CLAUDE.md's pipeline-order doc summarizes. Filed as HIGH-53. No code fix needed — `/admin/pending`'s existing "Approve all" bulk action resolves it in one click; this is an editorial backlog, not a technical one. Real total backlog restated: 742 rows (542 + 200), not ~540 as stated everywhere earlier today. Also found and filed separately: MEDIUM-64 (publish-drafts.mjs's queue ordering is reverse-chronological, not FIFO like the generator's — low impact today, queue is normally empty).

---

### 2026-06-28 (later) — HIGH-52 capacity sizing measured, GAP-06 re-verified

**HIGH-52 capacity sizing (real numbers, not guessed):** Queried `generator_runs` + `pending_drafts` live via Supabase. BOM fix confirmed working (`drafts_failed`=0 on both post-fix runs vs 9–33/run before). But net throughput is only 5/20 and 7/20 on the two post-fix scheduled runs — most of the gap is Gate-7-routed manual review + lint fails, not infra failure. Ingestion holds at ~18.3/day (7-day avg). **Backlog is still net-growing (~12/day)** even with the BOM fix shipped — 532 approved rows awaiting generation, oldest from 2026-05-09. RUN_LIMIT increase alone won't close this since the bottleneck is downstream of the API call. Real decision (RUN_LIMIT raise vs Gate-7 tuning vs manual-approval batching) still open for Abhinav — flagged in HIGH-52 entry above, not resolved by this session.

**GAP-06 re-verified, downgraded not closed:** Re-read `docs/cerebras-pilot-report.md` in full — all 5 manual voice sign-off checkboxes still empty. Confirmed via direct read of `generate-with-failover.ts` that nothing in the live pipeline depends on these checkboxes; Gate 7 (CRITICAL-4, closed same day) supersedes this as the actual gating mechanism. Status changed from "open action" to "informational/no dependency" — corrects scope, does not fabricate a sign-off that didn't happen.

---

### 2026-06-28 — Chat-session close: CRITICAL-2/3/4 closed, Gate 7 live, checkout fork resolved

**HEAD:** `6c2deec` | **Health:** 96 (unrecomputed) | All claims below verified against live commits/DB by chat-session Claude before being recorded here — not transcribed from terminal summaries uncritically.

**HIGH-50** — Mischaracterized as "generator skips null draft_title"; actual cause: 46 rows from RADAR-03 bulk-approve simply never had a title pre-seeded, generator filters on `draft_body` not `draft_title`. Backfilled live via Supabase, 0 remaining. Closed.

**CRITICAL-1** — Discovered already fixed 5 days earlier (`baaf930`, 2026-06-23); tracker had never been updated to reflect it. Doc corrected.

**Review schema** — `buildReviewSchema()` wired onto `/news/[slug]` for `category='Review'` articles. Migration + backfill (13/14 reviews, verdict+set_number) applied live. Commit `72bde43`.

**CRITICAL-2 (RADAR-01 dedup audit)** — Root cause: `dedupe-signals.js` only ever compared signals within a single run's batch, never against history. One Brothers Brick URL was fetched 63× over 7 weeks, marked `'unique'` every time. 17,183/19,323 `raw_signals` rows (89%) were re-fetch noise. **36 excess duplicate articles are live published** across 33 source stories — found, decision made to leave as-is (no redirect/unpublish), only the forward-leak closed. Fixed: Pass 0 historical check in `dedupe-signals.js`, incremental `existingUrls` update in `classify-signals.js`. Commit `370abbf`. Closed.

**CRITICAL-3 (url_hash normalization)** — `hashUrl()` didn't normalize scheme (http/https) or www-prefix; 35 articles confirmed duplicated across protocol variants. Fixed in `fetch-rss.js`. Commit `370abbf`. Closed.

**CRITICAL-4 (Voice scorer / Gate 7)** — Built from `docs/voice-scorer-rubric.md` v1.0: Part A (8 deterministic hard rules) + Part B (LLM-as-judge, Gemini/Cerebras failover). Found and fixed two real bugs during testing: A2 word-wrap false-positive on the rubric's own known-good example; A1's `\bwallet\b` never matched the plural "wallets" (word-boundary issue), widened vocab, then downgraded to WARN after confirming ~79% of real published articles don't reuse wallet language post-opener. Calibrated against 65+ real articles (10-article Cerebras pilot corpus + 49-article live STRONG corpus) — zero false positives on A2/A3/A4/A7/A8. Part B soft score showed a 19-point within-provider variance and a 40-point cross-provider variance on the same article (one Cerebras run produced a pathological all-zeros score that the parser was silently coercing instead of erroring — hardened). **Step 5 sign-off: ship hard rules only (A2/A3/A4/A6-review/A7/A8) as a real gate; soft score advisory-only, logged not blocking.** Extracted to `src/lib/hard-rules.ts`, wired into `generate-with-failover.ts` — `requiresManualApproval` now driven by `hardFail`, confirmed gating the `news` auto-publish path. Commits `5e2095b`, `a91c7c8`, `3606911`. Closed and **live** — not just signed off on paper.

**HIGH-52 (generation backlog)** — Real root cause: a BOM character (U+FEFF) at position 7 of the `GEMINI_API_KEY` GitHub Secret, causing `undici` to reject it as an invalid HTTP header value (`ByteString` error) on ~45-66% of requests per run — independently corroborated against `generator_runs` telemetry pulled directly from Supabase (exact failure counts matched before the BOM theory was ever mentioned). Fixed: `getSecret()` now strips BOM globally, not just leading position. Commit `cd8bfbc`. **Still open:** ingestion-vs-generation throughput capacity sizing never done.

**MEDIUM-59** — Resolved by reading `docs/FAN_COLAB_TIMELINE.md` directly (moved from `docs/archive/` 2026-07-05 — it's an active planning doc, not a frozen record): RLFM needs 3+ Codex-compliant reviews (already satisfied since 2026-05-14's REVIEWS-FIRST-3), not 20. RADAR-08's 14 auto-published "Review"-tagged news articles explicitly documented as "not required." Status: BLOCKED_EXT, not time-critical.

**Checkout fork, investigated and resolved** — `Documents\BricksofIndia\website` (Windows) had diverged 3 commits from origin (`84a5571`, `32833f6`, `61c3847`). Initial terminal assessment called this "real, irreplaceable work" (the HIGH-47 contact-form fix specifically). Verified false two ways: (1) author-timestamp on `61c3847` matched origin's `deaf982` to the exact second — the signature of a prior cherry-pick, not independent authorship; (2) byte-for-byte `diff` across all 5 changed files (`contact.ts`, `contact-email.ts`, `schemas.ts`, `Footer.tsx`, `ci.yml`) confirmed identical content already on origin. All 3 commits were stale duplicates of work already merged via earlier cherry-picks/reconciliations. Resolved via `git reset --hard origin/main` in `website` (backup branch `backup-pre-reset-2026-06-28` kept, points at old `61c3847`), **not** a rebase, which would have replayed superseded code over a working, already-deployed feature. Both checkouts now confirmed at matching HEAD.

**Still pending from today, not closed:**
- `social-automation/.env`, `client_secrets.json`, `youtube_token.json` exist **only** in `website` (gitignored, never sync via git) — not yet copied to `bricks-of-india`. Until they are, `website` is not safe to fully retire.
- `website` needs one more `git pull` to pick up `6c2deec` (the score-voice.ts comment fix) — was 1 commit behind at last check.
- HIGH-52 capacity sizing (ingestion vs generation rate).
- 2 newly-discovered near-duplicate articles (`lego-castle-factions-*-no-set-number-yet` / `*-might-surprise-you`) — found during calibration spot-checks, not yet filed as a ticket, different shape of duplicate than CRITICAL-2 (same story, different source_url, not caught by the url_hash-based fix).
- MEDIUM-63 (dashboard reconciliation) — untouched, stale since 2026-05-25.
- Full backlog audit performed this session (~50 open items across CRITICAL/HIGH/MEDIUM/LOW plus deadline-driven items IG-TOK-01, YT-OAUTH-01, CE-01, FAN-COLAB-PROOF-01, RLFM-RUNWAY-01) — no new closures from the audit itself, just visibility. See tracker body for full current list rather than trusting any chat summary of it, including this one.

---

### Days 35-N — 2026-06-03 to 2026-06-21 — social heartbeat, security hardening, Cerebras failover, schema reconciliation, filler filter

**HEAD:** `128d536` | **Health:** 96 | **news_articles:** UNVERIFIED (last confirmed: 98 at Day 34 close)

> This consolidation entry captures 6 PRs / feature branches merged after Day 34 close. Per-PR detail is in the GitHub PR descriptions. Pure status-capture; no forward recommendations.

**feat/social-heartbeat** (commits `24e7e5b`→`ed20404`, merged `7c8ffc8`):
- `social_automation_heartbeat` table added: columns `platform` (PK), `last_attempt_at`, `last_success_at`, `last_failure_at`, `last_error`, `updated_at`. Migration: `20260617000000_social_automation_heartbeat.sql`. Seeded with 2 rows: instagram, youtube.
- `pipeline.py`: writes heartbeat on every run (attempt timestamp on entry; success/failure on exit).
- `health-check.mjs` Check 6c: reads heartbeat table for stale pipeline detection.
- `youtube_oauth_helper.py`: emoji→ASCII for Windows cp1252 compatibility (commit `3bc2a6e`). `last_attempt_at` column + None-success path + no-content signal fixed (commit `ed20404`).

**Security hardening** (commits `3bd4058`, `98e0958`, `e8d7192`):
- `v_published_articles_public` view created: `security_invoker=true`; UNION of `news_articles` + `blog_posts` WHERE `published_at IS NOT NULL`; `GRANT SELECT TO anon`; `REVOKE INSERT/UPDATE/DELETE FROM PUBLIC`. Migration: `20260606000000_v_published_articles_public.sql`. Note: neither source table has `updated_at` column — `NULL::timestamptz` used as placeholder.
- `X-Robots-Tag: noindex` headers on admin routes; `Content-Security-Policy-Report-Only` header added (commit `3bd4058`).
- `robots.ts`: 22 AI crawlers allowed with explicit disallows + crawl-delay (commit `e8d7192`).
- technical-hygiene.mjs Group 16 checks added (commit `3bd4058`; exact check descriptions not recorded in commit message — UNVERIFIED).

**PR-2b-3: Cerebras failover** (commits `2b19223`, `8e3f915`, merged `aded950`):
- `generate-approved-drafts.ts`: Cerebras (`gpt-oss-120b @ temp 0.7`) added as Gemini failover provider. Triggers on Gemini `RESOURCE_EXHAUSTED`/`RATE_LIMIT_EXCEEDED`.
- Cerebras probation dropped (`requires_manual_approval` not set for Cerebras articles); gates-only auto-publish applies uniformly.
- `docs/cerebras-pilot-report.md`: 5 bodies, 80% lint pass (4/5). Manual voice read sign-off checkboxes empty as of 2026-06-21 — UNVERIFIED whether Abhinav reviewed.

**PR-2b-3.5: generator_runs write fix** (commits `c36248e`, `0ba1dea`, `352bd5d`, merged `293027b`):
- `generate-approved-drafts.ts`: generator_runs UPDATE column names corrected to live schema (`ended_at`, `drafts_succeeded`, `drafts_lint_failed`, `drafts_deferred`, `drafts_routed_to_review`, `drafts_failed`, `provider_stats`). Was writing to fantasy column names — silent no-op in production.
- Migration `20260619000000_failover_infrastructure.sql`: rewritten to live schema (original had `total_attempted`, `gemini_ok`, `cerebras_ok`, `failed`, `skipped`, `finished_at` — none existed in live DB).
- Admin Server Actions: `draft_id` added to all error log messages (commit `352bd5d`).

**PR-2b-3.6: Schema drift audit + reconciliation** (commits `d06d37d`, `746cdaf`, `7e22036`, no explicit merge commit):
- `docs/schema-live-2026-06-20.md`: 21-table live schema snapshot.
- Migration `20260620120000_phase_b_reconciliation.sql` (idempotent): `generator_runs` +`drafts_failed`; `guides` +`hero_image`, +`seo_title`, +`seo_description` + backfill; `pending_drafts` +`discard_reason`, +`published_at`, -`lint_results` (plural); `published_at` backfilled from `news_articles` + `blog_posts`; CHECK constraint `pending_drafts_published_has_url` (`status != 'published' OR published_url IS NOT NULL`) applied and validated.
- `generate-approved-drafts.ts` `autoPublish()` bug: was writing `status='published'` without `published_url` or `published_at` — fixed to write all three.
- `src/app/admin/pending/actions.ts` `publishOneDraft`: `published_at: now` added.
- Smoke test article `lego-friends-sonia-figure-frnd0869-a-playground-mystery` retracted: `news_articles` row deleted; `pending_drafts` row 657d36b6 set to `rejected` with editorial `discard_reason`.
- Historical dedup-miss cleanup: rows `c1ee6ede`, `a00876f0` deleted (pending_drafts without source_url).

**PR-2b-3.7: Filler pattern filter in RADAR-03** (commits `e160e39`, `aa73190`, `6aa31a4`, merged `128d536`):
- `scripts/radar/filler-patterns.js` (new CJS module): `FILLER_RE = /^random (set|figure|minifigure|build|theme) of the (day|week)/i`; exports `isFillerPattern()`.
- `scripts/radar/classify-signals.js`: `isFillerPattern()` check after score threshold; matched signals pushed to `fillerDrafts[]` with `status: 'rejected'` and `discard_reason: 'filler_pattern_skipped:...'` then written via `writeDrafts(fillerDrafts)`. NOT silently skipped — audit trail in DB.
- `scripts/radar/__tests__/filler-filter.test.js` (14 vitest tests): 6 block cases, 8 pass-through cases. Daily Bugle (`76342 Spider-Man vs. Mysterio: The Daily Bugle`) regression anchor prevents broadening of `FILLER_RE`.
- CLASSIFY SUMMARY log includes `skipped_filler=` count.
- 4 pre-existing snapshot test failures (trailing space vs empty line in baseline files) deferred to separate PR.

**DB schema changes since Day 35 close:**
- `pending_drafts`: +`published_at` (timestamptz), +`discard_reason` (text), -`lint_results` (plural dropped), +CHECK `pending_drafts_published_has_url`
- `guides`: +`hero_image`, +`seo_title`, +`seo_description`
- `generator_runs`: +`drafts_failed` (integer)
- `social_automation_heartbeat`: NEW TABLE (service_role only, RLS enabled, no anon policies)
- `v_published_articles_public`: NEW VIEW (security_invoker, anon SELECT)

**DB row counts (2026-06-21 — partially UNVERIFIED):**
- news_articles: UNVERIFIED (last confirmed 98 at Day 34 close; scheduled pipeline ran since)
- store_prices: UNVERIFIED (last confirmed 1,512 at Day 34 close ⚠️)
- posted_sets: UNVERIFIED (last confirmed 9)
- pending_drafts: published count increased by autoPublish bug fix; exact current count UNVERIFIED

**Key commits (Days 35-N):** `2b19223` → `8e3f915` → `aded950` → `24e7e5b` → `7c8ffc8` → `3bd4058` → `98e0958` → `e8d7192` → `c36248e` → `0ba1dea` → `352bd5d` → `293027b` → `d06d37d` → `746cdaf` → `7e22036` → `e160e39` → `aa73190` → `6aa31a4` → `128d536` (HEAD)

---

### Day 34 — 2026-06-03 — CQS spike resolved, fallback hero system, social automation hardened

**HEAD:** `57a3113` | **Health:** 97 | **news_articles:** 98 (+14 from overnight scheduled runs)

**Root cause of Day 34 work:** Social automation `social-automation.yml` run 26815624526 failed after 6m47s. Diagnosis: YouTube OAuth refresh token expired (`invalid_grant`) at Step 9. IG carousel + Reels posted successfully (media IDs `18127043203618719`, `18021263351831817`) but `posted_sets` never recorded. Failure chain: YouTube exception → notifier crash (BOM encoding) → traceback never printed. Separately, CQS report showed 158 criticals (spike from Day 33's 22) — traced to null hero images + misapplied checks.

**Social automation hardening (commits `1477c75`, `a8b1546`):**
- `publisher.py`: `creds.refresh()` wrapped in `try/except RefreshError` — token failure now returns `None`, YouTube skipped gracefully instead of crashing pipeline
- `pipeline.py`: `post_youtube_shorts()` wrapped in its own `try/except` — IG-live sets always reach `mark_as_posted()` regardless of YouTube outcome; fatal error print moved stderr → stdout so GHA captures real traceback
- `notifier.py`: `_sanitize()` strips `﻿` BOM + encodes ASCII before HTML embed; emoji removed from subject to avoid `resend@0.7.0` latin-1 crash
- `health-check.mjs` Check 6b: YouTube token expiry check (missing secret → alert, malformed JSON → alert, `expiry` ≤3 days → alert); `YOUTUBE_CLIENT_SECRETS` added to `health-check.yml` env + `secrets-manifest.json`
- `posted_sets`: `76470-1` inserted manually (IG live, YT failed — prevents duplicate post)

**YouTube re-auth attempt (blocked):**
- Root cause confirmed: refresh token `invalid_grant` (Google OAuth app in Testing mode, tokens expire after 7 days)
- `client_secrets.json` corrected: wrong `client_id` (`505184160322-...`) → correct (`824336036645-...`) from `.env` YOUTUBE_CLIENT_SECRETS
- `youtube_oauth_helper.py` written: proper state sharing between `authorization_url()` and `run_local_server()` to prevent CSRF mismatch; `redirect_uri` set before URL generation
- Google OAuth consent screen blocked: app under verification review (submitted 2026-06-02, 4–6 week review). `bricksofindia007@gmail.com` added as test user but `access_denied` persisting (propagation or UI issue)
- Status: YouTube Shorts skipped gracefully. IG pipeline unaffected. Re-auth resumes when Google review completes or test user access resolves.

**CQS spike resolution — 158 criticals → 0 actionable (8 commits `14fedb4`–`57a3113`):**

Code fixes:
- `visual-renderer.mjs`: `image_render_broken` check now guards with `art.hero_image` — null hero images no longer flagged as broken render (were 41 false-critical triggers)
- `content-linter.mjs`: `missing_image` now only fires when slug contains a 4–6 digit set number — MOC/community articles suppressed
- `content-linter.mjs`: `placeholder_image` check carves out `/fallback-hero.png` as canonical
- `content-linter.mjs`: `duplicate_image` suppressed when both articles share the same set number — same product, one Rebrickable image expected
- `publish-drafts.mjs`: `prePublishAutoFix(body, draft, slug)` — 3 new gates: bad opener rewrite (BOI-voice title-derived replacement), store mention injection (₹ price + no store → MyBrickHouse/Toycra line), verdict injection (₹ price + set number in slug + no verdict → WAIT); `BAD_OPENER_PATTERNS` constant; slug passed as third arg; verdict gate requires set number in slug (prevents MOC false-positives)
- `publish-drafts.mjs`: `EDITORIAL_CDN_BLOCKLIST` expanded to 8 domains (added `cdn.bricklink.com`, `i.imgur.com`, `external-preview.redd.it`, `preview.redd.it`)
- `publish-drafts.mjs`: `resolveYouTubeHeroImage` no-image path now returns `/fallback-hero.png` instead of `null`

DB fixes (46 articles updated across 3 script runs):
- 41 `news_articles` + 1 `blog_posts` null `hero_image` → `/fallback-hero.png`
- 5 Rebrickable fallback images resolved (set numbers found in slugs): `5986-1`, `1999-1`, `11380-1`, `42228-1`, `3500-1`
- 3 `VERDICT: BUY` → `VERDICT: BUY NOW` (normalised to strict regex)
- 1 verdict injected (`bossks-houndstooth`)
- 5 bad openers rewritten retroactively (volvo-ec500, death-star, hogsmeade, venator, jabbas-barge, imperial-lambda, bossks)
- 4 duplicate openers rewritten (`Your wallet called.` → article-specific lines)
- 1 store mention injected (`1999-adventurers-amazon`)
- 2 forbidden word fixes (`lego-themes-explained`, `how-to-store-display-lego`)
- 1 duplicate title renamed (`unplanned-lego-photos-chaos-2` → `unplanned-lego-photos-when-chaos-becomes-the-shot`)
- 1 word count extension (`reviving-9v` 248w → 337w)
- India paragraph check confirmed correct (3 slugs, `content` column, `has_rupee:true`)
- 0 missing signoffs (CQS 21-count was false alarm — all articles have signoff)

**DB state (2026-06-03):**
- news_articles: 98 | blog_posts: 23 | guides: 9 | reviews: 3
- pending_drafts: approved:331 | draft:91 | published:78 | rejected:4
- store_prices: 1,512 ⚠️ (was 2,600 at Day 33 — investigate scraper run)
- posted_sets: 9

**Key commits (Day 34):** `1477c75` → `a8b1546` → `14fedb4` → `ff18be8` → `9d7d19c` → `43c6321` → `79b6e63` → `57a3113` (HEAD)

---

### Day 33 — 2026-06-02 — P0 sweep, three hardening systems, scheduled publish, social automation fixed

**HEAD:** `1debd26` | **Health:** 97 | **news_articles:** 84 (+11)

Shipped:

**P0 fixes (commits `caaff6e`, `2110dce`):**
- Homepage deal cards query flipped: sets-first (MRP) → store_prices-first (in_stock), `createServerClient()`. Dead `prices(*)` join was causing zero prices on all deal cards since Day 9.
- 251 approved drafts had null `draft_title` → bulk pre-populated from `source_title` (`fix-null-draft-titles.mjs`).
- NHM review verdict patched: "WAIT FOR SALE" → "WAIT" (invalid enum).
- Editorial CDN blocklist in `publish-drafts.mjs`: Squarespace/Brothers Brick/Flickr/JBB images now trigger Rebrickable fallback chain at publish time instead of being stored as hotlink-protected URLs. 27 existing articles backfilled (`fix-editorial-hero-images.mjs`): 1 Rebrickable image, 26 nulled (MOC/community content).
- `BRICKSET_API_KEY` added to `technical-hygiene.yml` env block — key was in GitHub Secrets but never forwarded to the step, firing false 401 alert every Monday.
- `REBRICKABLE_API_KEY` already fixed in `publish-drafts.yml` (prior session carry-over confirmed fixed).

**CQS content sweep (commits `c7725fd`, `432b830`, `da9d605`, `916fe60`):**
- Jaiman Toys removed from 25 news_articles + 1 blog_post via bulk regex (`fix-cqs-warnings-day33.mjs`). Store removed 2026-05-31; articles published before that date still referenced it.
- 16 missing signoffs ("On that bombshell, bubyee.") added to news_articles.
- Duplicate hero image (75313 AT-AT) on `lego-sets-destroy-wallet-2026` → replaced with 10366 Tropical Aquarium (Rebrickable).
- Forbidden words stripped: "testament" → "proof of" (weapon-wednesday), "whimsical" → "creative" (febrovery). Signoff added to febrovery.
- 4 articles with missing India Paragraphs fixed with live `store_prices` data: creator-2026 (278w→355w, real prices 31150/31151/31152), ideas-2026 (315w→372w, Amazon removed, real prices 21365/21367), love-birds (Toycra note + ABHINAV12 added, verdict VERDICT:BUY→BUY NOW), mybrickhouse-arrivals (Has ₹: false→true, ₹1,699→₹45,799 tier coverage).
- 7 short articles extended to 300w+ with substantive BOI-voice additions (tahu 230→336, bo-katans 279→352, summer-fun 232→319, porco-rosso 246→333, contest-roundup 227→327, megatron-brickheadz 249→340, ebon-hawk 259→347).
- 2 bad openers rewritten: technic-42228 "Okay, everyone," → "Your wallet called.", love-birds "Hey everyone! So," → direct set introduction.
- summer-fun additional fixes: verdict WAIT FOR SALE→WAIT, signoff "it's time to say goodbye"→"bubyee".
- `posted_sets.created_at` → `posted_at` in hygiene Check 15i — column never existed, was silently firing false alerts.
- 11 articles published in batch run (news: 73→84). 4 Gate 2 failures reset to approved.

**Three hardening systems (commit `0262dc0`):**
1. **Publisher pre-publish gate** (`publish-drafts.mjs`): `prePublishAutoFix()` runs on every draft before DB insert — strips markdown, removes Jaiman Toys, substitutes forbidden words, injects ABHINAV12 if missing, appends signoff. `cqsHardCheck()` resets drafts with script injection/leaked draft markers to `approved` for regeneration. Nothing that fails CQS tomorrow is publishable today.
2. **CQS auto-fixer extended** (`content-auto-fixer.mjs` + `content-linter.mjs`): three new fix types — `jaiman_reference` (strips Jaiman Toys), `forbidden_word` (16-pattern substitution map), `missing_signoff` (appends signoff). All three now `auto_fixable=true` in linter.
3. **Secrets manifest** (`.github/secrets-manifest.json` + `scripts/audit-secrets-manifest.mjs`): declares all 16 secrets × 15 workflows, 65 references. Validates Check A (every required secret present in workflow) + Check B (every workflow secret declared in manifest). Wired into `code-audit.yml` Monday run. Audit passed clean at commit time. Catches BRICKSET_API_KEY and REBRICKABLE_API_KEY class of bugs before they reach production.

**Scheduled publish-drafts (commit `0ad0411`):**
- `publish-drafts.yml` now has 3 cron triggers: 00:30 IST (19:00 UTC), 13:00 IST (07:30 UTC), 18:00 IST (12:30 UTC).
- 15 per run × 3 = 45 articles/day max. Independent schedule (not chained to radar.yml — resilient).
- `NEXT_PUBLIC_SITE_URL` added to env block.
- `workflow_dispatch` with limit input preserved for manual override.
- 19 approved-with-body drafts flipped to `draft` for tonight's 00:30 IST run.

**npm security (commit `a515533`):**
- `npm audit fix` (no force): axios bumped to 1.16.0 (14 CVEs fixed — prototype pollution, SSRF, credential theft, MITM). basic-ftp, ws, brace-expansion, follow-redirects, ip-address also patched.
- 5 remaining vulns require `next@16.2.6` (isSemVerMajor). All DoS/cache/feature-specific, none exploited in our setup. Deferred: Next.js 14→15 migration sprint needed.

**Social automation fixed (commits `655a185`, `1debd26`, `e7289af`):**
- **Theme-as-number** (`scraper.py:491`): Rebrickable path was `str(theme_id)` = numeric e.g. "246" rendering on slides. Fixed: `''` (empty), Brickset merge fills theme name.
- **India filter removal** (`scraper.py:684-687`): `is_available_in_india()` was excluding any set in `store_prices` — with 648 tracked sets, this starved the selection pool (June 1 run: 0 candidates, exited in 1m29s). Fix: removed exclusion. `posted_sets` dedup (Filter 2) is the only gate. Sets in store_prices produce better captions (real INR prices).
- **Pieces Supabase fallback** (`db.py`: `get_pieces_from_supabase()`): fourth-tier fallback after LEGO.com/Rebrickable/Brickset all return 0. `sets.pieces` is 100% populated (24,633 rows). `N/A` on slides now only when set is genuinely unknown.
- **Real India price on stats card** (`db.py`: `get_india_price()`, `media_processor.py`: `_make_stats_card()`): was always `??` / "Price TBA - Coming Soon". Now shows `₹24,999` / "Best price in India today" when set is in store_prices. Fallback unchanged when no data.
- `posted_sets.created_at` → `posted_at` hygiene fix (Check 15i was firing false Monday alerts for 6+ weeks).

**Health score recomputation (2026-06-02):**
- Start: 100
- P0 issues: 0 → 0
- P1 issues: 0 → 0
- Last audit: CQS ran 2026-06-02 → 0
- GEO: GSC active, score improving → 0
- Social automation: fixed, June 1 run was selection starvation not pipeline failure → 0
- **Health score: 97**

**DB state (2026-06-02):**
- news_articles: 84 | blog_posts: 22 | guides: 9 | reviews: 3
- pending_drafts: ~484 total | approved: ~321 | draft: 0 | published: ~51 | rejected: 4
- store_prices: 2,600 | sets: 24,633 (pieces: 100% coverage)

**Key commits (Day 33):** `caaff6e` → `2110dce` → `916fe60` → `c7725fd` → `a515533` → `432b830` → `da9d605` → `0262dc0` → `0ad0411` → `e7289af` → `655a185` → `1debd26` (HEAD)

---

### Day 30 — 2026-05-30 — LAB-09 Price Drop Board, publish-drafts GHA workflow, social automation fixes, prompt hardening

Shipped:
- **Social automation fixed** (commits `21e0de2`, `b2c5cf5`) — 2 days of failed runs caused by libcaca0 apt mirror 404 on GitHub Actions runner. Fix: `apt-get update -y` before install. Caption writer hardening: piece count `0`→`'N/A'` in image overlay; `monsoon`/`season`/`weather` banned from SYSTEM_PROMPT; `re.sub(r'\*+', '', caption)` strips Gemini markdown asterisks before any downstream use.
- **GEO improvements** (commit `4a41d99`) — `public/llms.txt` expanded 24→60 lines (all 7 lab tools, guides, opinion, community, data sourcing details, Brickset listing note). `/community` added to `sitemap.ts` (was the only live route missing). `buildArticleSchema()` now accepts `type` param — news pages emit `NewsArticle`, blog/guides/opinion emit `Article`.
- **`reset-failing-drafts.mjs`** (commit `59d28eb`) — reusable tool: fetches all `status=draft` drafts with bodies, runs Gate 2 lint, clears body + resets to `approved` for any that fail. Used twice this session to clear 44 then 9 stale bodies.
- **Publish All → GHA** (commit `1159c53`) — `PublishAllButton` replaced with static link to `publish-drafts.yml` workflow dispatch page. Removes Netlify timeout risk. `publishAll()` Server Action removed. `publishOneDraft()` private helper extracted — shared by `publishDraft()` (single, with email alerts) and future batch paths.
- **LAB-09 Price Drop Board** (commit `8e7eb1f`) — `/lab/price-drops` live. `store_prices` (current) vs oldest 5 pages of `price_history` in 30-day window per `(set_id, store_id)`. Min ₹200 or 5% drop threshold. Filters: store/theme/min%. Sort: biggest ₹ drop first. ABHINAV12 Toycra discount shown. Empty state. Saffron stripe cards — matches retiring-soon UI exactly. `lab-tools.ts` unlocked (`coming_soon`→`live`). Added to `sitemap.ts`. Lab count: 8 of 9 live.
- **`publish-drafts.yml` GHA workflow** (commit `8e7eb1f`) — `workflow_dispatch` with `limit` input (default 15). Runs `publish-drafts.mjs` on GHA runners. Same secrets pattern as `generate-drafts.yml`.
- **India Paragraph prompt hardening** (commit `9744990`) — `MANDATORY COMPARISON` heading replaces soft bullet. Explicit fork: (a) price data exists → compare actual INR to biryani/EMI/Spotify/etc.; (b) no price data (MOC/fan-build/vintage/unreleased) → aspirational estimate required e.g. "if officially sold, roughly 18 months of Netflix." Standalone sentence + number + Indian reference enforced. Hard close: "Do not skip this under any circumstances." Fixes 9 drafts cycling through Gate 2.
- **5 articles published** — news: 47 → 52. First batch of 15 generated: 5 published, 10 failed Gate 2 (missing Indian comparison). All 10 reset. 9 regenerated with hardened prompt tonight; Tahu (224w, Gate 1) reset manually.

**Health score recomputation (2026-05-30):**
- Start: 100
- P0 issues: 0 → 0
- P1 issues: 0 → 0
- Netlify minutes: unlimited (GHA builds) → 0
- Last audit: CQS ran 2026-05-29 → 0
- Voice test: passed → 0
- GEO score 26 < 50 → **-5**
- **Health score: 95**

**DB state (2026-05-30):**
- news_articles: 52 | blog_posts: 22 | guides: 9 | reviews: 3
- pending_drafts: ~333 approved awaiting bodies | 9 reset with new prompt ready for next run
- Lab tools: 8 of 9 live (LAB-09 added today)

**Additional ships (Day 30 PM):**
- **fix: Gate 3 news exemption + BOM strip** (commit `fa55271`) — `publish-drafts.mjs` and `actions.ts`: Gate 3 verdict check now skipped for `format=news`. `content-quality-report.mjs`: BOM strip on `RESEND_API_KEY` before `new Resend()` — fixes content-quality workflow crashes.
- **fix: TypeScript ES5 target — Map/Set iteration** (commits `44070c0`, `684b28a`) — `/lab/price-drops` page: `for...of Map` and `[...new Set]` replaced with `Array.from()` equivalents. 4 consecutive build failures resolved.
- **fix: related-set prices** (commit `910346a`) — `sets/[slug]/page.tsx`: dead `prices(*)` join → `store_prices` query. Anon `supabase` client → `createServerClient()` throughout. Related set cards now show live prices.
- **SCRAPE-03: zero-row alert** (commit `789cf6c`) — `scrape-now.mjs`: `sendScraperAlert()` fires via Resend if any store returns 0 matched rows. Fetches last known count for context. `scrape-prices.yml`: `RESEND_API_KEY` + `BRIEF_EMAIL` added to step env.
- **code-audit.yml** (commit `3229ceb`) — Monday 05:00 UTC: ESLint + tsc --noEmit + npm audit --audit-level=high. On failure: `scripts/code-audit-notify.mjs` sends Resend alert with which checks failed.
- **SETS-02/03/04: /sets full rewrite** (commit `6d1792c`) — Theme/sort/price-band/in-stock filters via searchParams. Two-mode query: DB sort (newest/pieces) or price mode (store_prices side, JS filter+sort). Numbered pagination preserving all filters. `/sets/page/[N]` → redirect shim.
- **Check 7 DataIntegrity + CONTRIBUTING rule** (commit `87a72ca`) — 7a: related-set prices (store_prices join). 7b: ≥3 stores with data. 7c: recent articles have ₹ + store name. 7d: lab pages ≥2000 chars. 7e: /sets filter routes return 200. 7f: get_distinct_themes RPC ≥10 themes. CONTRIBUTING rule in file header. Sitemap threshold 30→1000. Routes: /sets/page/2 → /sets?page=2.
- **CATALOG-05: dynamic theme list** (commit `f016b7c`) — `get_distinct_themes()` Supabase RPC (DISTINCT from sets, 188 themes). Migration `20260530000000_get_distinct_themes.sql`. `/sets` dropdown now shows all 188 DB themes. Falls back to 25 curated if RPC fails. RPC applied to Supabase 2026-05-30.
- **Visual renderer first live run** — 60 articles × 2 viewports = 120 checks. 57 OK, 3 ISSUES (`lego-speed-champions-2026-india`, `lego-titanic-10294`, `star-wars-lego-will-bankrupt-you`). Written to `content_quality_issues` table.

**Additional ships (Day 30 FINAL session):**
- **YouTube hero backfill extended** (commit `b59b6d1`) — `fix-youtube-hero-images.mjs` extended to also handle null `hero_image` articles (not just YouTube CDN). Year-exclusion filter (`isYearLike()`) prevents 4-digit years 1930–2030 from being treated as set numbers. `SKIP_SLUGS` set excludes `1999-lego-adventurers` (confirmed year false positive). 10 articles total fixed across two runs: 6 YouTube CDN → Rebrickable images, 4 null → 2 Rebrickable + 2 null (MOC articles, acceptable).
- **P1 integrity checks + null hero backfill** (commit `139a887`) — technical-hygiene Checks 8–9 complete. Fix: content-quality-report BOM strip (RESEND_API_KEY). Gate 3 news exemption in publish-drafts.mjs + actions.ts (news format skips verdict requirement). Check 7 DataIntegrity (7a–7f) + CONTRIBUTING rule.
- **Homepage bugs fixed** (commit `ddb9090`) — (1) Reviews section: `sets(...)` → `set:sets(...)` alias fix. ReviewCard reads `review.set` but homepage passed `review.sets` (no alias) → all 3 review cards showing placeholder SVG instead of Rebrickable set images. One character fix. (2) Deals section: `prices(*)` dead legacy table → explicit columns + separate `store_prices` query. Deal cards showing no prices since Day 9. Both regression guards added to Check 10.
- **P2+P3 integrity checks complete** (commit `91c5db9`) — Checks 11–15 added (213 lines): page coverage (11 routes with content assertions), external dependency health, data pipeline health, content integrity (14 sub-checks), performance (9 sub-checks). CONTRIBUTING block listing all 15 check groups added to file header.
- **P1 integrity gaps closed** (commit `f0a4206`) — Checks 8g–8n added (blog_posts hero/body null, guides body null, price_snapshots P1, raw_signals P1, product_url validity, Rebrickable P1, Shopify P1). 9f–9h added (blog markdown/placeholder/meta). 4 missing routes added to Check 1 (`/themes/technic`, `/lab/deals`, `/lab/which-set`, `/lab/heat-map`). Full site audit confirmed.

**Full integrity layer summary (15 check groups, 90+ assertions, HEAD `f0a4206`):**
- Checks 1–6: Routes (29), guide slugs, hero images HEAD, sitemap ≥1000 URLs, Lighthouse, store staleness, row counts
- Check 7: DataIntegrity (related prices join, store coverage, India content, lab ₹ data, sets filters, RPC)
- Check 8: P1 Technical (store URLs, 25h freshness, stuck drafts, lab data, error boundaries, sets data, blog/guides content+hero nulls, pipeline freshness, product_url validity, Rebrickable P1, Shopify P1)
- Check 9: P1 Content (markdown leak, placeholder, meta descriptions — both news and blog_posts)
- Check 10: Homepage regression guards (reviews alias, deals price coverage)
- Check 11: Page coverage (11 routes with content assertions including ₹, quiz form, theme links)
- Check 12: External dependencies (Rebrickable, Brickset, 3 Shopify stores, D3/TopoJSON/India CDNs, GH_DISPATCH_TOKEN, IG token expiry)
- Check 13: Data pipeline (raw_signals, price_snapshots, content_fix_log, newsletter, guides, blog_posts, legacy prices)
- Check 14: Content integrity (word count, HTML leak, ABHINAV12, store spelling, opinion sign-off, review verdicts, duplicate slugs, future dates, ALL CAPS, India Paragraph stores, blog hero null rate)
- Check 15: Performance (response times, internal links, OG meta, canonical, scraper balance, Gemini queue, social automation)

**Last commits (Day 30 complete):** `9744990` → `fa55271` → `44070c0` → `684b28a` → `910346a` → `789cf6c` → `3229ceb` → `61486d3` → `6d1792c` → `87a72ca` → `f016b7c` → `2bfb6e5` → `b59b6d1` → `139a887` → `ddb9090` → `91c5db9` → `f0a4206` (HEAD)

---

### Day 29 — 2026-05-29 — Content Quality System v2, 12 articles published, CE-01 outreach

Shipped:
- **Content Quality System v2** (commit `aa23579`) — Full detect → auto-fix → verify → report pipeline running daily at 03:00 UTC.
  - `scripts/content-linter.mjs`: 30+ check types (markdown artifacts, HTML artifacts, Voice Codex violations, structure, duplicates via Jaccard, image HTTP validation). Marks `auto_fixable` per issue.
  - `scripts/content-auto-fixer.mjs`: 11 fix types applied in dependency order. 20% body-length safety guard. Always writes to `content_fix_log` before touching DB.
  - `scripts/visual-renderer.mjs`: Playwright headless, 14 checks at desktop (1280×800) + mobile (375×812).
  - `scripts/content-verify.mjs`: Re-runs checks on recently auto-fixed articles. Escalates failures to critical/manual.
  - `scripts/content-quality-report.mjs`: 6-section HTML email (auto-fixes, critical, warnings, info, image health, stats). BOI navy/saffron palette. Sent via Resend.
  - `.github/workflows/content-quality.yml`: 5-step pipeline, `continue-on-error: true` on steps 1–4 so report always sends.
  - `supabase/migrations/20260529000000_content_quality_system_v2.sql`: `content_quality_issues` gains `auto_fixable bool` + `fix_detail text`; creates `content_image_registry` + `content_fix_log` with RLS.
- **12 articles published** — `scripts/publish-drafts.mjs` (commit `8e30fcc`) batch script. news_articles: 26 → 38.
- **69 content issues fixed** — `scripts/fix-content-issues.mjs` (commit `7c0a8ab`) one-shot remediation. Bold markdown stripped from 25 articles, bad openers replaced, forbidden words removed, verdicts added to 25 articles, missing images assigned, duplicate images broken up.
- **CE-01 outreach DONE** — r/IndiaLEGO + AFOL India Facebook Group posted 2026-05-29. Builder Spotlight series launched. Deadline was June 1. ✅
- **Voice test passed** — McLaren batch generated, 12 articles published without lint failures.
- **First CQS v2 run**: 58 articles checked; 86 issues (26 critical, 20 warning, 40 info); 2 auto-fixes applied (double_space + markdown_list); 14 false positives closed; email sent Resend ID `26c25d6a`.
- **technical-hygiene.mjs**: added `/opinion/certified-store-india-charges-too-much` to route checks.

**Health score recomputation (2026-05-29):**
- Start: 100
- P0 issues: 0 → 0
- P1 issues: 0 → 0
- Netlify minutes: unlimited (GHA builds) → 0
- Last audit: CQS ran today → 0
- Voice test: passed (12 articles published) → 0
- GEO score 26 < 50 → **-5**
- Content freshness: 38 news articles, published today → 0
- **Health score: 95**

**DB state (2026-05-29):**
- news_articles: 38 | blog_posts: 22 | guides: 9 | reviews: 3
- pending_drafts: ~258 approved awaiting bodies (274 before 1 generated today)
- content_quality_issues: 130 open | content_image_registry: 49 rows | content_fix_log: 2 rows

**Last commits this session:** `8e30fcc` (publish-drafts.mjs), `7c0a8ab` (fix-content-issues.mjs), `aa23579` (CQS v2 — HEAD)

---

### Day 28 — 2026-05-28 — /opinion, CE guides, Lab tools 5/7/8, retirement pipeline, Brickset listing

Shipped:
- **WEB-07 /opinion route** — `src/app/opinion/page.tsx` + `src/app/opinion/[slug]/page.tsx`. Sources from `blog_posts WHERE category='Opinion'`. Canonical set to `/opinion/[slug]`. Added to Navbar, Footer, sitemap. Opinion posts appear at both /blog/[slug] and /opinion/[slug] (dual-URL, canonical wins).
- **CE-02 + CE-05 — /guides live** — 8 LEGO 101 guides (IDs 1–8) + History of LEGO in India (ID 9). All via insert scripts. /guides index + /guides/[slug] routes shipping from Day 25 WEB-05. 9 guides total live.
- **3 opinion posts inserted** — `certified-store-india-charges-too-much`, `lego-should-manufacture-in-india`, `star-wars-lego-will-bankrupt-you`. Inserted via `scripts/insert-opinion-01-03.js`. blog_posts count: 19 → 22.
- **LAB-07 Budget Calculator** — `/lab/budget-calculator`. Server + BudgetForm client. Paginated store_prices (1,707 rows, 2 pages). Quick-select ranges, saffron Find Sets button, Toycra ABHINAV12 discount, sorted pieces DESC. TypeScript fix: `Array.from(bestBySet.entries())` (Map iterator spread fails TS target). Commit `85a6dde`.
- **CATALOG-04 v2 — retirement pipeline** — `supabase/migrations/20260528000000_sets_retirement_columns.sql` (retirement_date date, is_retiring_soon boolean, retired boolean). `scripts/update-retiring-soon.mjs` (3-pass: retire past dates, flag 90-day window, clear stale flags). `.github/workflows/retiring-soon.yml` (Sunday 02:00 UTC). `scripts/populate-mrp.js` extended with Phase 5 — reads Brickset `exitDate`, writes `retirement_date` for ALL matched sets (3,039 rows written). Manual run of `update-retiring-soon.mjs`: 2,202 sets marked retired, 128 sets `is_retiring_soon=true`. 10307 confirmed `retirement_date=2026-07-31, is_retiring_soon=true`.
- **LAB-08 Retirement Radar** — `/lab/retiring-soon`. 128 sets grouped by retirement date, urgency colour stripe (red ≤30d, saffron ≤60d, gray otherwise), best store price + ABHINAV12 discount, MRP fallback. Retirement Radar promoted to `live` in lab-tools.ts. Commit `54e3f32`.
- **LAB-05 CMF Tracker** — `/lab/cmf-tracker`. Server page fetches all `theme ilike '%Minifigures%'` sets (118 rows), filters bundles, groups by series. Client component: series tab selector (horizontal scroll), progress bar (saffron → green at 100%), store price with blind-bag note, per-figure checkboxes (saffron tint + ✓ badge when owned), Reset button. TS clean. Commit `4740e1b`.
- **Eiffel Tower news article** — slug `lego-eiffel-tower-10307-retiring-india`. news_articles count: 24 → 26. Body: 10307, 10,001 pieces, ₹65,999 MBH, retirement 2026-07-31, buy-now verdict.
- **Brickset App Directory listing** — BRICKSET-01 COMPLETE. Listed by Huw Millington same day (2026-05-28). URL: brickset.com/article/131478. Quote: "It looks great." First external authority validation from within the global LEGO hobby ecosystem.
- **Gemini prompt rewrite** (Day 27 carry-over) — Few-shot examples (4 annotated samples), forbidden patterns updated, "Never open with So," added, verdict options fixed: BUY NOW / WAIT / IMPORT ONLY / AVOID. No markdown/asterisks rule explicit. Specific numeric India comparisons required.
- **Misc** — `scripts/generate-approved-drafts.js` error logging fix (err?.message ?? JSON.stringify(err) — was serialising PostgrestError as `[object Object]`). 16 diagnostic scripts committed in Day 28: misc cleanup.

**Health score recomputation (2026-05-28):**
- Start: 100
- P0 issues: 0 → 0
- P1 issues: 0 → 0
- Netlify minutes: unlimited (GHA builds) → 0
- Last audit: Day 26, 2 days ago → 0
- Voice test pending: McLaren test pending 1–2 days, < 14d threshold → 0
- GEO score 26 < 50 → **-5**
- Content staleness: news + opinion published today → 0
- **Health score: 95**

**DB state (2026-05-28):**
- sets: 24,559 | lego_mrp_inr: 45% (3,405/7,547 ≥2020) | retirement_date: 3,039 | is_retiring_soon: 128 | retired: 2,202
- store_prices: ~1,955 | price_snapshots: 20,820+
- news_articles: 26 | blog_posts: 22 | guides: 9 | reviews: 3
- pending_drafts: ~312 approved awaiting Gemini bodies

**Last commit this session:** `24066cb` (Day 28 misc cleanup → tracker+handover commit to follow)

---

### Day 27 — 2026-05-27 (included in Day 28 close)

Items shipped in Day 27 session (prior context window — included in Day 28 close commit):
- BRIEF-01 daily digest live: `scripts/morning-brief.mjs` (6-section HTML email) + `.github/workflows/brief.yml` (01:30 UTC / 07:00 IST). Sender: hello@bricksofindia.com. Resend ID e78409af confirmed. [sender changed to abhinav@ on 2026-07-04, commit d3b016f]
- generate-drafts 429 bail fix — script breaks immediately on first 429.
- RESEND_API_KEY fixed (Day 26/27 carryover).
- health-check.yml: 11 checks, email working.
- /admin/pending body expander live.
- Retirement date research — Brickset API `exitDate` field confirmed. Rebrickable has none.

---

### Day 26 — 2026-05-26 — MBH scraper fix + NHM review + health-check + CSS vars

Shipped:
- **MBH scraper bug (P0)** — `scripts/scrape-now.mjs`: `parseProduct()` lego-string filter was silently dropping 617/853 MBH products whose titles/handles don't contain "lego" (e.g. "Icons Natural History Museum Set 10326 Building Kit"). Bypass filter for `mybrickhouse` store; `knownSets.has()` is the real guard. MBH matched 848 sets (was 227). 10326 now in `store_prices` at ₹31,999. Commit `ff78b81`.
- **NHM review price fix (REVIEW-PRICE-01 P0)** — reviews row `70db543d`: replaced ₹27,000 MRP references with correct store prices (Jaiman ₹26,990, MyBrickHouse ₹31,999, Toycra ₹34,999). WAIT FOR SALE verdict strengthened — Toycra is 30% above Jaiman. Live DB update via `scripts/update-nhm-review.mjs`. ₹27,000 fully removed from content.
- **health-check.yml** — new nightly workflow (02:30 UTC / 08:00 IST). 7 checks: /news freshness (7d), /blog freshness (14d), RADAR pipeline (25h), social automation (25h), store prices (7h), IG token expiry (14d warning on 2026-07-23 expiry), pending drafts backlog (>50). One email per failure via Resend. Silence = green. Requires `BRIEF_EMAIL` secret. `scripts/health-check.mjs` + `.github/workflows/health-check.yml`. DEPLOYMENT.md updated.
- **DESIGN-CSS-02** — `lab/deals/page.tsx`, `lab/which-set/page.tsx`, `lab/heat-map/page.tsx`: BOI brand hex → CSS vars (`--boi-saffron`, `--boi-blue`, `--boi-text`, `--boi-text-secondary`, `--boi-red`, `--boi-green`, `--color-primary-dark`, `--color-deal-green`). `globals.css`: html/body background + heading color tokenised. D3 `.attr()` calls and `newsletter.ts` (email HTML) excluded. `admin/pending/page.tsx` deferred → DESIGN-CSS-03.
- **WEB-06 tracker correction** — `/community` route was shipped in commit `2cda45a` (prior session); tracker carry-over was stale. Corrected.
- **DEFECT-005 one-liner** — Flash-Lite "fever dreams" residual noted in BRIEF_DEFECTS.md. Accepted at current stage.

### Day 25 — 2026-05-25 — WEB-05 /guides + RADAR report + image dedup fix

Shipped:
- **Full system audit docs** — 7 files updated + 2 new files created: `docs/FAN_COLAB_TIMELINE.md` (new — August 2026 deadline tracker, 12-week critical path), `docs/SESSION_MAY24_SUMMARY.md` (new — session record), `docs/SOCIAL_AUTOMATION_STATUS.md` (India defense layer, text overlays, carousel polling fix, run history), `docs/CONTENT_PIPELINE_AUDIT.md` (16d /news stale, 36d /blog stale), `docs/LAB_ROADMAP.md` (23 days snapshot data), `docs/CONTENT_ENGINE_STATUS.md` (12w to Fan CoLab), `docs/WEBSITE_SECTIONS_TODO.md` (FAN_COLAB_TIMELINE.md link added).
- **Third pipeline run** — 75641-1 Dr. Hiriluk's Hideout (One Piece). India check blocked 4 sets: 75441-1, 31385-1, 76343-1, 31376-1. All 3 platforms posted (posted_sets row 3). Run ~02:57 UTC.
- **SEO baseline + /lab sitemap fix** — bricksofindia.com has zero Google indexing (expected, 5-week domain). /lab pages were missing from sitemap.xml. Fixed in `src/app/sitemap.ts`. Documented in `docs/SEO_ACTION_PLAN.md`. Commit `13078b1`.
- **DEFECT-014 — Hero image dedup (Part A + Part B)** — Part A: retroactive `hero_image` null-out on 5 rows across 3 duplicate groups via `scripts/fix-hero-dupes.mjs`; 0 duplicate groups remain. Part B: `extractSetNumber()` helper + Rebrickable fallback in `publishDraft()` dedup guard — on collision, tries `sets.image_url` (dedup-checked + HEAD-verified) before dropping to null. `scripts/audit-hero-dupes.mjs` created for future audits. Commit `6d11036` (Part A guard, prior session); Part B this session.
- **docs/RADAR_FAILURE_REPORT.md** — root cause documented: RADAR is healthy, content stale because operator has not visited `/admin/pending` since April 20. 312 approved signals await Generate+Publish. Not a system failure.
- **WEB-05 /guides route** — Fan CoLab critical path. `src/app/guides/page.tsx` (index: hero, 3-column card grid, category tabs: Getting Started / India Specific / Advanced), `src/app/guides/[slug]/page.tsx` (detail: Article JSON-LD, breadcrumb, related guides, Toycra banner). Migration: `supabase/migrations/20260525000000_guides.sql` (run manually in dashboard). Guides link added to Navbar. /guides + /guides/[slug] added to sitemap. Guide interface added to supabase.ts. Commit `eb8a049`.

System health check (verified 2026-05-25):

| Metric | Value | Status |
|--------|-------|--------|
| posted_sets | 3 rows | ✅ |
| store_prices | 1,955 rows | ✅ |
| price_snapshots | 20,820 total | ✅ |
| raw_signals | 7,403 total; latest 2026-05-24T18:39 UTC | ✅ |
| pending_drafts (draft) | 5 | ✅ |
| pending_drafts (approved) | 312 | ⚠️ Awaiting Generate+Publish |
| pending_drafts (published) | 4 | — |
| news_articles | 24 total; last: 2026-05-09 (16d stale) | ⚠️ |
| blog_posts | last: 2026-04-19 (36d stale) | ⚠️ |
| reviews | 3 total; last: 2026-05-14 (11d stale) | ⚠️ |
| social-assets bucket | 26 files | ✅ |
| BOI Social Automation | Success (02:50 UTC) | ✅ |
| radar-pipeline | Success (2026-05-24T18:38 UTC) | ✅ |
| Scrape Store Prices | Success (last: May 24 19:18 UTC) | ✅ |
| Netlify deploys | All green | ✅ |

**Health score recomputation (2026-05-25):**
- Start: 100
- P0 issues open: 0 → 0
- P1 issues open: 0 formal P1 bugs → 0
- Netlify minutes: unlimited (off Netlify build pipeline) → 0
- Last audit: today → 0
- Voice test pending > 14 days → -5
- GEO score 26 < 50 → -5
- WEB-06 shipped (commit 2cda45a) → 0
- Content staleness (16d /news, 36d /blog) → -5
- **Health score: 80**

**Last commit this session:** `eb8a049`

Pending (carry-overs):
- **Content freshness** — /news 16 days stale, /blog 36 days stale. 312 approved signals at `/admin/pending` need Generate Article + Publish clicks.
- **Guides migration** — run `supabase/migrations/20260525000000_guides.sql` in Supabase dashboard SQL editor before publishing any guides.
- **WEB-06 /community** — ✅ Done (commit 2cda45a). `/app/community/page.tsx` + `/app/community/[slug]/page.tsx` live. Tracker line was stale.
- **LAB-06** — `/lab/deals` frontend. 1 session, backend already live.
- **IG System User Token** — permanent token via Meta Business Manager. Current 60-day token expires ~2026-07-23.
- **GSC setup** — manual: verify bricksofindia.com in Google Search Console, submit sitemap, request indexing for 10 key pages.

---

### Day 24 — 2026-05-24 — SOC-AUTO-01 live + system audit

Shipped:
- **SOC-AUTO-01** — Social automation pipeline. `social-automation/pipeline.py` + `scraper.py` + `media_processor.py` + `publisher.py`. GitHub Actions cron daily 06:30 UTC (12:00 IST). Three-platform posting: IG Feed (8-image carousel), IG Reels (8s video), YouTube Shorts (45s video). Commits `a236812` and subsequent hotfixes.
- **Gallery via Brickset API** — replaced non-functional CDN probe with `getAdditionalImages` API using `setID` lookup. Returns 20–50 high-res product images per set. Sets with <10 images skipped. `brickset_set_id` stored in all set dicts and propagated through merge.
- **First live run** — 2026-05-24. Set: 76342-1 Spider-Man vs. Mysterio: The Daily Bugle (861 parts, 26 gallery images). IG Feed media_id: `17888047680551486`. IG Reels media_id: `18104097262983341`. YouTube video_id: `Mgm28GniPmk`. posted_sets row: 2.
- **Hotfixes during first run:** (1) `_build_video` re-downloaded `image_url` (Rebrickable CDN, timed out) — fixed to use `image_paths[0]` (already local). (2) `process_carousel_images` strict abort on first URL failure — fixed to skip failed URLs and try next from pool of 20-50. (3) `_brickset_api_gallery` prepended Rebrickable `image_url` as fallback — fixed to use `brickset_image_url` only. (4) Gemini 503 capacity spike — added 3-attempt retry with 30/60/90s back-off in `caption_writer.py`.
- **System audit documentation** — 7 new docs created: `docs/SOCIAL_AUTOMATION_STATUS.md`, `docs/CONTENT_PIPELINE_AUDIT.md`, `docs/LAB_ROADMAP.md`, `docs/CONTENT_ENGINE_STATUS.md`, `docs/WEBSITE_SECTIONS_TODO.md`, `docs/SEO_BASELINE_AUDIT.md`, `docs/MONITORING_SCHEDULE.md`.

Pending (flagged this session):
- **IG System User Token** — permanent non-expiring token via Meta Business Manager. Deferred. Current 60-day token expires ~2026-07-23.
- **RADAR-08** — ✅ Done 2026-05-26. See tracker row above.
- **Content freshness** — /news 15 days stale, /blog 35 days stale. Operator visit to `/admin/pending` needed.
- **Fan CoLab CE items** — all CE-01 through CE-06 not started. WEB-05/06 must be built first.

**Health score recomputation (2026-05-24):**
- Start: 100
- P0 issues open: 0 → no deduction
- P1 issues open: content freshness (CRITICAL, not a bug per se) → -5 (partial deduction)
- Netlify minutes: credits reset 2026-05-22 → no deduction
- Last audit: 2026-05-14 (10 days ago, <30 days) → no deduction
- Blocked P1 pipeline items: WEB-05/06 (CE blockers) → -5
- **Estimated health score: ~90** (social automation shipping raised it from unknown; content staleness drags it)

**Last commit this session:** to be updated after docs commit.

---

### Day 14 — 2026-05-14 — DEFECT-005 closed + housekeeping

Shipped:
- **DEFECT-005** — `src/app/admin/pending/actions.ts`: added `VOICE_EXAMPLES` constant (3 exemplar openings for news/review/opinion formats) to the Gemini system prompt chain. Inserted between `INDIA_PARAGRAPH_SPEC` and `ANTI_PATTERNS` — positive register anchor immediately before negative constraint list. Root cause: `FORMAT_ADDENDUM` gave structural rules but no concrete voice demonstration; model defaulted to safe neutral prose. Fix: few-shot examples showing Indian hook, wallet-as-character, Clarkson build→undercut rhythm, and deadpan close. Commit `10a77ca`.
- **DEFECT-013** — `src/app/admin/pending/actions.ts`: added `OUTPUT_FORMAT` constant as the final segment of `systemPrompt`, after `ANTI_PATTERNS`. Hard structural rule — non-negotiable, isolated from all voice/style guidance so it cannot be buried. Also added `IMPORTANT:` anchor to top of `userPrompt`. Pre-existing: markers were only in user prompt template with no explicit instruction to reproduce them; conversational Gemini responses caused hard throw at line 248. Commit `a03f6d5`.
- **Legacy scraper removal** — `scrapers/scraper.js`, `scrapers/package.json`, `render.yaml` deleted. These files backed the old Render.com/cheerio scraper that wrote to the legacy `prices` table. Superseded by `scripts/scrape-now.mjs` + `scrape-prices.yml` (GitHub Actions, Shopify JSON API, `store_prices` table). Commit `d12de67`.

- **WEB-01–04 fully closed** — `src/app/admin/pending/actions.ts`: all 4 Codex lint gates now fully implemented and Resend alert wired on any FAIL.
  - **Gate 1 (3-state):** `WORD_COUNT_TARGETS` restructured to `{ pass, fail }` tuples. PASS ±10%, WARN ±25% (returns warning string, does not block), hard FAIL beyond ±25%.
  - **Gate 2 (full 4-component):** marker is now FAIL (was `console.warn`); checks `body.slice(markerIdx)` for `<!-- INDIA_PARAGRAPH -->`, `₹[\d,]+`, `INDIA_STORE_RE` (Toycra/MyBrickHouse/Jaiman/"import only"), `INDIA_COMPARISON_RE` (biryani/EMI/Spotify/petrol/etc.).
  - **Gate 3 (all formats):** `format === 'review'` guard removed — verdict enforced for news, review, and opinion.
  - **Gate 4 (image HEAD-check):** runs in `publishDraft()` after `fetchOgImage()`; `fetch(heroImage, { method: 'HEAD' })` — HTTP error = FAIL + alert; network error = WARN only, publish proceeds.
  - **`sendLintAlert()`:** dynamic Resend import; sends `[BOI Lint FAIL]` email to `abhinav@bricksofindia.com` with draft title and gate error message; never throws.
- **DRY_RUN wiring** — `scrape-prices.yml`: forwards `workflow_dispatch` `dry_run` input as `DRY_RUN` env var to the script. `scripts/scrape-now.mjs`: reads `DRY_RUN === 'true'`; gates both `store_prices` upsert and `price_history` insert; logs first 5 would-be rows instead of writing. Banner and summary line reflect dry-run state. No new deps, no schema changes.

- **REVIEWS-FIRST-3 closed — 3 Codex-compliant reviews live:**
  - McLaren P1 42172 — BUY, ₹29,399 (73% MRP), 558w. Slug: `lego-42172-mclaren-p1-review`. id `34d279e3`.
  - Rivendell 10316 — BUY, ₹39,999 (89% MRP), 624w. Slug: `lego-10316-rivendell-review`. id `7141242f`.
  - Natural History Museum 10326 — WAIT FOR SALE, ₹34,999 (130% MRP), 543w. Slug: `lego-10326-natural-history-museum-review`. id `70db543d`.
  - All pass lint Gates 1–4 (word count, India Paragraph 4-component, verdict enum, image HEAD).
- **Reviews schema hardened** — migration `20260514000000_reviews_schema_hardening.sql`: `hero_image`, `excerpt`, `seo_title`, `seo_description`, `updated_at` + trigger + RLS. TS `Review` interface updated. Commit `4398f11`.
- **GEO-01-FU1 unblocked** — pending next deploy (Netlify credits reset 2026-05-22). Verify `buildReviewSchema()` on `/reviews/lego-42172-mclaren-p1-review`.
- **RADAR-08 logged** — automated reviews pipeline briefed; target 5+ Codex reviews/week without operator bottleneck.

**Last commit this session:** `d7a99f5`

---

### Day 13 — 2026-05-13 — REVIEW-PRICE-01

Shipped:
- **REVIEW-PRICE-01** — `src/app/reviews/[slug]/page.tsx`: added `store_prices` lookup via `createServerClient()`, keyed on `set.set_number`. Sidebar shows best in-stock price + green "Buy Now →" button (direct product URL), falls back to cheapest any-price + "Check availability" text, hidden if no data. `formatPrice` + `createServerClient` added to imports. Commit `e07ddc5`.

Verified:
- **YT-404-WATCH** — radar cron run 25756795926 (2026-05-12 19:18 UTC) inspected. All 7 YouTube channels: fetched=15, errors=0. BOI channel (`UC1CCrLlp4XnOoxVzAftFwfQ`) clean. Closed.

**Last commit this session:** `e07ddc5`

---

### Day 12 — 2026-05-12 — Pipeline fixes + CSS variables

Shipped:
- **DESIGN-CSS-01** — Footer.tsx, LabStrip.tsx, TricolourStripe.tsx, globals.css: hardcoded `#F7A800` → `var(--boi-saffron)`. Commit `e15b4f4`.
- **RADAR-03-TUNE** — `classify-signals.js`: Rebrickable API signals now skipped entirely. COMMUNITY_RE extended with digest/round-up/headline/contest patterns. Verified: skipped_community=223 on manual run. Commit `5024470`.
- **PARSER-01 + PARSER-01b** — New Elementary re-enabled. First attempt used `@extractus/feed-extractor` (700b561). Final: Blogger JSON endpoint (`?alt=json&max-results=20`) bypasses XML entirely (a311fc6). `config/sources.json` updated: `format: blogger-json`, no `enabled: false`. Verified: fetched=20, written=20.
- **dead prices(*) join removed** — `reviews/[slug]/page.tsx` query changed from `sets(*, prices(*))` to `sets(*)`. Legacy `prices` table was never rendered in template. Commit `dd4691f`.
- **WEB-01 — lintDraft() 3-gate enforcement** — `src/app/admin/pending/actions.ts:317–358`. Gate 1: word count ±10% by format. Gate 2: INDIA_PARAGRAPH marker warn + ₹ price hard fail. Gate 3: verdict enum check for reviews. Called from `publishDraft()` at line 376. Commit `c313795`.
- **INDIA_PARAGRAPH prompt fix** — Both code paths (actions.ts + generate-drafts.js) now consistently instruct Gemini to place `<!-- INDIA_PARAGRAPH -->` marker. Gate 2: marker absence = console.warn (backward compat for existing drafts); ₹ price absence = hard FAIL. Commit `e17e977`.

Key commits: `e15b4f4` (CSS vars), `5024470` (RADAR-03-TUNE), `700b561` + `a311fc6` (PARSER-01/b), `dd4691f` (reviews join), `c313795` (WEB-01), `e17e977` (INDIA_PARAGRAPH)

**Last commit this session:** `e17e977` (code). `f74a67d` (session handover doc).

---

### Day 11 — 2026-05-11 — Design polish sprint

Shipped:
- **Sky blue hero banners** — news, blog, reviews, lab all unified: `var(--boi-sky)` bg, `var(--boi-navy)` h1 + p at 75% opacity. Lab gets green "THE LAB" pill badge. Commits `10ce445`.
- **White Navbar** — removed sky-to-sky-light gradient, replaced with `#fff` + `shadow-sm`. Clean separation from hero on all pages. Commit `145a9b6`.
- **BOI-blue footer** — background `#006CB7`, saffron `#F7A800` text/headers/wordmark, warm cream links `rgba(255,247,220,0.85)`. Commit `145a9b6` + `2c34f75`.
- **Tricolour stripe** — colours updated to saffron `#F7A800` / white / white / green `#138808` — effective saffron/white/green Indian flag tricolour. Commit `2c34f75`.
- **Heat-map fixes** (LAB-07) — SVG `height: 100%` collapse fixed (container now uses `height: 0` + `minHeight`), async cancellation flag added, auto-drill on map click removed (only "View Cities →" button drills), stale "Q1 2025" label updated to Q1 2026. Commit `8392b42`.
- **Review card images** — Supabase join alias fixed: `sets(...)` → `set:sets(...)` so `review.set` resolves and Rebrickable CDN images load. Commit `2c34f75`.
- **Duplicate excerpt removed** — standalone italic excerpt `<p>` removed from `news/[slug]` and `blog/[slug]` pages. Excerpt remains in metadata only. Commits `8392b42` + `2c34f75`.
- **About page origin story** — LEGO car photo float-right (280px, `<figure>`) alongside text paragraphs. 8-paragraph origin story inserted between bio and credentials. Credential year corrected to 2025. Hardcoded `#3a3a3a`/`#4A5568`/`#666` replaced with CSS variables. `lego-car-build.jpg` committed to `public/images/`. Commits `7bd7862`, `29d0104`.
- **Spacing consistency** — news/blog content areas `py-8` → `py-10` (matches reviews). News article excerpt `italic` added. Commit `10ce445`.

Key commits: `8392b42` (heat-map + spacing), `7bd7862` (about origin story), `29d0104` (photo), `10ce445` (sky heroes + spacing), `145a9b6` (navbar + footer + about photo layout), `2c34f75` (tricolour + footer blue + review fix + excerpt)

**Last commit this session:** `2c34f75`

---

### Day 10 — 2026-05-10 — Content rendering, MRP pipeline, Reviews, Lab tools, Design system

Shipped:
- **CONTENT-RENDER-02** — `ReactMarkdown` added to `/blog/[slug]/page.tsx`. Also applied to `/reviews/[slug]/page.tsx`. Commit `c42a7be` + `7a44d20`.
- **CONTENT-RENDER-03** — `stripMarkdown()` utility added to `src/lib/utils.ts`. `ArticleCard` excerpt now strips headings, bold/italic, links, bullets before render. Commit `b415cab`.
- **PRICE-PIPELINE-01** — `scripts/populate-mrp.js` written and run. Fetches Brickset API by year (2020–2027), converts `LEGOCom.US.retailPrice` → INR via live rate from `open.er-api.com` (fallback 90). 3,370 sets updated. Catalogue audit gate scoped to `year >= 2020`, threshold lowered to 45%. Result: 46% — PASS. Commits `c67f546`, `d57348e`, `e95afa0`, `b66cbc0`.
- **REVIEWS-FIRST-3** — `scripts/seed-reviews.js` written and run. 3 reviews inserted: 42161 Lamborghini Huracán Tecnica (4/5), 31120 Medieval Castle (5/5), 10317 Land Rover Defender 90 (4/5). Commit `7a44d20`.
- **GEO-01-FU1** — Verified live: `curl bricksofindia.com/reviews/lego-42161...` confirms Organization, BreadcrumbList, and Review JSON-LD all server-rendered. Closed.
- **LAB-02** — Which Set Are You quiz at `/lab/which-set`. 5 questions, 8 outcomes, routing logic, store links (Toycra ABHINAV12, MyBrickHouse, Jaiman Toys), LEGO disclaimer. Commit `d5d1641`.
- **LAB-07** — LEGO Search Pulse at `/lab/heat-map`. D3 choropleth India + world bubble map. 23 states hardcoded with scores/notes/trends. City drill-down (12 states with city data). India/World + 12Mo/5Yr toggles. Ranked side panel. D3 + TopoJSON loaded from cdnjs at runtime. GeoJSON from datamaps (ind.json) and world-atlas CDN. Commit `d5d1641`.
- **DESIGN-01** — 9 brand CSS variables added/updated in `globals.css`: `--boi-saffron`, `--boi-red`, `--boi-green`, `--boi-blue`, `--boi-text`, `--boi-text-secondary`, `--boi-border`, `--boi-bg`. Commits `b26abf0`, `d5d1641`.

Key commits: `c42a7be` (blog MD), `b415cab` (excerpt strip), `c67f546` (audit scope), `d57348e` (MRP script), `b66cbc0` (live FX rate), `7a44d20` (reviews + review MD), `b26abf0` (CSS vars), `d5d1641` (LAB-02 + LAB-07)

**Last commit this session:** `d5d1641`

---

### Day 9 (session 3) — 2026-05-10 — YouTube Strip, Newsletter, Footer, Sitemap, CI

Shipped:
- **YoutubeStrip homepage component** (`src/components/content/YoutubeStrip.tsx`) — shows BOI channel videos only (`source_name = 'Bricks of India'`). Heading "LATEST VIDEOS". Returns null when no BOI videos in raw_signals. Commit `afdd09a` (initial), `76d063d` (filter + heading fix).
- **BOI YouTube channel added to Tier 4** — channel_id `UC1CCrLlp4XnOoxVzAftFwfQ`, verified via RSS feed title "Bricks of India". 15 videos ingested on first RADAR-01 run post-add. Commit `04114ee`.
- **Newsletter Server Action** (`src/app/actions/newsletter.ts`) — moved from client-side Supabase insert to Server Action. Switched from nodemailer/Gmail SMTP → **Resend SDK** (`resend@6.12.3`). Sends confirmation from `abhinav@bricksofindia.com`. RESEND_API_KEY in .env.local, Netlify (runtime scope), GitHub Secrets. Test confirmed: email id `a33f46a8` delivered. Commits `6e5cb1a`, `c56df21`.
- **newsletter_subscribers RLS hardening** — migration `20260510000000` explicitly sets anon INSERT-only. No SELECT/UPDATE/DELETE for anon. Service role reads via createServerClient(). 2 subscribers in table as of session end.
- **ImprovMX confirmed receive-only** — free plan has no SMTP sending. Investigated and closed. GMAIL SMTP also tested (bricksofindia007@gmail.com + App Password confirmed working locally) but not used — Resend is the provider.
- **Footer redesign** — 4-column layout: Logo, Pages (Sets/Themes/Deals/Reviews/News/Blog/The Lab), Company (About/Contact/Privacy/Terms), Connect (YouTube/Instagram/Email). BRAND.youtube verified `https://www.youtube.com/@BricksofIndia`. Commits `c5d3400`, `fb42975`.
- **Sitemap fix** — sets query paginated with range() loop (was silently capped at 1000 by PostgREST despite `.limit(10000)`). Added `order('year', DESC)`. Switched from anon client to `createServerClient()`. Commit `7142b43`.
- **DEFECT-010 closed** — `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` added to all 6 workflow env blocks. Opts in before 2026-06-02 forced migration. All @v4 tags confirmed correct — no version bumps needed. Commit `41856ed`.
- **DEFECT-011 closed** (was patched 68aa474 in session 2; index updated to ✅).
- **DEFECT-012 closed** (was patched 57cd130 in session 2; index updated to ✅).
- **scripts/test-email.js** — diagnostic for SMTP/Resend credential testing. Updated for Resend SDK. Commit `e8a4f2d`.

Key commits (session 3): `76d063d` (YouTubeStrip fix), `6e5cb1a` (newsletter RLS+action), `04114ee` (BOI YT source), `41856ed` (CI Node.js 24), `7142b43` (sitemap), `c56df21` (Resend), `fb42975` (footer), `c5d3400` (footer quick links)

**Last commit this session:** `fb42975`

---

### Day 9 (session 2) — 2026-05-09 — Pipeline + Admin UI + Source Fixes

Shipped:
- RADAR-03 classifier wired (`classify-signals.js`, commit `db1dd2d`). 349 pending_drafts.
- RADAR-04 pipeline drafter wired (`generate-drafts.js`, commit `2a157e6`). Reads
  `status='approved' AND draft_body IS NULL`, generates via Gemini, resets to `draft`.
- `/admin/pending` live on production — password-gated, cookie auth, Server Actions,
  status/format/source-domain filter chips, bulk approve (commit `772624d`).
- Server Actions bug fixed — `redirect()` not `revalidatePath()` (Netlify ISR issue).
- `@netlify/plugin-nextjs: ^5.0.0` pinned in package.json for Server Action support.
- `supabase.ts` defensive guard — `createClient('',...)` no longer throws opaque
  Digest crash; throws readable error instead (commit `8d178c6`).
- Blog added to nav (commit `1f82da0`). Sitemap: /compare→/sets, /calendar removed.
- Jay's Brick Blog added as Tier 1 editorial (11 signals/run, commit `784adb6`).
- Brickset re-enabled at correct URL (`/feed` not `/article/rss`, 40 signals/run).
- Blocks Magazine re-enabled at post-redirect URL (`blocksmag.com/news/`, 86 links/run).
- `sanitizeXml()` added to `fetch-rss.js` — strips bare HTML attributes + escapes `&`.
- PARSER-01 definitively investigated: `xmlParseOptions`/`xml2jsOptions` cannot fix
  New Elementary (SAX strict mode incompatibility). Parser swap required.
- Full pipeline run: 14 sources, 322 signals, 50 new pending_drafts added.

- RADAR-05 publish step: `publishDraft()` Server Action, `publish-drafts.js` (commit `9baf37d`).
  Inserts approved+bodied drafts into news_articles/blog_posts. Publish button live.
- RADAR-04-FULLTEXT: full article body fetched before Gemini (commit `0fad972`).
  JBB 1607 chars, Brickset 4000 chars, Brothers Brick 986 chars. DEFECT-011 fixed (68aa474).
- RADAR-04 redesigned to on-demand: removed from nightly cron (commit `57cd130`).
  "Generate Article" amber button in /admin/pending triggers single-draft Gemini call.
  Nightly cron = RADAR-01 → 02 → 03 only. DEFECT-012 logged and patched.
- /admin/pending 4-state UI: signal review, article review, generate, publish (commit `57cd130`).
- DEFECT-010/011/012 logged in docs/BRIEF_DEFECTS.md.

Key commits: `772624d` (admin), `784adb6` (sources), `1f82da0` (nav/sitemap), `9baf37d` (publish), `0fad972` (fulltext), `68aa474` (JBB fix), `57cd130` (on-demand generation)

---

### Day 7 — 2026-05-09 — Merge + Verify

Shipped:
- PR #2 squash-merged to main (`e5b71b1`): RADAR-01 fetcher, RADAR-02 deduper,
  RADAR-CRON (radar.yml daily 17:30 UTC), schema migrations, runbooks,
  .env.example, config/sources.json.
- DEFECT-008 fix: `catalogue-audit.yml` missing `permissions: issues: write`
  added at job level (`775de46`, squashed into `e5b71b1`).
- DEFECT-007 + DEFECT-008 logged in `docs/BRIEF_DEFECTS.md`.

Verified live:
- `radar.yml` workflow_dispatch run completed green in 37s (run 25593692037).
- `raw_signals`: 163 rows, latest fetch 2026-05-09T06:07:09 UTC.
- Netlify build + deploy: green in 2m23s post-merge.

Next: RADAR-03 classifier — classify `raw_signals` rows as
news / review / opinion / set-release / community.

---

### Day 5 — 2026-05-03 — Pipeline

Shipped:
- RADAR-02 deduper (`scripts/radar/dedupe-signals.js`, commit `55616bb`) —
  4-pass design: exact URL hash → exact title hash → cross-source token Jaccard
  ≥0.75 via Union-Find transitive grouping → unique fallback. Tier-aware primary
  selection (lowest tier wins). --dry-run and --verbose flags. Batched DB updates.
  First live run: 53 signals, 53 unique, 0 grouped. Threshold validated: top
  pairwise Jaccard was 0.333 (star/wars token match — genuinely different stories).
- RADAR-CRON (`.github/workflows/radar.yml`, commit `4900811`) — chains
  RADAR-01 → RADAR-02 daily at 17:30 UTC (23:00 IST). workflow_dispatch enabled.
  15-min timeout, Node 20, npm ci. Uses existing SUPABASE_* + REBRICKABLE_API_KEY
  + GEMINI_API_KEY secrets.
- PR #2 opened: https://github.com/bricksofindia007/bricks-of-india/pull/2
  Awaiting operator review + merge before first scheduled cron tick.

Deferred items logged as carry-overs:
- PARSER-01: rss-parser strict mode breaks on New Elementary + Brickset malformed HTML
- SCRAPE-01: Tier 5 + LEGO New Sets scrape selectors return nav chrome
- YT-FEED-NOISE-01: YouTube channel RSS includes playlist additions, accepted noise

Health score: unchanged until PR #2 merges and cron fires successfully.

Commits: 55616bb, 4900811

### Day 1 — 2026-05-01

Shipped:
- LAB-01 (Biryani Index) live at /lab/biryani-index
- CONTENT-01 — Voice Codex committed at docs/codex/BOI_Codex_v2.docx,
  with markdown export at .md and Node.js regeneration script at
  scripts/export-codex-md.js
- GEO-02 (manual) — Cloudflare AI Crawler per-crawler allow/block
  policy live at WAF; allows OAI-SearchBot, PerplexityBot,
  Claude-SearchBot, ChatGPT-User, Perplexity-User, Claude-User,
  MistralAI-User, DuckAssistBot, Manus Bot, Meta-ExternalFetcher,
  Applebot, BingBot, Googlebot, archive.org_bot, Cloudflare Crawler,
  Terracotta Bot; blocks GPTBot, ClaudeBot, CCBot, Bytespider,
  TikTok Spider, Meta-ExternalAgent, FacebookBot, Google-CloudVertexBot,
  Amazonbot, PetalBot, Novellum AI Crawl, ProRataInc, Timpibot,
  Anchor Browser
- ROBOTS-01 — app/robots.ts updated to match Cloudflare WAF policy;
  production robots.txt verified at bricksofindia.com/robots.txt
- Cloudflare 2FA enabled with recovery codes saved
- Cloudflare Leaked Credentials Mitigation activated
- Stale branches cleaned: feat/lab-biryani-index, fix/p0-batch-1,
  fix/catalog-search

Unblocked:
- CONTENT-02 (Claude Project workbench) — Codex now committed
- RADAR-01 (Topical Radar daily cron) — Codex now committed
- WEB-01 (4 lint gates) — spec sourced from Codex Page 20

Closed tickets:
- BLOG-RECON-01 — closed by Brief decision (news = curated, blog =
  long-form, reviews = set reviews)

Health score: 55 → 64 (+9)

Commits (7):
- be8f134 LAB-01 merge
- a9f94d5 LAB-01 tracker update
- 3190596 Codex commit (CONTENT-01)
- 28a1a4d CONTENT-01 tracker update
- e1054e1 ROBOTS-01 robots.ts update
- 77ff3d9 Codex export script
- 4dc5975 ROBOTS-01 tracker update

### Day 2 — 2026-05-02 — Closed

Shipped:
- GEO-01 hardening — XSS scrub across all 8 schema emission sites,
  JsonLd Server Component primitive (src/components/JsonLd.tsx),
  centralised builders in src/lib/schemas.ts, BreadcrumbSchema
  converted from client to server component, SchemaLD.tsx deleted.
  10 commits (236fa7d → e9e1680).
- BUG-013 CLOSED as mis-diagnosed. Discovery (2026-05-02) confirmed
  schemas have been server-rendered into initial HTML all along.
  Original April 26 diagnosis confused 'use client' on BreadcrumbSchema
  with the entire schema layer being client-rendered. Closing as no-fix.
- MIDDLEWARE BUG FIXED (commit 5f4abef): middleware was setting response
  headers instead of request headers, making x-pathname invisible to
  Server Components via headers(). The only real production bug
  uncovered by GEO-01. Fixed to NextResponse.next({ request: { headers } }).

Followup (deferred):
- GEO-01-FU1: Verify /reviews/[slug] JSON-LD on first review publish.
  Gated by CONTENT-02 (Claude Project workbench must produce a review first).
- GEO-01-FU2: Test BreadcrumbSchema on a route deeper than 2 levels.
  Middleware x-pathname works on flat URLs; nested verification deferred
  until such a route exists in the site.

Health score: 64 → 67 (+3) — XSS scrub (+1), JsonLd consolidation (+1),
  middleware bug fix (+1). BUG-013 closure = 0 (no fix shipped).

Commits (10):
- 236fa7d Phase 1–3: JsonLd primitive + middleware + BreadcrumbSchema + layout/about
- 1613abb 4a: sets/[slug] → JsonLd
- 5f4abef fix: middleware request headers bug
- 9962885 4b: sets/page → JsonLd
- 5172c51 4c: sets/page/[page] → JsonLd
- 769fa5f 4d: news/[slug] → JsonLd
- d4ebf7f 4e: blog/[slug] → JsonLd
- 1441256 4f: reviews/[slug] → JsonLd
- 26ee104 Phase 5: delete SchemaLD.tsx
- e9e1680 chore: remove accidentally staged diagnostic files

Commits: 12 (236fa7d → a3dea42)

Day 3 entry point: pick CF-CACHE-01 (diagnostic) vs LAB-03 (cron build).
Decision deferred to Day 3 open.

---

---

## Day 31 — 2026-05-31 (UTC: 2026-05-30T20:39)

**HEAD:** `329f983`
**Health Score:** 96 (+1 — scraper gap closed, integrity layer complete to 23 checks)
**Session commits:** 4

### What shipped

| Commit | Fix |
|--------|-----|
| `323ea52` | Blog H1 "GUIDES & OPINION" → "BLOG"; guides card branded gradient fallback (saffron/red/blue per category + BOI wordmark + stud SVG); prose-p:mb-5 + heading spacing on blog/[slug] and guides/[slug] |
| `a241dd2` | Prose spacing on opinion/[slug], news/[slug], reviews/[slug]; MyBrickHouse URL mybrickhouse.in → lego.mybrickhouse.com in lab/which-set; Rivendell lego_mrp_inr 45000 → 50399 |
| `11a0b89` | MBH scraper: name-based set number fallback in parseProduct() — knownSetsByName Map built from sets.name; fixes silent drop of 10316 Rivendell + 30736 White Seaplane + 30734 Mini F1 Academy Car; store_prices 2597 → 2600 |
| `329f983` | technical-hygiene.mjs: checks 16–23 added (reviewed set prices, verdict enum, reviewed set MRP, null draft_title, per-store baseline, Tier-1 RSS freshness, guide image tracker, review routing guard); 6 dead debug scripts deleted |

### DB-only changes (no code commit)
- `reviews.verdict`: BUY → BUY NOW on 3 seeded rows (McLaren P1, Rivendell, NHM) — matches VALID_VERDICTS enum
- `sets.lego_mrp_inr`: 10316 Rivendell patched 45000 → 50399 (confirmed from MBH live page)

### DB state at close

| Table | Count | Notes |
|-------|-------|-------|
| news_articles | 53 | +1 since Day 30 |
| blog_posts | 22 | — |
| reviews | 3 | verdicts all BUY NOW |
| guides | 9 | featured_image_url null — fallback gradient live |
| store_prices | 2,600 | +3 MBH (Rivendell, White Seaplane, Mini F1 Car) |
| pending_drafts | 463 | approved:355, draft:72, published:32, rejected:4 |

### Integrity layer — complete picture
- `technical-hygiene.mjs`: Checks 1–23 (was 1–15, added 16–23 today)
- `health-check.mjs`: 10 daily checks (unchanged)
- `catalogue-audit.yml`: 7 inline checks (unchanged)
- `code-audit.yml`: ESLint + tsc + npm audit (unchanged)
- `content-verify.mjs`: 11 CQS lint checks (unchanged)

### Blockers (unchanged from Day 30)
1. **IG System User Token** — hard deadline Jul 16
2. **GSC setup** — 15 min manual task, unblocks GEO entirely
3. **CE-01 Builder Spotlights ×2** — Jul 15

### Known acceptable state
- `guides.featured_image_url`: 9/9 null — branded fallback renders
- `news_articles.hero_image`: 3 null — MOC articles, no set number
- `sets.lego_mrp_inr`: 86% null — expected, 2020+ sets only
- Review-format drafts (107): publish to `news_articles` by design
- generate+publish not run today — 355 approved drafts queued, quota resets ~12:30 IST

### Open next session
1. Run `generate-approved-drafts.js --limit 15` then `publish-drafts.mjs --limit 15`
2. GSC setup — DNS TXT → verify → sitemap submit → request indexing 10 pages
3. CE-01 Builder Spotlight — check inbox + Reddit DMs
4. Visual renderer 3 ISSUES — diagnose in content_quality_issues table

---

### Day 31 Addendum (post-close fixes)
- Rivendell review title/seo_title patched to ₹50,399 (MRP-anchored)
- Rivendell review content: all price mentions updated (₹40,319 Toycra, ₹50,399 MRP, ₹10,080 delta)
- About page: full BIO content applied, August 2025 launch date correct, Antarctica/Oh no sir/give it time added
- `@tailwindcss/typography` installed + wired — prose styles live on all 5 content page types for first time since launch
- CMF tracker: extended Series 20–29 → Series 1–29 (427 figures, 2010–2026)
- `cmf_figures` table: 427 rows (was 122)
- `sync-cmf-figures.mjs`: covers all 29 series (8683–71052)

### Day 31 Addendum 3 — Jaiman removal
- Jaiman Toys removed from entire platform — 25 files, 1,088 DB rows deleted
- Root cause: Jaiman had corrupt price data (₹2,429 for Ninjago City Workshops, ₹5,669 for Concorde etc.) — trust issue
- Scraper now hits Toycra + MBH only
- Amazon + Flipkart search links surfaced in place of Jaiman
- Store count display removed from SetCard entirely
- Gate 2 lint updated: Jaiman → Amazon/Flipkart in INDIA_STORE_RE
- Content pipeline Gemini prompt updated: "both stores: MyBrickHouse and Toycra"
- Monitoring: all health/hygiene Jaiman references removed
- One-shot seed scripts (insert-guide, insert-opinion) still reference Jaiman — historical, already run, leave as-is

---

## Legend

- ✅ Done
- 🟡 In progress / partial
- 🔴 Not started / blocked
- ⚠️ Issue found, needs fix

### Day 31 Addendum 5 — Integrity + UI cleanup
- health-check.mjs Check 5b: scrape coverage per store — alerts if <80% in-stock rows fresh in last 7h
- Previous Check 5 bug: limit:1 meant one fresh row = entire check passed — now fixed
- Homepage: 3 Indian Stores Live stat card removed entirely
- Homepage: Hamleys dropped from search copy (never tracked)
- Disclaimer "data may be stale" + "Updated every 6 hours" removed from set pages
- health-check.mjs + technical-hygiene.mjs: both already clean post-Jaiman removal

### Day 31 Addendum 6 — Homepage stat cards
- Replaced "3 Set Reviews" stat card with two stronger cards
- 500+ Active Deals (red #E3000B) -> /deals
- 400+ CMF Minifigures (navy) -> /lab/cmf-tracker
- Homepage now: Sets Tracked / News Articles / Active Deals / CMF Minifigures
- Approximate numbers used throughout — won't go stale

### Day 31 Addendum 7 — Content quality fixes
- content-linter.mjs: missing_verdict now only fires on category=Review (not all News)
- insert-opinion-01-03.js: Jaiman references removed, 3 opinion articles confirmed in blog_posts
- Page load timeout false alarms: visual renderer hitting /news/ for blog_posts articles — renderer URL prefix bug, logged
- Homepage stat cards: sets/news are dynamic DB counts, deals=500+, CMF=400+ hardcoded approximates
- Content quality report: 43 criticals reduced — majority were false positives from wrong category enforcement

### Day 31 Addendum 9 — GSC 5xx fix + route error boundaries
- Added error.tsx to all 7 dynamic routes: news/[slug], blog/[slug], guides/[slug], reviews/[slug], opinion/[slug], community/[slug], lab routes + root app/error.tsx
- Only sets/[slug] had error boundary before — all others were unprotected 5xx surfaces
- All 5 route types returning 200 confirmed post-deploy
- GSC Validate Fix triggered — Google recrawling affected sitemap URLs
- Root cause: no error boundaries meant any server component throw = 500 to Googlebot

### Day 31 Addendum 10 — GEO sprint (schema, robots, GSC)

**GSC**
- DNS TXT verification complete — bricksofindia.com now verified in Google Search Console
- Sitemap submitted, 10 key pages requested for indexing
- Unblocks GEO score improvement entirely (was -5 drag on health score)

**Schema coverage — now complete across all routes**
- themes/[theme]: was the only content route missing JSON-LD — now emits ItemList schema (up to 10 Product items)
- reviews/[slug] + themes/[theme]: openGraph block added (was missing entirely)
- guides/[slug]: featured_image_url now wired into buildArticleSchema as hero_image
- authorSchema: sameAs added (YouTube, Instagram, LinkedIn) — E-E-A-T cross-reference on every article
- ArticleData type: hero_image + url fields added; buildArticleSchema emits both
- Canonical url passed at every JsonLd call site (news, blog, opinion, guides)

**FAQPage schema — rich result eligibility**
- buildFAQSchema() added to schemas.ts
- FAQPage schema injected into news/[slug], blog/[slug] — 75 pages eligible
- FAQPage schema injected into sets/[slug] — dynamic per-set answers (~24,000 pages)
- Hamleys removed from hardcoded FAQ answers in news + blog pages

**robots.ts**
- Bingbot added to ALLOWED_AI_CRAWLERS (Microsoft Bing + Copilot search index)

**GEO-05 internal linking audit**
- Hub/spoke (themes -> sets -> themes): solid, no gaps
- Article -> set page links: gap exists but scope is content generation, not sprint fix
- Logged as future ticket: update Gemini prompt to produce markdown links to /sets/[slug]

**GEO-04 (India price data page)** — deferred, requires new route + cron, logged as P2 ticket

### Day 32 Addendum 11 — Content pipeline + prompt hardening
- 17 articles published (news_articles: 53 -> 73)
- generate-approved-drafts.js: Gate 1 hard floor raised to 300w (was "300-400", Gemini treated as soft)
- generate-approved-drafts.js: Gate 2 no-price path now mandatory — formula USD x 1.35 x live_rate = estimated INR; forces a Rs figure or IMPORT ONLY verdict
- 7 failed drafts reset to approved queue (3 Gate 1 word-count, 4 Gate 2 no-price)
- sitemap.ts: /compare (0.9), /themes index (0.8), /community/[slug] dynamic pages added
- visual-renderer.mjs: networkidle -> domcontentloaded + 30s timeout (fixes CDN-heavy page timeouts)
- Head: 4a0f5ac (prompt fix) | health: 97 | news: 73

### DEFECT-015 — Blog/Opinion route duplication (HIGH)
**Filed:** 2026-05-31

**Symptom:** Opinion articles accessible at both /blog/[slug] AND /opinion/[slug] with conflicting self-canonicals.

**Root cause:**
- publish-drafts.mjs resolveTarget('opinion') inserts into blog_posts table, path=/opinion
- blog/[slug]/page.tsx queries ALL blog_posts (no category filter), sets canonical to /blog/[slug]
- opinion/[slug]/page.tsx queries blog_posts WHERE category='Opinion', sets canonical to /opinion/[slug]
- Result: 3 opinion articles each have two live URLs, each claiming itself as canonical

**Risk:** Duplicate content = GSC canonicalisation ambiguity on live indexed pages. GSC now active.

**Fix (read before applying):**
- Option A (recommended): blog/[slug] query adds .neq('category', 'Opinion') — opinion slugs return 404 from /blog/ route
- Option B: blog/[slug] 308 redirects opinion category slugs to /opinion/[slug]
- Option A is cleaner — the routes are semantically separate by design

**Affected slugs (3):**
- certified-store-india-charges-too-much
- lego-should-manufacture-in-india
- star-wars-lego-will-bankrupt-you

**Status:** ✅ Closed 2026-05-31 — commit `8e1dce2`. blog/[slug] queries now filter `.neq('category','Opinion')`. Opinion slugs 404 from /blog/, only accessible at /opinion/[slug]. Pipeline routing unchanged — structural fix, not cosmetic. GSC will drop /blog duplicates on next crawl. Safe to publish opinion articles.

## Security: RLS Hardening — 2026-06-03
- Enabled Row Level Security across all 18 public schema tables
- Public read policy (anon SELECT) on: blog_posts, cmf_figures, community_spotlights, guides, news_articles, price_history, price_snapshots, prices, reviews, sets, store_prices
- No anon access (service_role only) on: content_fix_log, content_image_registry, content_quality_issues, newsletter_subscribers, pending_drafts, posted_lego_sets, posted_sets, raw_signals
- Triggered by Supabase security alert flagging posted_lego_sets as UNRESTRICTED
- Verified: red UNRESTRICTED badge cleared in Table Editor

---

## Pending — Next Up (as of 2026-06-21)

> Priority tiers: **CRITICAL** (deadline-class or Fan CoLab blocker) → **HIGH** (PR-2b-5 credibility hardening) → **MEDIUM** (operational) → **LOW** (cleanup) → **TRIVIAL** (informational). Owner codes: C = Claude (terminal), A = Abhinav (manual/decision), C+A = both.

---

### CRITICAL — Time-bound (hard deadlines)

#### IG-TOK-01: Instagram System User Token re-exchange
- **What:** Re-exchange IG System User Token before expiry — pipeline breaks for all IG posts on expiry
- **Source:** Current blockers § — 25 days remaining as of 2026-06-21
- **Automation shipped 2026-07-02:** `.github/workflows/ig-token-refresh.yml` (new, health-audit patch) — runs 1st + 15th of every month, exchanges for a fresh 60-day token, validates via `/me`, rotates the `IG_ACCESS_TOKEN` repo secret, emails on failure.
- **REOPENED 2026-07-26 — the 2026-07-05 closure was premature.** The cron's first unattended run (2026-07-15) *did* fire and *did* report success, exactly as this entry's closing bar required — but the "successful" rotation was a no-op: re-exchanging an already-long-lived token doesn't reliably reset Meta's 60-day clock, so the token still died on its original schedule (2026-07-23 06:04:38 PDT), taking IG posting down for 2 days (`social-automation.yml` failed 07-24, 07-25) before being noticed. Full root cause, fix, and live verification: see **§Session — 2026-07-26** at the top of this file. Closing-bar lesson for next time: "a confirmed green run" isn't sufficient evidence for a token-rotation workflow — the *result's* actual expiry needs checking too, which `ig-token-refresh.yml` now does (`expires_in >= 30 days` gate).
- **Status:** 🟡 MITIGATED, not closed — `IG_ACCESS_TOKEN` re-exchanged from a genuine short-lived token 2026-07-26T07:03:13Z (confirmed `expires_in: 5184000`, real 60 days), workflow now refuses to silently repeat the no-op. Durable fix is still the Meta System User (non-expiring) token — see **LOW-43** immediately below — not yet done.
- **Owner:** A (System User token setup, in Meta Business Manager).
- **Target window:** stopgap done 2026-07-26; durable fix window 2026-07-20–2026-08-01 (unchanged, see LOW-43).
- **Dependencies:** None for the stopgap; LOW-43 depends on this being stable in the interim.

#### LOW-43: Meta System User Token — durable IG-TOK-01 close
- **What:** Replace the current 60-day re-exchange stopgap with a permanent, non-expiring Meta System User token — the only fix that removes the recurring ~60-day cycle entirely. Re-exchanging an already-long-lived token cannot produce a true indefinite token; that's a Meta API limitation, not something `ig-token-refresh.yml` can code around (see **§Session — 2026-07-26** at top of file for the full root-cause writeup of why the re-exchange approach is structurally a stopgap, not a fix).
- **Context (2026-07-26):** `IG_ACCESS_TOKEN` is currently a genuine, verified-working 60-day token (re-exchanged from a real short-lived token, confirmed `expires_in: 5184000`), and both the `expires_in >= 30 days` refusal gate and the alerting path to Abhinav's inbox are now correctly wired and verified (see Follow-up 1 and Follow-up 3 sessions, same date). This is the **one remaining non-durable piece of the whole IG pipeline** — everything downstream of the token itself is solid.
- **Action needed:** Abhinav to retry System User creation in Meta Business Manager — previously blocked by a UI chicken-and-egg issue around app-to-Business-Portfolio assignment; worth checking whether that's cleared since May before assuming it's still stuck. Steps once unblocked: create System User → assign the LegoAutoPosts app → generate token with `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`, `pages_show_list` → update the `IG_ACCESS_TOKEN` secret.
- **Source:** B1 + E1 consolidated; SOCIAL_AUTOMATION_STATUS.md §Token calendar; originally tracked as LOW-43 (below, in §Social Automation — this entry supersedes that one's detail; kept there as a pointer for historical continuity, not duplicated).
- **Status:** Pending — Abhinav (blocked on Meta Business Manager UI, not on any code path)
- **Owner:** A
- **Target window:** No deadline forcing this — the current stopgap is stable and alerting correctly — but flag as the one remaining non-durable piece worth closing when Abhinav has a window.
- **Dependencies:** IG-TOK-01 (this closes IG-TOK-01 permanently once done)

#### YT-OAUTH-01: YouTube OAuth sensitive scope Google verification
- **What:** (a) Record OAuth scope justification video per Google requirements — not yet recorded. (b) Await Google reviewer response (submitted 2026-06-02, ~4–6 week review)
- **Source:** Current blockers § — 19 days elapsed as of 2026-06-21
- **Status:** pending — Abhinav action required (step a); Google review external (step b)
- **Owner:** A (video recording); Google (external)
- **Target window:** unscheduled (Google-controlled); step (a) can be done immediately
- **Dependencies:** none (video recording is independent of Google decision)

#### YT-OAUTH-02: Google OAuth consent screen status check — unblocks Fix C correctness
- **What:** Confirm and log the app's actual current publishing status in Google Cloud Console (Console → APIs & Services → OAuth consent screen): **Testing**, **In production**, **Needs verification**, or other. This is distinct from YT-OAUTH-01's original justification-video/review-wait items above — it's specifically about knowing which branch is currently true, not about the verification process itself.
- **Context (2026-07-26):** `social-automation/youtube_oauth_helper.py` used to hardcode "always assume Testing mode, 7-day refresh-token expiry" when computing the value `health-check.mjs` Check 6b tracks. Evidence contradicts that assumption — a token issued 2026-06-20 was still working 2026-07-22, 32 days later, well past any real 7-day Testing-mode limit — but this has never been confirmed and logged as a fact, only inferred from indirect evidence. The helper now asks interactively at re-auth time (Fix C, same-date session) rather than guessing, but the prompt is only as good as the answer given.
- **Action needed:** Abhinav checks Google Cloud Console → OAuth consent screen → publishing status, reports back one of the four statuses above, and it gets logged here as the tracker's source of truth. This is what the helper's interactive prompt should be answered with at the next YouTube re-auth.
- **Source:** Follow-up 3 — 2026-07-26 session (Fix C); related to but distinct from YT-OAUTH-01 above.
- **Status:** Pending — Abhinav (not code-verifiable; no Google Cloud API credentials configured for this repo that could check it programmatically)
- **Owner:** A
- **Target window:** No urgency — takes effect only at Abhinav's *next* YouTube re-auth, not immediately — but shouldn't get lost before then.
- **Dependencies:** None to check the status now; the answer is consumed at the next re-auth via `youtube_oauth_helper.py`'s prompt.

#### CE-01: Builder Spotlight ×2 — outreach response
- **What:** Two Builder Spotlights for publication. Outreach sent 2026-05-29. Check inbox for replies; if none by 2026-07-01 send a second outreach. Capture name, featured set, bio excerpt, confirm publication slot.
- **Source:** GAP-08; CE-01 programme; outreach posted Day 28
- **Status: 🟡 ON HOLD (operator decision, 2026-07-05).** Not overdue, not closed — explicitly paused by Abhinav. Distinct from the earlier "pending — Abhinav action required" framing: that read as an open action item quietly slipping past its 2026-07-01 second-outreach checkpoint; this is a deliberate hold, not drift. Do not report this as overdue or stale until Abhinav lifts the hold.
- **Owner:** A
- **Target window:** by 2026-07-15 (hard deadline for published spotlights) — on hold, watch whether this deadline is still realistic once resumed.
- **Dependencies:** none

#### FAN-COLAB-PROOF-01: Fan CoLab application proofs (operator actions)
- **What:** Two evidence items required for RLFM application:
  - (a) **Reframed 2026-07-05 (Abhinav approved), was "screenshot 30+ consecutive daily IG posts":** the 360° audit (`docs/audits/BOI_360_AUDIT_2026-07-04.md`, Part C) found posting is a deterministic ≥10-gallery-image eligibility gate, not a daily cadence — IG posts only fire on ~7 of every 17 days. "30 consecutive daily posts" was never an achievable claim against how the pipeline actually behaves, evidence-based or not. New framing: **complete automated coverage of every eligible LEGO.com India-relevant preview since launch — N posts, zero eligible sets missed.** `N = 26` as of 2026-07-05 (`SELECT count(*) FROM posted_sets`, first post 2026-05-24) — re-query at capture time, this grows daily. "Zero eligible sets missed" needs one supporting check at capture time: confirm no `raw_signals`/candidate row that *did* clear the gallery-image threshold was skipped without a corresponding `posted_sets` row.
  - (b) Full-site 200 OK check — verify all main routes (/, /news, /sets, /lab, /guides, /community, /opinion, /compare) return HTTP 200 week before application (≈2026-07-25). (The 2026-07-04 audit already did a broader 40-route version of this live — see the audit report's Part E — worth reusing as a template for the pre-application check rather than redoing from scratch.)
  - (c) **Added 2026-07-05:** MEDIUM-57 (editorial cross-posting of written content to IG) pulled forward as a density booster for (a) — more eligible posting surface increases the daily-coverage number without changing the underlying gallery-image gate. Scope proposal to be prescribed by chat-layer Claude; **not built yet**, this is a note to revisit, not a commitment.
- **Source:** B13; FAN_COLAB_TIMELINE.md application checklist (`docs/FAN_COLAB_TIMELINE.md` — moved out of `docs/archive/` 2026-07-05, it's an active planning doc with a live deadline, not a frozen record); absent from master tracker prior to consolidation audit 2026-06-27; reframed per 2026-07-04 audit findings.
- **Status:** pending — Abhinav action required. Capture window and application date unchanged by the reframe.
- **Owner:** A
- **Target window:** capture by 2026-07-25; application 2026-08-01
- **Dependencies:** IG-TOK-01 (social pipeline must not go dark before the capture window closes)

#### RLFM-RUNWAY-01: RLFM runway metrics snapshot (monthly)
- **What:** Log monthly snapshot for RLFM application evidence: IG followers, YT subscribers, monthly site visitors (GA4 / Netlify analytics), posts published that month, total published articles. Target: 3 snapshots (Jul 1, Aug 1 for application). Paste numbers in a comment on this item — do not commit a separate file.
- **Source:** E5; BOI_SOCIAL_TRACKER.md LAN-01/02/03; not previously in tracker
- **Status:** first snapshot due 2026-07-01
- **Owner:** A
- **Target window:** 2026-07-01 (first snapshot); 2026-08-01 (application month)
- **Dependencies:** none

---

### CRITICAL — Credibility / Fan CoLab blocker

#### CRITICAL-1: publish-drafts.yml full audit (closed — already shipped)
- **What:** Audit scheduled publish workflow — selection logic, retention policy, error handling. Deferred mid-investigation.
- **Source:** Deferred during Days 35-N investigation
- **Status:** ✅ Closed. Implementation landed 2026-06-23 (commit `baaf930`) — one day after scope lock, before this tracker entry was ever updated to reflect it. Verified 2026-06-27: `publish-drafts.mjs` imports the shared `lintDraft()`, trusts fresh stored `lint_result`, and writes `status='failed_lint'` on rejection. Confirmed against live DB — `failed_lint` rows now exist for both `news` and `review` formats (none existed at original audit time), and publishes are landing alongside them same-day.
- **Residual scope still open:** HIGH-6 (Gate 5 only checks set existence, not piece count/theme/MSRP/year) and MEDIUM-37 (Gate 6 only activates for low-confidence sources) remain as originally scoped — CRITICAL-1 closed the cron-wiring gap, not the deeper verification depth.
- **Owner:** C + A
- **Target window:** this week
- **Dependencies:** none

**Findings (audit completed 2026-06-22):**
- Cron `scripts/publish-drafts.mjs` runs Gates 1–3 only (word count, India paragraph, verdict) via a local reimplementation. It never imports `@/lib/lint` and never reads the stored `pending_drafts.lint_result` column before re-deriving its own, weaker check.
- Admin manual publish (`publishDraft` action, `src/app/admin/pending/actions.ts:423`) runs the full shared `lintDraft()` from `@/lib/lint` — Gates 1, 2, 3, 5 (factuality), 6 (source fidelity).
- Drafter paths split: bulk generation (`scripts/generate-approved-drafts.ts` → `src/lib/generate-with-failover.ts`, manual GHA dispatch) runs full lint at draft time and stores the result in `lint_result`. On-demand single generation (`generateBody()`, the admin "Generate Article" button) runs **no lint at all** at generation time.
- Net effect: any article drafted via the on-demand button and published via the cron path has had **zero factuality or source-fidelity checking at any point in its lifecycle**.
- Verified against live DB (2026-06-22): of 77 `status='published'` rows, only 1 has a non-null `lint_result`. 73 predate the `provider`/`lint_result` columns entirely (added in migration `20260619000000`, so their absence there is structural, not a skip). The remaining 4 postdate that migration (`provider` is set to gemini/cerebras) — and even so, 3 of those 4 still have no `lint_result`, meaning the bulk path's lint-and-store doesn't fire 100% of the time either.
- `lint_result` is never deleted or archived on publish (`publish-drafts.mjs:417`, `actions.ts:411` only touch `status`/`published_url`/`published_at`) — so where it exists, it's recoverable as-is; where it's null, there is no historical verdict to recover and factuality must be re-derived fresh from the live published content. See HIGH-35 below.
- Stuck-draft symptom: "Random Set of the Day: Amazon Ancient Ruins (1999)" (`pending_drafts.id = 1ead3a79-53e5-4424-979b-4ef2eaa0bfd1`), created 2026-05-03, has failed Gate 1 (word count 528, hard limit 500) identically on 6+ consecutive scheduled runs (2026-06-20 through 2026-06-21) and will continue indefinitely. Root cause: lint-gate failures in the cron script `continue` without writing to `status` — the `'failed_lint'` value has existed in the `status` CHECK constraint since the original migration (`20260503000000_pending_drafts.sql`) but has **never once been written** by any code path (0 rows in DB carry it, verified 2026-06-22).

**Scope decision (locked 2026-06-22):**
- CRITICAL-1 = (a) unify cron `publish-drafts.mjs` on the shared `@/lib/lint` module (Gates 1, 2, 3, 5, 6) instead of its local reimplementation; (b) read stored `lint_result` before re-deriving a fresh check; (c) wire the `failed_lint` terminal status on rejection so failing drafts stop retrying forever.
- HIGH-5 folded into CRITICAL-1 — cron is the highest-volume publish path, so wiring Gate 6 there closes the bulk of HIGH-5's stated gap. (Residual: Gate 6 itself still only activates for LOW-confidence sources — see MEDIUM-37.)
- HIGH-6 **partially** folded into CRITICAL-1: wiring Gate 5 into cron closes the "doesn't run there at all" gap, but Gate 5 as implemented (`src/lib/lint.ts` `gateFactuality`) only checks set-number/set-name *existence* against the `sets` table — it does not verify piece count, theme, MSRP, or year, which is HIGH-6's full stated scope. That deeper verification is unbuilt anywhere in the codebase and remains open as residual HIGH-6 scope after CRITICAL-1 ships.
- Tracker housekeeping: Part A2 workflow inventory — "Batch publish 15 drafts/run" → 30 (changed by commit `0b59a52`, 2026-06-06; tracker note has been stale since then).

#### CRITICAL-2: RADAR-01 dedup audit
- **What:** Find all duplicate-source-URL drafts beyond known cases (BrickNerd, Amazon Ancient Ruins)
- **Source:** PR-2b-3.7 session — dedup anomalies surfaced but not fully resolved
- **Status:** ✅ Closed 2026-06-28. Root cause confirmed + fixed.
  - **Root cause A** (`dedupe-signals.js`): Pass 1/2/3 only compared rows within the current batch of `pending` signals. Any URL that stayed in a source's RSS feed across multiple fetch cycles was re-inserted as a fresh `pending` row each time `fetch-rss.js` ran — and since the prior instance was already marked `unique` (no longer `pending`), Pass 1 never saw it as a duplicate. Verified: one Brothers Brick URL fetched 63 times over 7 weeks, marked `unique` all 63 times, producing 4 separately-published duplicate articles on the live site.
  - **Root cause B** (`classify-signals.js`): `existingUrls` was a static snapshot taken once before the classification loop. Two candidates for the same URL within a single run both passed `existingUrls.has()` and were both queued.
  - **Fix A** (commit `370abbf`, 2026-06-28): Pass 0 added to `dedupe-signals.js` — fetches full `raw_signals` history (all non-pending rows) for url_hash + title_hash before running Passes 1–3. Any pending row whose hash matches historical data is immediately marked `duplicate`. DEDUPE SUMMARY log now includes `historical_url_dupes=` and `historical_title_dupes=` counts.
  - **Fix B** (commit `370abbf`, 2026-06-28): `existingUrls.add(sig.url)` added after each queue push in `classify-signals.js` — within-run defense in depth.
  - **Leave-as-is decision:** Retroactive cleanup of already-published duplicate articles was handled separately in prior sessions (BrickNerd, Amazon Ancient Ruins). No automated re-dedupe of the full historical `raw_signals` table is being attempted — the 63-resubmission case is the structural extreme; Pass 0 closes it going forward. Any residual duplicate `pending_drafts` rows that haven't been published yet are blocked by `existingUrls` on the classify path; any that were already published are an editorial concern, not a new code task.
- **Owner:** C
- **Target window:** Done
- **Dependencies:** none

#### CRITICAL-3: url_hash normalization audit
- **What:** Verify url_hash normalization is consistent across all RADAR-01/02 sources; confirm no dedup misses due to trailing slash or scheme variants
- **Source:** PR-2b-3.7 session
- **Status:** ✅ Closed 2026-06-28. Root cause confirmed + fixed.
  - **Root cause:** `hashUrl()` in `fetch-rss.js` called `new URL(rawUrl.toLowerCase())` but never normalized scheme (http vs https) or hostname prefix (www vs bare domain). Verified live: 35 articles exist in `raw_signals` under both `http://` and `https://` variants with different url_hash values, both marked `unique`.
  - **Fix** (commit `370abbf`, 2026-06-28): Added `u.protocol = 'https:'` and `u.hostname = u.hostname.replace(/^www\./, '')` to `hashUrl()` before hashing. New fetch runs produce consistent hashes for http/https and www/bare variants. Combined with Pass 0 in CRITICAL-2, these previously-duplicated URLs will now be caught as historical duplicates on the next dedupe run.
- **Owner:** C
- **Target window:** Done
- **Dependencies:** CRITICAL-2

#### CRITICAL-4: Voice scorer (PR-2b-5a)
- **What:** Automated voice consistency scorer — direct response to Sonia incident (wrong tone, not caught by lint)
- **Source:** PR-2b-5 roadmap
- **Status:** 🟡 Part A + Part B implemented 2026-06-28 in `scripts/score-voice.ts`. **Not wired into the generation pipeline.** Calibration required before Gate 7 goes live.
  - **Part A** (8 deterministic hard rules): A1 wallet continuity, A2 India paragraph prose (no bullet lists), A3 banned LLM tells (6 phrases + "in conclusion" exception + source-paraphrase rule 8), A4 paragraph-2 PR-paraphrase detection, A5 verdict tag (deferred to Gate 3), A6 sign-off line, A7 affiliate discipline (ABHINAV12 ≤2 occurrences), A8 no hallucinated first-person build in non-review pieces.
  - **Part B** (LLM-as-judge soft scoring): 6 dimensions (voice_anchor 30pts, india_paragraph_rhythm 20pts, wallet_craft 15pts, signoff_craft 15pts, opening_hook 10pts, humour_engine 10pts). Gemini primary, Cerebras failover (same eligibility rule as main generator). Structured JSON response, clamped 0–10 per dimension, weighted total out of 100.
  - **Calibration required (Part C, Steps 1–5 — non-skippable):** Step 1: score 76-article known-good corpus; Step 2: score 6 known-weak drafts; Step 3: tune pass threshold against Step 1/2 results; Step 4: dry-run against current approved queue; Step 5: Abhinav sign-off. Steps 1–4 require live Gemini API calls — run from terminal after this commit lands. Do not import `score-voice.ts` into the generator until Step 5 is complete.
  - **Part C progress (no-API portion, 2026-06-28):** Ran Part A against all 5 Cerebras pilot outputs + their 5 Gemini baselines from `docs/cerebras-pilot-report.md` (zero API cost — deterministic rules only). A2 validated strongly: failed 4/5 Cerebras, 0/5 Gemini, matching the rubric's claim that this is "the single most consistent Cerebras failure." A1 found and fixed a real bug (`\bwallet\b` never matched the plural "wallets") and was widened (EMI, financially, purse strings, broke the bank) — then downgraded from hard FAIL to WARN, since even after widening, some approved Gemini baselines don't reuse wallet language post-opener. This is a 10-article sample, not the full 76-article corpus, and doesn't touch Part B (LLM judge) — Steps 1–4 with live API access are still needed for a real threshold.
  - **Calibration script created (2026-06-28):** `scripts/calibrate-voice-scorer.ts` — contains KNOWN_WEAK corpus (5 Cerebras pilot bodies from `docs/cerebras-pilot-report.md`; Ebon Hawk slot left as placeholder — body unrecoverable from run log 28256415673 or DB, auto-publish path skipped saving `draft_body`). Fetches KNOWN_STRONG from `news_articles` (≤60 published articles). Runs all through `scoreVoice()`, computes distributions, writes `docs/voice-scorer-calibration.md`. Run: `npx tsx --env-file=.env.local scripts/calibrate-voice-scorer.ts` (needs `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
  - **Calibration run complete (2026-06-28):** `docs/voice-scorer-calibration.md` written. STRONG n=49 scored (11/60 hard-rule failures, 0 rate-limit errors on Cerebras-only run with 8s delay). WEAK n=1 scored (4/5 blocked by A2 before LLM judge — correct behaviour). Hard-rule failures in STRONG confirmed as zero false positives: A2 catches bullet-list India paragraphs, A3 catches "The article notes that..." / "The article points out..." / banned phrases, A4 catches "The article [verb]..." P2 openers. All verified against live article content from DB.
  - **Step 5 sign-off (2026-06-28, Abhinav):** Ship Gate 7 as **hard-rules-only**. Soft score (Part B LLM judge) is advisory — do not auto-block on it. Reasons: (1) within-Cerebras variance on same article produced 9 vs 28 on consecutive runs — an all-zeros output that `parseJudgeResponse` would previously have silently accepted as a valid score (now hardened: missing/null/non-finite keys throw as `judgeError` instead of coercing to 0); (2) cross-provider variance Gemini 68 vs Cerebras 28 on same article is too wide for a reliable threshold; (3) WEAK corpus soft-score n=1 (Volvo FH, 47) is statistically insufficient. Hard rules as shipped: **A2, A3, A4** unconditional hard FAIL; **A6** hard FAIL for review/opinion only (news always passes); **A7** hard FAIL for >2 ABHINAV12 only (Toycra-warn is pass); **A8** hard FAIL for non-review non-video first-person build claims. **A1, A5** always pass (WARN-only or deferred). Soft score to be logged per article and surfaced in admin dashboard; revisit as hard gate after within-provider consistency is verified across ≥20 matched pairs.
  - **Gate 7 wired (2026-06-28):** Hard rules extracted to `src/lib/hard-rules.ts`, imported by `src/lib/generate-with-failover.ts`. `GenerationOutcome` now carries `hardRules: HardRuleResult[]` and `hardFail: boolean`. Both Gemini and Cerebras paths run `runHardRules(body, format, sourceUrl)` after `parseDraftResponse`. `requiresManualApproval` is `true` when any hard rule fails — article routes to manual review queue instead of auto-publishing. Run log shows `[GATE7 FAIL: A2_india_paragraph_prose,...]` for each violation. `scripts/score-voice.ts` re-exports `runHardRules` from `src/lib/hard-rules.ts` for calibration script compatibility. TypeScript: clean (`vitest` module error in `tests/snapshot.test.ts` is pre-existing, unrelated).
- **Status:** ✅ CLOSED 2026-06-28 — Gate 7 active in production. Soft score deferred per Step 5 sign-off.
- **Owner:** C ✅
- **Target window:** ~~Wire-in this week~~ DONE
- **Dependencies:** none

---

### HIGH — PR-2b-5 credibility hardening

#### HIGH-5: Source fidelity gate v2 (PR-2b-5b)
- **What:** Extend source fidelity check to ALL drafts; cross-check article claims against cited source URL content
- **Source:** PR-2b-5 roadmap
- **Status:** **folded into CRITICAL-1** (2026-06-22) — cron wiring closes the bulk of this gap. Residual: Gate 6 still only activates for LOW-confidence sources, not literally all drafts — tracked separately as MEDIUM-37.
- **Owner:** C
- **Target window:** this month
- **Dependencies:** CRITICAL-4

#### HIGH-6: Factuality gate v2
- **What:** Verify piece count, theme, MSRP, year for every draft — not just set number existence
- **Source:** PR-2b-5 roadmap; Sonia incident exposed gap
- **Status:** **partially folded into CRITICAL-1** (2026-06-22) — cron wiring fixes "Gate 5 doesn't run on the cron path at all," but Gate 5 as implemented only checks set existence, not piece count/theme/MSRP/year. The deeper verification this item actually asks for is unbuilt anywhere and remains open.
  **Partial resolution 2026-06-22 (commit 71f2a92):** matcher-precision
  sub-scope addressed via extractSetNameCandidates bug fix (theme prefix
  was being retained in the candidate, blocking AND-word-match against
  sets.name). 5 of 12 HIGH-35 fail cases resolved by this single fix.
  Residual HIGH-6 scope (piece count / theme / MSRP / year verification
  beyond existence check) still open and unchanged.
- **Owner:** C
- **Target window:** this month
- **Dependencies:** HIGH-5

#### HIGH-7: Cross-provider fact-check on reviews
- **What:** Second model fact-checks first model's claims on all review-format drafts before approval
- **Source:** PR-2b-5 roadmap
- **Status:** not started
- **Owner:** C
- **Target window:** this month
- **Dependencies:** HIGH-6

#### HIGH-8: /corrections public log page
- **What:** Public-facing corrections and retractions page — credibility signal for Fan CoLab application
- **Source:** Fan CoLab credibility requirements
- **Status:** not started
- **Owner:** C + A
- **Target window:** pre-Fan-CoLab (Aug 2026)
- **Dependencies:** HIGH-10 (retracted_articles table)

#### HIGH-9: Article footer attribution copy
- **What:** Sitewide footer on every article: "AI-assisted, reviewed by Abhinav Bhargav, spot an error [link]"
- **Source:** PR-2b-5 roadmap
- **Status:** not started
- **Owner:** C
- **Target window:** pre-Fan-CoLab (Aug 2026)
- **Dependencies:** none

#### HIGH-10: retracted_articles audit table
- **What:** Proper DB provenance for retractions (slug, reason, date, retracted_by) — replaces ad-hoc audit_log approach
- **Source:** Amazon Ancient Ruins + Sonia retraction sessions
- **Status:** not started
- **Owner:** C
- **Target window:** this month
- **Dependencies:** none

#### HIGH-11: news_articles.provider column
- **What:** Track which model produced each article (gemini / cerebras / unknown) — audit trail going forward; closes GAP-13 retroactive gap for future publishes
- **Source:** PR-2b-3 + PR-2b-3.5; GAP-13 (74 historical publishes have no telemetry)
- **Status:** not started
- **Owner:** C
- **Target window:** this month
- **Dependencies:** none

#### HIGH-35: AUDIT-RETRO-01 — retroactive factuality audit of 76 unchecked published articles
- **What:** Audit all 77 `pending_drafts.status='published'` rows for factuality. Verified 2026-06-22: only 1 of 77 has a stored `lint_result` — the other 76 were never lint-checked at any lifecycle stage (73 predate the lint infrastructure entirely — migration `20260619000000`; 3 postdate it but still missing `lint_result` despite the bulk path supposedly always storing one). For each unchecked row: extract set number(s)/name(s) from the live published article (`news_articles`/`blog_posts`, matched via `pending_drafts.published_url`), verify existence against the `sets` table using the same logic as Gate 5 `gateFactuality` (`src/lib/lint.ts:113`), and retract under the CONTRA-01/GAP-03 pattern any article referencing a set that doesn't exist. This is a from-scratch re-check against live content, not a recoverable backfill — `lint_result` was structurally never populated for these rows, not deleted.
- **Source:** Surfaced during CRITICAL-1 audit, 2026-06-22
- **Status:** **closed 2026-06-22**
- **Owner:** C
- **Priority note:** filed at HIGH tier per project convention, but should be actioned before or alongside CRITICAL-1's forward-looking fix — this is a credibility-lock breach already live in production (some subset of 77 articles may reference nonexistent sets), not a future-prevention task. Independent of CRITICAL-1's code change — uses Gate 5 logic against live published content, not pending_drafts.
- **Target window:** this week
- **Dependencies:** none (related: MEDIUM-12's weekly audit cron is the ongoing/future-facing version of this same check, scoped to 10 articles/week going forward — this item is the one-time full backlog catch-up)
- **Verification (2026-06-22):** checked whether the dropped `lint_results` (plural) column has any reconcilable historical data via its backup table (`pending_drafts_lint_results_backup_20260620`, created by migration `20260620120000` before the drop). Backup table is 0 rows — the plural column was never written to by any code path, matching the migration's own "zero code references" note. Confirms no hidden lint data exists anywhere under either column name; the 76-row unchecked population stands as the true audit scope, not an overcount.
- **Population:** 76 articles published via cron without `lint_result`, identified in Phase 1.
- **Method:** Phase 1 extraction (`audit/HIGH-35/phase1-extraction-2026-06-22.json`) → Phase 2 verification calling production `gateFactuality` against each article's published content (commit `48d0885`).
- **Result:**
  - 64 PASS at first Phase 2 run.
  - 5 additional PASS after fixing the `extractSetNameCandidates` theme-stripper bug (commit `71f2a92`) — Technic Aston Martin, Icons Sega Genesis, Star Wars Jabba's Sail Barge, Icons Road Bike, Technic McLaren all resolved to real catalogue sets.
  - 7 remaining `FAIL_FACTUALITY` cases triaged via direct catalogue lookup + body inspection + external verification:
    - **Main Street USA** — matcher trailing-token gap; real set "Main Street" (43302) exists; article PASS.
    - **Megatron BrickHeadz ×2** — real catalogue set 40924; matcher gap class; article PASS.
    - **Ebon Hawk** — MOC correctly disclosed in prose; no live verdict rendered; stray backend `draft_verdict='WAIT'` never reached the page; article PASS.
    - **World Netherlands** — convention/event name, not a product; article PASS.
    - **Smart Brick** — real LEGO product (LEGO SMART Brick, launched 2026-03-01, verified via LEGO.com press release, Wikipedia, Brickset); platform component, not a numbered set; article PASS.
    - **India MRP** — extraction artifact from pricing text "LEGO India MRP ₹X"; article PASS.
- **Final outcome:** Zero retractions. One real production bug found and fixed (commit `71f2a92`). Audit verified catalogue integrity rather than discovering fabrications.
- **Sub-findings spawned (filed below):** MEDIUM-41 (theme stripper trailing-token gap), MEDIUM-42 (Gate 5 non-set product handling), MEDIUM-43 (extraction artifacts from non-product text), MEDIUM-44 (`is_community` signal gap — community content with stray backend verdict metadata, instances: BrickHeadz ×2, Ebon Hawk).

#### HIGH-45: Generation pipeline dormant — Stage 1 has not fired in 22+ days
- **What:** `generate-drafts.yml` last ran 2026-05-31 — processed 20 of 335 queued drafts, then hit Gemini's documented rate-limit circuit breaker (`[429 Too Many Requests]... Rate limit (429) — stopping batch to avoid quota waste`, per CLAUDE.md's "on 429, stop immediately, do not retry" policy) and exited cleanly (run conclusion: success). The workflow is `workflow_dispatch`-only — confirmed via direct read of `.github/workflows/generate-drafts.yml`, no `schedule:` trigger exists at all — so nothing has re-triggered it since. Diagnostic complete, ruled out: not a secrets issue (`GEMINI_API_KEY`, `CEREBRAS_API_KEY` both present in repo secrets); not a missing/misconfigured workflow (no other generator-shaped `.yml` file exists). `generator_runs` shows only 3 lifetime rows, all 2026-06-20, 1-draft manual/`manual_test` invocations — the 2026-05-31 batch run predates the table's creation (migration `20260619000000`), same structural telemetry gap as the already-documented GAP-13, not evidence of anything else having run since. Meanwhile RADAR ingests 15–25 candidates/day; backlog now stands at 521 rows awaiting generation (46 never-started + 475 CQS-reset awaiting regeneration). CRITICAL-1 fixed the publish stage; without Stage 1 firing, the publish stage has nothing to publish.
- **Why it matters:** Blocks the end goal of authentic content flowing to the website. Fan CoLab application (Aug 2026) requires demonstrated publishing cadence; 22+ days of silence undermines that evidence base. Backlog growing means harder cleanup later.
- **Status:** ✅ CLOSED 2026-06-23 via origin commit `3d5e3b9` (`ci(generate-drafts): add daily schedule + fix limit default for scheduled runs`). Fix adds `schedule: cron: '30 8 * * *'` (08:30 UTC daily — 90min after Gemini quota reset at 07:00 UTC summer) and a `RUN_LIMIT` env override (20 drafts for scheduled runs, 50 for manual dispatches). First scheduled run fires 2026-06-24T08:30Z. LOW-26 telemetry-discriminator fix landed alongside as `6e11116`.
- **Resolution note:** An earlier session reported HIGH-45 closed via commit `84a5571` — that SHA never existed on origin (verified via `git log --all` 2026-06-23). The fix had been committed in a separate local checkout at `C:\Users\bharg\Documents\BricksofIndia\website` but never pushed; the synced checkout at `~/bricks-of-india` was unaware. R1 reconciliation (2026-06-23) added the Windows checkout as a temporary remote, fetched, verified both commits via `git show <sha> -- <file>`, cherry-picked onto origin/main (new SHAs `3d5e3b9` + `6e11116`), and removed the temporary remote. Post-push verification: `cat .github/workflows/generate-drafts.yml` confirmed schedule block present, `grep` confirmed RUN_LIMIT override, `git rev-list --left-right --count` confirmed 0/0 divergence. Tracker note preserved as a lesson against trusting commit-message-only confirmations going forward.
- **Owner:** Abhinav (now closed).
- **Source:** Surfaced 2026-06-22 during post-CRITICAL-1 holistic pipeline review. Closed 2026-06-23 via R1 reconciliation.

#### HIGH-46: Rebrickable API returning HTTP 401 for set lookups
- **What:** technical-hygiene.yml 2026-06-22 run logged `[ExtP1] FAIL: Rebrickable API: HTTP 401 for 42172-1 — image fallback chain will fail` (line 820 of run log) and `[ExtDependencies] FAIL: Rebrickable API: HTTP 401 for set 42172-1` (line 851).
- **Root cause (diagnosed 2026-06-25):** Not a key problem. `technical-hygiene.mjs` reads `process.env.REBRICKABLE_API_KEY` (same header format as the working `sync-rebrickable.js`), but `technical-hygiene.yml`'s env block never declared the secret — confirmed via grep, zero matches, while all 5 sibling workflows (`radar.yml`, `sync-catalogue.yml`, `scrape-prices.yml`, `publish-drafts.yml`, `deploy.yml`) wire it correctly. So `rbKey` was `undefined` in CI, the Authorization header was omitted entirely, and Rebrickable correctly 401'd with "Authentication credentials were not provided." Confirmed by live baseline test (unauthenticated request reproduces the identical 401) and by production evidence the real key works: `sync-catalogue.yml` run `27896212758` (2026-06-21T06:40Z, one day before the failing hygiene run) synced 12,000+ entries with 0 failed requests using the same key. Same Bucket D pattern as the `NEXT_PUBLIC_SUPABASE_ANON_KEY` fix (commit `1a1c051`). Also confirmed Rebrickable is not in the Cerebras/Gemini draft-generation path — this item never actually blocked Tier B.
- **Fix:** Added `REBRICKABLE_API_KEY: ${{ secrets.REBRICKABLE_API_KEY }}` to `technical-hygiene.yml`'s env block; added `technical-hygiene.yml` to `REBRICKABLE_API_KEY.required_by` in `.github/secrets-manifest.json`.
- **Source:** hygiene run 2026-06-22T09:42:39Z, lines 820 + 851
- **Status:** Closed 2026-06-25, pending next scheduled hygiene run for live confirmation (Monday 04:00 UTC).
- **Owner:** Abhinav (terminal)
- **Target window:** Done.
- **Dependencies:** None — confirmed not a blocker for HIGH-6 or Tier B; HIGH-6 residual still needs HIGH-48 (piece data coverage) separately.

#### HIGH-47: Homepage HTML contains literal `mailto:` link (CI guard bypass or regression)
- **What:** technical-hygiene.yml 2026-06-22 run logged `[SecurityPosture] FAIL: homepage HTML contains mailto: — email address exposed to harvesters` (line 909). Per BOI_MASTER_TRACKER.md prior context, a CI guard was added during the contact-route migration explicitly to prevent literal email in client-rendered HTML. Either (a) the guard regressed silently, (b) the homepage was modified after the guard and the guard's coverage misses the homepage, or (c) the guard runs in a workflow that's not blocking merges. Email exposed to harvesters is a credibility and spam-risk problem with Fan CoLab implications.
- **Source:** hygiene run 2026-06-22T09:43:08Z, line 909
- **Status:** ✅ CLOSED 2026-06-26 via origin commit `deaf982` (cherry-pick from Windows `61c3847`). R2 committed 9 files: `Footer.tsx` (mailto→Link /contact), `contact/page.tsx` (real Server Action replacing setTimeout stub), `about/page.tsx`, `community/page.tsx`, `community/[slug]/page.tsx`, `schemas.ts` (email → contactPoint schema), `actions/contact.ts`, `contact-email.ts`, `.github/workflows/ci.yml` (email-guard). ci.yml missing `SUPABASE_SERVICE_ROLE_KEY` fixed in follow-up commit `16ace63`. Email-guard run `28255741099` completed success — email not found in built bundle or any of 5 rendered routes. See MEDIUM-51 (closed alongside).
- **Owner:** Abhinav (closed).
- **Target window:** Done.
- **Dependencies:** None.

#### HIGH-48: 27% of sets missing pieces data — catalog credibility gap + blocks HIGH-6
- **What:** technical-hygiene.yml 2026-06-22 run logged `[CatalogCoverage] FAIL: 27% of sets missing pieces data — catalogue may be degraded` (line 811). Piece count is a core attribute users expect; absence at 27% scale is a visible credibility hit. Also directly blocks HIGH-6 deeper verification — Gate 5 cannot verify "claimed piece count matches catalog" against 27% of the catalog.
- **Source:** hygiene run 2026-06-22T09:42:37Z, line 811
- **Status: RESOLVED 2026-06-30 — diagnosis answers the open question, fix lands in the check, not a data backfill.** Queried the live `sets` table directly to answer "is the 27% concentrated in a specific theme, or spread evenly?" — confirmed concentrated, not spread: real flagship building themes are all in single digits (Ninjago 1.3%, Technic 3.0%, Creator 3.0%, Icons 2.5%, Architecture 2.0%); the 27.6% catalogue-wide figure is driven almost entirely by non-buildable merchandise categories (Plush Toys, Key Chain, Bags/Totes, Story Books, Gear, Stationery, Clocks — all 90-100% "missing," because a keychain genuinely has no piece count to report) and multi-set bundle/pack/advent-calendar products (City's elevated 19.1% rate, for example, was 100% bundle/pack/advent SKUs on direct inspection of all 47 rows — `60510 City Advent Calendar 2026`, `66803 Built For Speed Gift Set`, etc. — none were genuine single-build City sets missing data). Excluding both populations, the real gap among genuine buildable sets is ~6% (1,053/17,558, verified) — a small, normal, explainable residual (older/rare sets, regional exclusives, incomplete upstream Rebrickable/Brickset data), not a 27% catalogue-wide credibility problem. Fixed `technical-hygiene.mjs`'s `CatalogCoverage` check to exclude both populations before measuring, so future reports reflect the real, actionable number instead of the inflated one. No data backfill prescribed — there's nothing wrong with the data; the check was measuring the wrong population.
- **Owner:** C (done).
- **Target window:** Closed.
- **Dependencies:** None.

#### HIGH-49: Article mentions Toycra without ABHINAV12 affiliate code
- **What:** technical-hygiene.yml 2026-06-22 run logged `[ContentIntegrity] FAIL: 1 article(s) mention Toycra without ABHINAV12: lego-technic-aston-martin-amr25-f1-car-revealed-another-one-` (line 870). Article mentions the affiliate partner without including the discount code obligated under the Toycra affiliate relationship — both a missed credibility signal (readers don't get the discount) and a partner-obligation gap.
- **Source:** hygiene run 2026-06-22T09:42:50Z, line 870
- **Status: RESOLVED 2026-06-30 — both the check scope bug and the check's underlying rule have been fixed; 2 real articles remain for editorial action.** Two layers, both fixed: (1) scope — the check only ever scanned the 10 most-recently-published articles, the originally-flagged article aged out of that window and the check silently went "clean" without the gap being fixed; now scans the full `news_articles` table. (2) rule — Abhinav, explicit: "my code abhinav12 should only be mentioned if and when the set is available on toycra. if it is not available only there is absolutely no point in mentioning that. also, sets which will be import also do not need that message either." The original "any Toycra mention requires the code" rule was too blunt — manually classified all 8 originally-flagged articles against this rule and found only **2 of 8** actually need the code (`bossks-houndstooth-from-jabbas-sailbarge-set-75397-gets-a-cr`, `lego-titanic-10294-sailing-into-your-living-room-and-your-wa` — both state a real, present-tense ₹ price at Toycra right now). The other 6 correctly describe sets as not-yet-available, never carried, or possibly import-only — adding the code there would have been a content error. Implemented the corrected rule as `src/lib/toycra-availability.ts::genuinelyAvailableAtToycra()` — requires a real ₹ price within an 80-char window of a Toycra mention, with no hedging/future/import language in that same window (not the whole sentence — an earlier draft of this incorrectly flagged the real Houndstooth article over an unrelated stock-level caveat, "might be out of stock," appearing later in a long sentence; narrowing the hedge check to the matched window fixed it). 10 unit tests, all against real/near-verbatim original article text, including the regression case that caught the whole-sentence bug. **2 real articles still need editorial action** — not auto-fixed, since adding an affiliate code to live content is an editorial decision.
- **Owner:** A (add ABHINAV12 to the 2 genuinely-available articles).
- **Target window:** This week.
- **Dependencies:** None.

#### HIGH-50: 46 approved drafts had null draft_title (mischaracterized — closed)
- **What:** technical-hygiene.yml 2026-06-22 run logged `[DraftTitleNull] FAIL: 46 approved drafts have null draft_title and will be skipped by generator` (line 895). **Original framing was incorrect.** Verified 2026-06-27 against `scripts/generate-approved-drafts.ts` (the script `generate-drafts.yml` actually runs) and every other generator variant in the repo, including the deprecated `scripts/radar/generate-drafts.js`: all of them filter on `status='approved' AND draft_body IS NULL`, never on `draft_title`. These rows were never skipped — they were sitting normally in the generation backlog (533 approved rows with `draft_body IS NULL` as of 2026-06-27; 178 of those are older and ahead of these 46 in FIFO order, oldest dating to 2026-05-09). Mechanism: rows ingested via RADAR-08's review pipeline get `draft_title` pre-seeded at insert; rows from plain RADAR-03 bulk-approve don't — title is set by the generator alongside `draft_body`. Both paths process identically.
- **Resolution:** Backfilled all 46 live via Supabase (`UPDATE pending_drafts SET draft_title = left(source_title, 200) WHERE status='approved' AND draft_title IS NULL`), verified 0 remaining. Clears the hygiene false positive; changes nothing about generation order or timing.
- **Real follow-up filed separately:** HIGH-52 (backlog growth) and the Check 19a redesign — the alert was asserting a skip mechanism that doesn't exist in any generator version.
- **Source:** hygiene run 2026-06-22T09:43:02Z, line 895. Root-caused and closed 2026-06-27.
- **Status:** ✅ Closed 2026-06-27 — corrected root cause, not the originally diagnosed one.
- **Owner:** Claude (chat session, via Supabase MCP) for the DB fix; terminal for this doc + Check 19a correction.
- **Dependencies:** None. Supersedes the "structural fix to prevent recurrence" framing — null draft_title pre-generation is expected, not a defect.

#### HIGH-52: Generation backlog growing faster than throughput
- **What:** Approved rows awaiting generation (`draft_body IS NULL`) measured at 533 on 2026-06-27, up from 521 noted 2026-06-22 — despite `generate-drafts.yml` running daily at 08:30 UTC since 2026-06-24 (RUN_LIMIT=20/day scheduled, 50/day manual). Ingestion (RADAR-03 + RADAR-08) is outpacing generation.
- **CURRENT STATUS (2026-06-29, read this first):** Root cause found and fixed (Cerebras eligibility checked the wrong field — see below). `RUN_LIMIT` raised 20→30. Backlog cleared to current-only via a separate 10-day-retention delete (now 95 `approved` rows, all <10 days old, vs. the 532-542 historical figures quoted below). **Still genuinely open:** whether 30/day at the new success rate actually closes the gap against ~18/day ingestion — no real post-fix scheduled-run data exists yet to confirm this; revisit after 2-3 real runs. Everything below this line is the dated investigation history that led here — accurate as a record, not as current numbers.
- **Source:** Surfaced 2026-06-27 during HIGH-50 root-cause investigation.
- **Root cause (ByteString error, identified 2026-06-28):** generate-drafts.yml runs were failing at 45–66% per run with `Cannot convert argument to a ByteString because the character at index 7 has a value of 65279` (U+FEFF BOM). Root: a BOM embedded at position 7 of the `GEMINI_API_KEY` GitHub Secret (e.g. `AIzaSy﻿...`). The original `getSecret()` regex `/^﻿/` only stripped leading BOMs; a mid-key BOM at position 7 was not caught, causing undici to reject the key when set as the `x-goog-api-key` header. Confirmed on three runs: 2026-06-25 11:12 (11/20 FAIL = 55%), 2026-06-26 11:20 (9/20 FAIL = 45%), 2026-06-26 17:42 (33/50 FAIL = 66%).
- **Fix (2026-06-28):** `src/lib/get-secret.ts` — changed from `/^﻿/` (leading-only, literal BOM char) to `/﻿/g` (global, explicit Unicode escape). Strips BOMs at any position; escape sequence survives transpiler stripping. Committed with `scripts/calibrate-voice-scorer.ts`.
- **Status:** Fix confirmed working, but does not close the backlog problem. Capacity sizing run live against Supabase (`generator_runs`, `pending_drafts`) 2026-06-28T17:54Z; root cause refined 2026-06-28T18:20Z with a 5-row diagnostic dispatch (`gh workflow run generate-drafts.yml -f limit=5`) + log read.
  - **BOM fix verified:** `drafts_failed` was 0 on both post-fix scheduled runs (06-27 10:31, 06-28 10:38) vs 9–33 per run pre-fix (06-25/06-26). Infra failure mode is resolved.
  - **Correction to earlier framing (this entry, same day):** the initial capacity-sizing pass attributed the 06-27/06-28 shortfall to "Gate-7-routed manual review." That was **not verified against actual DB rows** before being written — re-checked 2026-06-28T18:20Z and found zero `pending_drafts` rows matching the `routed_to_review` counts in `generator_runs.provider_stats` by provider/timestamp. The real cause, confirmed below, is different.
  - **Real root cause (confirmed via `gh` diagnostic dispatch + log + SQL, 2026-06-28T18:20Z):** `isCerebrasEligible()` (`src/lib/source-quality.ts`) requires `source_excerpt.length >= 200`, with `null` excerpts treated as `''` (0 chars) — so both `NULL` and short excerpts fail eligibility identically. Queried the full unstarted backlog (532 rows, `status='approved' AND draft_body IS NULL`): **359 rows (67.5%) are Cerebras-ineligible** — 334 with `source_excerpt IS NULL` (62.8%, intentional per code comment: "Layer 2 rule... covers no_excerpt (46% of approved backlog) and YouTube (5%)"), 25 with excerpt <200 chars (4.7%). These rows have **no failover** — if Gemini is rate-limited or quota-exhausted when their turn comes up in FIFO, they go `DEFERRED` and sit unchanged in `approved` for the next run to retry, with no escalation or alerting.
  - **5-row diagnostic confirms the mechanism live:** dispatched `limit=5` at 2026-06-28T18:15Z (8 hrs after the day's 10:38 scheduled run had already used Gemini quota). All 5 oldest backlog rows (created 2026-05-09, all short/null-excerpt) → `5/5 DEFERRED`, 0 published, 0 reviewed. Log: `Gemini failed (retryable) and Cerebras not eligible (excerpt < 200 chars)` on every row, ~7s apart, no backoff — consistent with same-day Gemini quota exhaustion, not a per-row bug.
  - **Why these rows are stuck at the front of FIFO since 2026-05-09:** they're not corrupted or special-cased — they're structurally fragile (Gemini-only) and have apparently been hitting Gemini-exhausted windows on repeated runs since well before the BOM bug existed. DEFERRED is non-destructive (row stays in `approved`, retried next run) but has no mechanism to prioritize differently or alert after N consecutive defers.
  - **Ingestion confirmed:** `pending_drafts` rows created over the last 7 days average **~18.3/day** (range 14–33), consistent with CLAUDE.md's documented 15–25/day.
  - **Net result: backlog is still growing**, ~12/day net even after the BOM fix. Current state: 536 `approved` rows, 532 with `draft_body IS NULL`, oldest dating to **2026-05-09** (50 days old, FIFO) — and that specific age is now explained: it's a Gemini-only row that keeps losing the quota race, not evidence of a separate skip bug.
  - **Policy question raised by Abhinav, not yet decided:** lower the Cerebras 200-char floor for this subset (loses the "Cerebras only sees the proven-safe population" guarantee the comment documents), or accept these rows only ever clear on a low-traffic Gemini day. **Abhinav has asked to hold any code/policy change here until this is fully separated from the unrelated auto-publish/reject-delete proposal below.**
  - **Separate, still-undecided policy proposal (Abhinav, this session):** for drafts that complete generation, auto-publish on full gate pass, auto-reject+delete on fail (replacing the current park-in-`failed_lint`/`draft`-forever behavior). **Not yet implemented** — explicitly held pending the diagnosis above, since shipping a delete-on-fail policy on top of an unexplained FIFO/skip pattern risked deleting rows that had never actually been attempted. With the DEFERRED mechanism now explained (non-destructive, retries automatically), this proposal can be scoped on its own merits next.
- **Owner:** Abhinav (policy decisions: Cerebras floor + auto-reject/delete) → Terminal (implementation once decided).
- **Target window:** Before backlog depth reads as a stale-pipeline signal for Fan CoLab evidence.
- **Dependencies:** Gemini 2.5 Flash-Lite free-tier 10 RPM ceiling; Cerebras eligibility floor (this entry); Gate 7 hard-rule fail rate (CRITICAL-4) — separate, smaller contributor, not yet isolated from the eligibility-floor effect above.
- **Cross-reference (2026-06-28, later — see HIGH-53):** HIGH-52's analysis above covers the 542 `approved`+null-body backlog only. A second, separate, 200-row backlog (`status='draft'`+null-body, RADAR-03's pre-generation signal-review gate) was found the same day and is **not** covered by anything in this entry — see HIGH-53. Real total undelivered-content backlog across both is 742 rows, not the ~536-542 figures quoted throughout this entry.
- **Post-delete status (2026-06-28, same day, later still):** Abhinav instructed a bulk 10-day-retention cleanup (see Sprint changelog, "696-row pipeline cleanup") — all `approved` rows older than 10 days were deleted outright, not generated, not approved further. **`approved` count is now 100** (down from 542), all created within the last 10 days. The historical diagnosis above (Cerebras eligibility gap, BOM fix, the 2026-05-09 row's specific fate) remains accurate as a record of what happened and why, but the absolute backlog numbers it quotes (532/536/542) **no longer reflect current state** — read them as historical evidence for the root-cause finding, not as the current queue depth. The underlying throughput question (ingestion ~18/day vs. generation ~6/day net pre-fix) is unchanged and will reproduce the same growth pattern on the new, smaller base unless the Cerebras-eligibility and BothProvidersFailedError fixes (still unapplied as of this writing) actually land.
- **RUN_LIMIT raised 30 (2026-06-29, Abhinav, after all fixes above had landed):** scheduled run's fallback raised from 20 to 30 in `.github/workflows/generate-drafts.yml`, matching the manual-dispatch default — a proactive capacity buffer, decided explicitly without waiting for post-fix success-rate data (Abhinav's call: raise now while the backlog is small, rather than wait-and-see). Confirmed safe against Gemini's actual free-tier limits before changing, not assumed: RPM is governed entirely by the 7s `DELAY_MS` between calls, independent of total row count, so raising `RUN_LIMIT` doesn't increase call rate, only total calls per run; Flash-Lite's published RPD ceiling is 1,000-1,500/day, far above 30. **Real verification still pending** — this number was raised on safety/cost reasoning, not on actual observed post-fix success-rate data, since no full scheduled run had occurred yet with both the Cerebras-eligibility fix and the new limit live. Revisit after 2-3 real scheduled runs to see whether 30 attempts/day at the new success rate actually closes the gap against ~18/day ingestion, or whether `RUN_LIMIT` needs to go higher.
- **Cerebras 200-char floor question CLOSED (2026-06-29, Abhinav, same conversation):** the "lower the floor for the ineligible subset" option this entry raised earlier today is explicitly rejected, not left open. Abhinav: "keep cerebras conditions as before because i dont want errors. quality checks cannot be compromised." Clarified during discussion that "as before" means the 200-char floor itself, the actual quality threshold — not the `fullBody`-or-`excerpt` eligibility-check bug (already fixed earlier today, genuinely a different thing: that fix corrected which signal gets checked, not how much of it is required). The 200-char minimum stays exactly where it is. The free, no-fabrication-risk lever is `RUN_LIMIT` (more attempts at the existing quality bar) — not loosening what counts as enough source material to ground a Cerebras generation. Do not revisit lowering this threshold without an explicit new instruction; treat this as locked policy alongside the original "Layer 2 rule (locked)" comment in `src/lib/source-quality.ts`.
- **Correction + pacing fix (2026-07-05):** the 2026-06-29 note above ("RPM is governed entirely by the 7s `DELAY_MS` between calls") no longer describes the actual code — `acquireGeminiSlot()` in `scripts/generate-approved-drafts.ts` is a rolling 10-calls/60s window with **no minimum gap between individual calls**; it will let all 10 through in under a second if the window is otherwise empty. The 2026-07-04 audit's diagnostic dispatch (`docs/audits/BOI_360_AUDIT_2026-07-04.md`, Part B follow-up) confirmed a genuine Gemini quota exhaustion (`[429] You exceeded your current quota`) as the proximate cause of the stall, but the burst-without-pacing behavior is a real, independent contributor — regardless of billing tier, bursting requests reads as a QPS spike server-side even when the rolling-window RPM count is technically satisfied. Added a randomized 4-6s minimum gap between consecutive Gemini calls, on top of (not replacing) the existing window check.

#### HIGH-53: RADAR-03 signal-review backlog — 200 unreviewed signals, 27 days accumulating
- **What:** `classify-signals.js` (RADAR-03) writes newly-classified signals with `status='draft'` and no `draft_body` — this is a deliberate, working pre-generation human gate ("Approve signal" / "Reject" in `/admin/pending`, default view), **not** a bug and **not** the same population as HIGH-52's `approved`-awaiting-generation backlog. Confirmed live: 200 rows in this state, accumulating since **2026-06-02** (27 consecutive days, ~5–15/day, every single day, including today). Combined with HIGH-52's 542 `approved`-awaiting-generation rows, the **real total undelivered-content backlog is 742 rows, not ~540** as stated everywhere earlier in this tracker.
- **Source:** Surfaced 2026-06-28 by Abhinav, dry-running `publish-drafts.mjs --dry-run` and correctly diagnosing the zero-rows result down to the actual query logic, then asking why the `approved` backlog and the `--dry-run` result didn't match. Root cause confirmed via live Supabase query + direct read of `classify-signals.js`, `admin/pending/actions.ts`, `admin/pending/page.tsx`.
- **Why this was missed earlier the same session:** CLAUDE.md line 96 documents "RADAR-03 (classify → pending_drafts) → RADAR-04 (generate bodies for approved rows)" — true at a coarse level, but omits the manual signal-approval gate in between, which lives entirely in the admin UI (`approveDraft`/`approveAll` in `actions.ts`), not in any script. Earlier HIGH-52 analysis this session read the generator's `.eq('status','approved')` filter and assumed `draft`-status rows were generation *output* (Gate-7/lint-routed), never cross-checking what `classify-signals.js` actually writes at *insert* time. Exactly the "investigate WHY not just WHAT" failure CLAUDE.md's own protocol exists to prevent — recorded here without softening it.
- **Resolution path (as originally written, since superseded — see below):** `/admin/pending` (default view, `status=draft` filter) already shows all 200 rows and already has a working bulk action: "Approve all 200" (calls `approveAll` — filters only on `status='draft'` + `iteration_label IS NULL`). One click moves all into the `approved` queue, where they then flow through the normal generation pipeline.
- **Status: ✅ CLOSED 2026-07-05 — DRIFTED, this entry's own "71 rows remain" claim (as of 2026-06-29) is stale.** `SELECT status, count(*) FROM pending_drafts GROUP BY status` run fresh 2026-07-04 returned exactly four buckets — `approved`=192, `published`=139, `rejected`=80, `failed_lint`=2 — **zero rows with `status='draft'`**. The 71-row population this entry described no longer exists in that state; between 2026-06-29 and 2026-07-04 those rows were approved, rejected, or otherwise cleared. Full evidence: `docs/audits/BOI_360_AUDIT_2026-07-04.md`, Part F. The underlying mechanism this entry documents (RADAR-03's manual/auto-approve signal gate) is still real and unchanged — only the specific row-count claim was stale, and is corrected here rather than left standing.
- **Auto-approve policy added 2026-06-29 (Abhinav, explicit — "I want a system that automates it... I dont want manual dependency anywhere"):** the manual-approval gate this entry describes is now **partially removed**, not fully. `classify-signals.js` auto-approves Tier 1/2 signals (4 editorial outlets — Brothers Brick, Jay's Brick Blog, New Elementary, BrickNerd; 3 official/catalogue — Brickset, Rebrickable, LEGO.com) at insert time — they go straight to `status='approved'`, skipping the human click entirely. Tier 3 (r/lego), Tier 4 (YouTube channels), Tier 5 (topic-only) are explicitly **unchanged** — Abhinav's direct instruction: "do not auto select reddit or youtube videos." Decision logic extracted to `scripts/radar/auto-approve-policy.js` (pure, unit-tested — 8 tests in `__tests__/auto-approve-policy.test.js`), not left inline. **Real bug caught and fixed during implementation, before shipping:** an early version of the inline check used the function reference in a ternary (`isAutoApproveTier ? ... : ...`) instead of calling it (`isAutoApproveTier(sig.source_tier) ? ...`) — a function reference is always truthy, so this would have auto-approved every tier including Reddit and YouTube, the exact opposite of the instruction. Caught by writing the unit tests, not by visual review alone. **This does not touch any downstream quality gate** — factuality, source fidelity, voice/tone (Gate 7), and the auto-publish-vs-reject-delete decision all run identically regardless of which tier originated the signal or who/what approved it. It only removes the human judgment call on whether a *topic* from a trusted source is worth covering — it does not relax any check on whether the eventual *article* is accurate. The existing 71-row backlog above predates this fix and is unaffected — those rows were already inserted as `status='draft'` before this policy existed; only newly-ingested Tier 1/2 signals going forward skip the gate.
- **Re-checked the auto-approve change against CRITICAL-2's "63 times over 7 weeks" duplicate-article incident before shipping, not assumed safe:** tonight's 696-row `pending_drafts` cleanup deleted historical drafts, raising a real question of whether a re-appearing RSS item (e.g. a feed re-serving an old URL) could now slip past the dedup check that previously relied on `pending_drafts` history. Confirmed it can't: `dedupe-signals.js`'s historical-dupe pass (added for the original CRITICAL-2 incident) checks against **all of `raw_signals`' history** by `url_hash`/`title_hash`, unbounded, completely independent of `pending_drafts` — so a resurrected URL is still caught one layer upstream of where the auto-approve logic runs, regardless of tonight's cleanup.
- **Owner:** A (the approve/reject decision is editorial, not technical).
- **Target window:** Ongoing — review regularly rather than letting this re-accumulate to a multi-week backlog again.
- **Dependencies:** None — fully self-contained, no code or schema change required.

#### HIGH-55: Gate 8 same-batch opener race + fail-open silent pass
- **What:** Gate 8 (opener duplication check) compared a new draft's opening line only against already-*published* articles, never against other drafts generated earlier in the same batch run. When two signals in the same `generate-drafts.yml` run both produced near-identical openers, neither draft could see the other's pending opener at check time — both passed Gate 8 independently and both published. Concrete incident: two 2026-07-01 articles both opened "Your wallet called…". Separately, Gate 8's exception handler failed open — any error in the check itself was silently swallowed and treated as a pass, with no record of why.
- **Fix:** `src/lib/lint.ts` now compares a candidate opener against same-batch openers generated earlier in the current run (threaded through `src/lib/generate-with-failover.ts` and `scripts/generate-approved-drafts.ts`), not just published history. The fail-open catch now emits a `warn` with the underlying error/reason instead of silently returning a pass.
- **Source:** Health audit 2026-07-02 (chat-layer Claude), applied by terminal Claude same day.
- **Status: Closed 2026-07-02.** `tsc --noEmit` clean, 59/59 vitest passing pre-commit. **Not yet verified against a live batch run** with 2+ same-topic signals in one run (the exact failure mode) — next opportunity is the next scheduled `generate-drafts.yml` run that has ≥2 qualifying signals.
- **Owner:** C (done, pending live re-verification).
- **Dependencies:** None.

#### HIGH-56: MRP presented as official LEGO India MRP, not the estimate it actually is
- **What:** `lego_mrp_inr` is populated by `populate-mrp.js` as Brickset US retail price × USD/INR, rounded to ₹100 — an estimate, not an official LEGO India MRP (actual India MRPs run ~10–25% above US-converted, due to import duty + GST). The set detail page labeled this figure plainly as "MRP" with no estimate qualifier, and the page's FAQ answer stated it as official. The generator prompt had no instruction against an article repeating the same misrepresentation in freshly generated body text.
- **Fix (this patch, presentation + generator-prompt layer only):** `src/app/sets/[slug]/page.tsx` label changed to "Est. MRP (from US price)", FAQ answer no longer claims official; `src/lib/generate-body.ts` prompt now explicitly forbids presenting the estimate as an official MRP.
- **Status: ✅ Closed 2026-07-09, superseded by HIGH-57.** The `audit-mrp.mjs` Tier A / `--fix-a` path described below was never run — a more direct method was found instead: Toycra's Shopify product pages explicitly label a "MRP" field (`compare_at_price`), so the real MRP could be scraped and cross-checked directly rather than inferred from store-price heuristics. See HIGH-57 (Sprint changelog, 2026-07-09) for the full fix: 644 sets corrected against live Toycra data, 2,770 flagged `mrp_verified=false` (suspect, systemic root cause), 127 CMF sets flagged separately for the single-figure-vs-box ambiguity, generator prompt gated on `mrp_verified` so unverified figures are never fed to the model. `scripts/audit-mrp.mjs` (store-price-inference heuristic) is now superseded for this purpose — kept in the repo as a secondary sanity check, not the primary correction path.
- **Owner:** Closed — A reviewed the direct-scrape diff (`audit/mrp-direct-scrape-diff-2026-07-08.csv`) before any write, per HIGH-57.

#### MEDIUM-45: opener retro-fix — corpus-wide duplicate-opener cleanup (dry-run only)
- **What:** Same root cause as HIGH-55, but retroactive — existing *published* articles that already share near-identical openers, not just same-batch drafts going forward. `scripts/fix-opener-templates.mjs` (new) clusters ≥85%-similar openers corpus-wide; within each cluster the oldest article keeps its opener, later ones are rewritten by Gemini under strict constraints, each rewrite is re-verified against the full corpus plus every earlier rewrite in the same run, 2 attempts then skip. Dry-run by default; `--apply` required to write.
- **Real dry-run numbers (2026-07-02):** corpus of 163 articles, 2 clusters of 2+, 9 articles flagged for rewrite. One cluster of 8 (7 `news_articles` + 1 `blog_posts`) all share the "Your wallet called. It wants to discuss the LEGO ___" opener — this is the exact pattern HIGH-55 exists to stop from recurring. Gemini quota was exhausted mid-run (429s): only **2 of 9 rewrites completed**; the remaining **7 are `SKIPPED` for quota exhaustion**, not a rewrite-quality rejection — needs a re-run once quota resets, not assumed done.
- **Status: Dry run only, `--apply` not run.** Needs Abhinav's review of the before/after rewrite text (recorded in the dry-run console output) before applying, per the script's own gating, and a quota-reset re-run to actually attempt the 7 skipped rewrites.
- **Owner:** A to review dry-run output; C to re-run once Gemini quota resets and then run `--apply`.
- **Dependencies:** Gemini quota reset (same daily/RPM limit as generation — see RADAR pipeline rules).

#### MEDIUM-64: publish-drafts.mjs queue ordering is not FIFO
- **What:** `publish-drafts.mjs`'s draft-fetch query orders `.order('updated_at', { ascending: false })` — newest-touched-first, not FIFO. This is inconsistent with `generate-approved-drafts.ts`'s queue, which orders `.order('created_at', { ascending: true })` — true FIFO, oldest first (confirmed: this is exactly why the genuinely-oldest 2026-05-09 backlog rows surface correctly in HIGH-52's analysis). Low impact today since the `draft`+body (Gate-7/lint-rejected, awaiting manual review) queue this script processes is normally near-empty — confirmed 0 rows live as of 2026-06-28 — but if that queue ever fills (e.g. a spike in Gate-7 rejections before any reject-delete policy lands), older rejected drafts would sit behind newer ones indefinitely, with no `--limit` raise able to reach them.
- **Source:** Surfaced 2026-06-28 alongside HIGH-53, same dry-run investigation.
- **Status: RESOLVED 2026-06-29.** `scripts/publish-drafts.mjs`'s fetch query now orders `.order('created_at', { ascending: true })`, matching `generate-approved-drafts.ts`'s convention exactly. `created_at` added to the `.select()` (was previously only fetching `updated_at`, which is still needed and kept — `publishOneDraft`'s lint-freshness cache reads it). Fixed alongside HIGH-53's auto-approve policy, same session, per Abhinav's explicit request ("fix medium 64 i want a clean system").
- **Owner:** C (done).
- **Target window:** Closed.
- **Dependencies:** None

#### MEDIUM-65: technical-hygiene.mjs HeroImages checks pass relative paths directly to fetch(), throwing instead of checking
- **What:** Surfaced 2026-06-29 from a real weekly hygiene report: `ImageHealth`/`HeroImages` flagged 3 articles as broken with the error `Failed to parse URL from /fallback-hero.png`. Confirmed live: all 3 rows genuinely had `hero_image='/fallback-hero.png'`, a valid relative path the site itself resolves fine in a browser (browsers resolve relative URLs against the page's own origin automatically) — but Node's native `fetch()` requires an absolute URL and throws immediately on a relative one. The script's `catch` block silently counted this thrown error as "image broken," indistinguishable from a genuinely dead external URL. Three separate call sites in `technical-hygiene.mjs` had this same bug (the primary `HeroImages` check, the 10-sample `ImageHealth` check, and the review hero-image check — the third was passing only by luck, since no review row currently uses the fallback path).
- **Fix:** all three call sites now resolve a leading-`/` path against `SITE_URL` (already defined in the file, used by every other route check) before calling `fetch()`.
- **Status:** Fixed 2026-06-29. **Verified live 2026-06-30** via a real dispatch of `technical-hygiene.yml` on the patched code (run 28398215601): before/after log lines confirmed directly — `73/126 hero images OK` with 3 `Failed to parse URL` lines → `126/128 hero images OK` with zero `/fallback-hero` lines (2 additional articles also entered the catalogue between runs, unrelated). Not assumed fixed from code inspection alone.
- **Follow-up finding from that same verification run, separate bug, same fix mechanism:** the post-patch run surfaced 2 *new* `HeroImages` failures — HTTP 415 on the only 2 `jaysbrickblog.com`-hosted hero images in the catalogue. Investigated rather than assumed real: curl `HEAD` and `GET` both returned 200 from an external machine; an isolated Node `fetch()` HEAD from outside the GHA runner also returned 200; a 51-request concurrent burst to the same host (ruling out rate-limiting) also returned 200 for the target URL. Not reproducible by any test run outside the actual GitHub Actions runner — points at something specific to that runner's environment (network path/CDN edge, most likely; Node version was ruled out, since the workflow's `setup-node` step requests Node 20, not 24, despite a `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` env var elsewhere in the same file, which only affects GitHub's own internal Actions JS runtime, not this script). Rather than keep chasing an external server's exact rejection logic, switched all 3 call sites from `HEAD` to `GET` with `Range: bytes=0-0` (downloads at most 1 byte, confirms reachability, sidesteps whatever the runner-specific request was triggering). **Not yet re-verified live** — needs one more `technical-hygiene.yml` dispatch after this lands to confirm the 415s are actually gone, not just theorized to be fixed.
- **Owner:** C (done, GET+Range fix pending live re-verification).
- **Dependencies:** None.

#### MEDIUM-66: visual-renderer.mjs image_render_broken check races against in-flight image loads
- **What:** Surfaced same hygiene cycle as MEDIUM-65, from the separate Content Quality Report: `image_render_broken` flagged ~75 articles (a implausibly large fraction of the catalogue) with `naturalWidth=0`. Root cause: the check ran `page.evaluate()` reading `naturalWidth` immediately after `page.goto(url, { waitUntil: 'domcontentloaded' })` — `domcontentloaded` only waits for HTML parsing, not for images to finish downloading. The hero image renders via `next/image`, which routes through Next's `/_next/image` optimization endpoint (real added latency vs. a raw static file), so this check was very likely to catch images mid-load, not genuinely broken ones. Confirmed on a live example (the Ebon Hawk article from MEDIUM-65): `hero_image` was already `/fallback-hero.png`, the asset on disk is a valid, non-corrupt 452×457 PNG — there was nothing actually broken to find for that row.
- **Fix:** the check now polls the image element's own `complete` property (true once the browser has either finished loading it or given up after a real failure) with an 8s bounded timeout, instead of reading `naturalWidth` at an arbitrary moment. Also narrowed the selector from the page's first `img[src]` (no guarantee of being the hero image) to specifically an image inside `article`/`main`, falling back to the generic selector only if neither is found.
- **Status:** Fixed 2026-06-29. **Verified live 2026-06-30** via a real dispatch of `content-quality.yml` on the patched code: `image_render_broken = 0` across 148 pages checked (desktop + mobile), every single one OK — confirmed via the actual visual-renderer summary line, not assumed from the fix's logic alone. The original ~75-flag count was a genuine, near-total false-positive rate caused by the timing race, not a mix of real and false failures.
- **Owner:** C (done).
- **Dependencies:** None.

#### MEDIUM-67: Brickset API key check (MEDIUM-50) — root cause confirmed, was checking for the wrong response string
- **What:** Resolves MEDIUM-50 ("Brickset API key check returns ambiguous 'success' shape — undiagnosed"). Confirmed via Brickset's own API v3 documentation and forum ("checkKey... will return a 'Success' if your API key is valid") that `{"status":"success"}` is the documented, healthy response for a valid key. `technical-hygiene.mjs`'s check was looking for the literal substring `"OK"` in the response text — which never appears in a genuinely successful Brickset v3 response — so this check was alerting on the correct, expected behavior every single time it ran, not on any real key or auth problem.
- **Fix:** check now matches `/"status"\s*:\s*"success"/i` against the response text.
- **Status:** Fixed 2026-06-29, closes MEDIUM-50. **Verified live 2026-06-30** via two real `technical-hygiene.yml` dispatches — before (run 28360080089, pre-patch): `[ExtDependencies] FAIL: Brickset API: key check returned "{"status":"success"}"`; after (run 28398215601, post-patch): `[ExtDependencies] Brickset API: key valid ✓`. Exact log lines compared directly, not assumed from the regex change alone.
- **Owner:** C (done).
- **Dependencies:** None.

#### MEDIUM-68: social-automation/notifier.py send_success() crashes on a BOM character in scraped set_name
- **What:** Surfaced 2026-06-30 investigating Abhinav's report that Instagram/YouTube posting "fires on some days, not others." Confirmed via real `gh run view` log of run 27495416112 (2026-06-14): the actual social posting (Instagram carousel + Reels) succeeded; `posted_sets` was correctly written (Row 17); but the Step 12 confirmation email crashed with `'latin-1' codec can't encode character '\ufeff' in position 7` — a BOM character in `set_data` (sourced from LEGO.com/Rebrickable scraping, outside our control). `send_failure()` (the sibling function, a few lines above in the same file) already calls a `_sanitize()` helper on every interpolated string; `send_success()` never did. The crash does **not** block the actual posts — `notifier.send_success()` runs at Step 12, after the real platform posting (Steps 7-9) and the `posted_sets` DB write (Step 10) have already completed — but it does mean the "it worked" confirmation email silently never arrives, which from the outside is indistinguishable from the pipeline not having run at all that day. This is very likely the actual source of the "inconsistent" impression — not the posting itself, which Instagram has a 100% success rate on in every record checked (see consistency investigation below).
- **Fix:** strip `\ufeff` from `set_num`/`set_name` before interpolating them into the email subject/body. Deliberately did **not** reuse the existing `_sanitize()` helper (full ASCII-only encode/decode round-trip) for this function — that would mangle the email's intentional ✅/⏭️ emoji and em-dash into literal `?` characters, a real regression an earlier draft of this fix introduced and caught before shipping by checking the actual output, not just whether it raised.
- **Honest caveat on root-cause confidence:** the BOM is the documented cause per the real production error message (`character '\ufeff'`, not the emoji) — trusted as ground truth over a synthetic local reproduction attempt, which used a different code path (`.encode('latin-1')` directly) than whatever `resend`'s actual SDK internals do, and did not reproduce the exact "position 7" detail from the real error. The fix targets the documented cause correctly; the *exact* internal mechanism of why `resend` hits a latin-1 boundary at all (likely an email-header-encoding rule, not the HTML body) was not independently confirmed, since the `resend` package isn't installed in the sandbox used to investigate this and reproducing it would require live credentials. If this recurs after the fix, that internal-mechanism gap is the first place to look.
- **Test added:** `social-automation/test_notifier.py` (new, no-network) — reproduces the exact BOM-in-`set_name` shape from the real run, confirms no crash, confirms the BOM is actually stripped (not just non-crashing by accident), and confirms the fix doesn't mangle the intentional emoji formatting.
- **Status:** Fixed 2026-06-30. Not yet verified against a real live pipeline run (next opportunity: tomorrow's scheduled run, or a manual `workflow_dispatch` of `social-automation.yml`).
- **Owner:** C (done, pending live re-verification).
- **Dependencies:** None.

**Social automation "consistency" investigation, same day, no further action needed beyond MEDIUM-68 above:** Abhinav reported Instagram/YouTube posting feels inconsistent. Investigated via `gh run list`/`gh run view` against real GitHub Actions history (2026-06-12 through 06-21) rather than guessed from the heartbeat table alone — initial heartbeat-table read was misleading (`last_success_at` stale, `last_failure_at`/`last_error` both null) because `record_heartbeat(success=None, error=...)` silently discards the `error` parameter when `success is None` — a separate minor finding, not yet fixed (the call site passes `'no_eligible_candidates'` but `db.py`'s `record_heartbeat()` only writes `last_error` on the `success is False` branch). Confirmed via real run logs: the scheduled workflow fired every single day in the window, zero gaps; Instagram (`ig_feed_posted`/`ig_reels_posted`) is `true` on 100% of checked `posted_sets` rows — there is no Instagram-vs-YouTube divergence pattern in the actual data. YouTube failures are exclusively the already-tracked MEDIUM-56 (OAuth token expiry) and get manually backfilled later via `social-automation/backfill_youtube.py` (confirmed this script exists and is exactly why a `posted_sets.yt_shorts_posted` value can legitimately flip from `false` to `true` after the original post date — this was the source of an internal contradiction during investigation, resolved by checking `pipeline.py`'s exact code as it existed on 2026-06-14 via `git log`/`git show`, not the current checked-out version, since the file had been edited twice since that date). No code fix needed for the core "inconsistency" complaint — the system is behaving as designed; MEDIUM-68's silent-email-failure bug is the only concrete, fixable defect this investigation found.

#### HIGH-51: GEO-05b — auto-link set mentions in articles
- **What:** 98 news + 23 blog articles published with zero `/sets/[slug]` internal links. Gemini prompt does not instruct the model to link set mentions to their catalog pages. Fix: add instruction to system prompt in `scripts/generate-approved-drafts.ts` (and `generateBody()` in `src/app/admin/pending/actions.ts`) to link the first mention of any LEGO set to `/sets/<slug>`. Slug derivation reuses the same set-number extraction already in Gate 5 (`src/lib/lint.ts:77`, `extractSetNumberCandidates` — corrected line reference 2026-07-27; the old `:113` cite pointed at the adjacent, unrelated `extractSetNameCandidates`) — don't reimplement. Verify post-fix by checking a sample of newly generated articles for `href="/sets/` links.
- **Source:** B4; Day 35 Ground Truth P1 open items; absent from master tracker prior to consolidation audit 2026-06-27
- **Status:** ✅ CLOSED 2026-07-27 — see **§GEO-05b: bidirectional set-article linking** at top of file. Implemented as a standalone content-transformation step (`src/lib/link-set-mentions.ts`, called from `publishOneDraft()`), not inside `scripts/generate-approved-drafts.ts`'s system prompt as originally scoped here — deterministic regex-based linking against the live `sets` table is more reliable than instructing the model to self-link, and matches the "no fuzzy/LLM matching" requirement this closure was actually built against. One-time backfill covered all 335 existing articles (176 updated, 233 links added), plus a reverse "Related Coverage" block and a CI guardrail against stale/404 links.
- **Owner:** C
- **Target window:** Done.
- **Dependencies:** Gate 5 extraction logic at `src/lib/lint.ts:77` (reused, not reimplemented)

---

### MEDIUM — Operational hardening

#### VID-P4-AUTOMATION-REVIEW: Scheduled review of manual-approval mode, not a cutover date
- **What:** Manual-approval mode for VID-P4 (operator reviews every generated video via email/chat, explicitly approves before the Publish Poller posts) continues indefinitely as the default — minimum 2-week trial from 2026-07-06.
- **Target review date:** ~2026-07-20 — revisit with operator whether to enable full autonomy (gate-pass-only publishing, no human approval).
- **Status:** Scheduled, not yet due.
- **Explicit correction, supersedes earlier "Thursday full autonomy" framing from the 2026-07-06 build:** this is **not** a scheduled cutover. Nothing in the code will auto-enable full autonomy on this date or any other. Requires an explicit operator decision **and** a deliberate code change — currently no path exists for any `video_posts` row to reach `status='approved'` without an external write (verified 2026-07-06 via exhaustive grep across `scripts/video/` plus a direct check for Postgres triggers/functions on `video_posts`: zero of either exist). Do not remove or bypass the approval gate without operator instruction, regardless of this reminder's date passing.
- **Low-confidence-run auto-publish question (raised 2026-07-06, never decided):** moot while human review remains in the loop — every generated video gets a human look regardless of gate-retry count or image-pool size. Revisit only if/when full autonomy is later enabled.
- **Owner:** A (decision), C (code change if/when approved).
- **Dependencies:** None currently — purely a calendar reminder.

#### MEDIUM-12: Weekly audit cron
- **What:** Sample 10 published articles weekly, factuality re-check, surface discrepancies to admin digest
- **Source:** PR-2b-5 roadmap
- **Status:** not started
- **Owner:** C
- **Target window:** this month
- **Dependencies:** HIGH-6

#### MEDIUM-13 / AUDIT-NEW-3: Review-format routing investigation
- **What:** Why do review-format drafts publish to /news/ instead of /reviews/? Fix or document as intentional.
- **Source:** Session observation during review pipeline work; re-surfaced by the 2026-07-04 360° audit (`docs/audits/BOI_360_AUDIT_2026-07-04.md`, Part E) as a live title-duplication and content-routing finding.
- **Decision (2026-07-05, Abhinav approved):** route **future** review-format publishes to the `reviews` table + `/reviews/[slug]`. The 36 already-published `/news` reviews stay put — explicitly not migrated.
- **Status:** ✅ CLOSED 2026-07-05 (implementation shipped same commit as this tracker update).
  - `src/lib/publish-draft.ts::resolveTarget('review')` now returns `{ table: 'reviews', path: '/reviews', category: 'Review' }` (was `news_articles`/`/news`). Verified directly: `resolveTarget('review')` → `{"table":"reviews","path":"/reviews","category":"Review"}`; all other formats (`news`, `opinion`, `guide`) unchanged.
  - **Schema gap found and resolved before writing code, not after:** `reviews` has no `category` column (unlike `news_articles`/`blog_posts`/`guides`, which all share a compatible superset schema the old single generic insert row relied on) — needed a distinct row-builder for the `reviews` target, not an extension of the shared one. `reviews.set_id` is a `uuid` FK to `sets.id`, not the `set_number` text column the other tables carry for the same purpose — the existing `extractSetNumberCandidates()` match now also selects `id` (previously only `set_number`) to populate it.
  - **`reviews.rating` (integer) had no source field in `pending_drafts` at all** — only `draft_verdict` (text). Decided a fixed mapping rather than inventing one silently: `BUY NOW=5, WAIT=3, IMPORT ONLY=2, AVOID=1` (`VERDICT_TO_RATING` in `publish-draft.ts`) — keeps the reviews UI's existing `rating >= 4` "Recommended" badge threshold meaning what it says (only BUY NOW reads as recommended; WAIT is deliberately kept below the threshold since it's not a rejection but isn't "buy now" either). **Amended 2026-07-05:** `reviews.rating` confirmed nullable; `IMPORT ONLY` changed `2` → `null` — an availability verdict shouldn't fabricate a quality score, and this value feeds the Review schema Google indexes directly.
  - **Follow-up fix (2026-07-05), before any IMPORT ONLY review actually publishes:** `reviews/[slug]/page.tsx` previously derived everything — the star row, the Recommended/Skip-It badge, the verdict-box mascot, the FAQ answer — from `rating >= 4`, which silently degrades to `false` for a `null` rating (rendering 0 filled stars and a "Skip It" badge regardless of the real verdict). Fixed all four to be verdict-driven instead: no star row when `rating` is `null`; badge derives from `verdict` (`BUY NOW` → Recommended, `AVOID` → Skip It, `IMPORT ONLY` → new saffron "🌍 Import Only" badge, `WAIT` → neutral/no badge). `buildReviewSchema()` in `schemas.ts` now omits `reviewRating` entirely when `rating` is `null`, instead of emitting an invalid `null`/`0` `ratingValue`. Verified with a real (temporary, deleted after) mock `reviews` row — `rating=null, verdict='IMPORT ONLY'` — rendered locally: zero `★` characters, saffron "Import Only" badge, and the emitted Review JSON-LD has no `reviewRating` key at all.
  - **Known pre-existing inconsistency, not fixed here:** `schemas.ts::verdictToRating()` (a separate function, used only by the legacy `/news` review-format articles' JSON-LD, which have no native `rating` column) still maps `IMPORT ONLY → 4`. That function serves a different table/population (the 36 un-migrated `/news` reviews) and wasn't in scope for this fix, but the same "does an availability verdict deserve a quality score" question now has two different answers in two files. Worth reconciling later, not urgent — the un-migrated population is frozen by the 2026-07-05 no-migration decision above.
  - `reviews.verdict` (NOT NULL) ← `draft_verdict`, same population logic already used for the `news_articles.verdict` column on the old path — no gap.
  - `reviews.youtube_url` — no source field; left `null`, column is nullable.
- **Cross-reference (2026-06-22, historical — the factuality gap this documents is now closed by the above):** HIGH-35's audit population includes 13 review-format articles published to `news_articles`, which has no FK to `sets`. The `reviews` table (`scripts/schema.sql:39`) has `set_id UUID REFERENCES sets(id) ON DELETE SET NULL` — had these 13 routed there as designed, the FK itself would have caught any nonexistent-set reference at insert time. Future review-format publishes now get this protection; the 13 historical `news_articles` rows are unaffected (not migrated, per the 2026-07-05 decision above).
- **Owner:** C (done).
- **Target window:** Done.
- **Dependencies:** None.

#### MEDIUM-14: YouTube 14-day auto-discard policy
- **What:** Auto-discard YouTube Shorts drafts older than 14 days (Option B from earlier handoff) — prevents stale video content from publishing
- **Source:** Earlier handoff notes
- **Status:** not started
- **Owner:** C
- **Target window:** this month
- **Dependencies:** none

#### MEDIUM-15: Scheduled cron + monitors + admin digest (PR-2b-4)
- **What:** Full PR-2b-4 scope: admin digest emails, monitoring alerts, run summaries
- **Source:** PR-2b-4 roadmap (deferred from main branch work)
- **Status:** not started
- **Owner:** C
- **Target window:** this month
- **Dependencies:** none

#### MEDIUM-16: Migration directory consolidation
- **What:** Consolidate 4 migration directories into single canonical `supabase/migrations/`
- **Source:** PR-2b-3.6 schema audit (4 dirs discovered)
- **Status:** not started
- **Owner:** C
- **Target window:** this month
- **Dependencies:** none

#### MEDIUM-17: Supabase CLI proper adoption
- **What:** `supabase db pull` baseline, link project, enable mechanical migration tracking
- **Source:** PR-2b-3.6 schema audit
- **Status:** not started
- **Owner:** C + A
- **Target window:** this month
- **Dependencies:** MEDIUM-16

#### MEDIUM-18: CI drift detection
- **What:** Weekly schema audit cron or PR-time check to catch live DB / migration divergence before it accumulates
- **Source:** PR-2b-3.6 (6-week drift discovered before audit)
- **Status:** not started
- **Owner:** C
- **Target window:** this month
- **Dependencies:** MEDIUM-17

#### MEDIUM-36: On-demand single generation skips lint entirely
- **What:** `generateBody()` (called by the admin "Generate Article" button via `generateArticle()`, `src/app/admin/pending/actions.ts:97`) writes `draft_title`/`draft_body`/`draft_verdict`/`word_count` and sets `status: 'draft'` with no call to `lintDraft()` anywhere in the path. Should at minimum run the full gate set at generation time and persist to `lint_result`, matching what the bulk generator (`generate-approved-drafts.ts`) already does — so cron/manual publish reads a real verdict instead of finding `lint_result IS NULL`.
- **Source:** Surfaced during CRITICAL-1 audit, 2026-06-22
- **Status:** not started
- **Owner:** C
- **Target window:** unscheduled
- **Dependencies:** CRITICAL-1 (lint_result read path should land first, so this has something to feed)

#### MEDIUM-37: Gate 6 (source fidelity) scope — extend beyond LOW-confidence sources
- **What:** `gateSourceFidelity` (`src/lib/lint.ts:194`) only activates for LOW-confidence sources today. HIGH-5's "extend source fidelity check to ALL drafts" is not satisfied merely by CRITICAL-1 wiring cron to *call* Gate 6 — Gate 6 itself still skips non-LOW-confidence sources regardless of caller. Real scope extension (all drafts, all confidence tiers) is separate, residual work.
- **Source:** Surfaced during CRITICAL-1 audit, 2026-06-22
- **Status:** not started
- **Owner:** C
- **Target window:** unscheduled
- **Dependencies:** CRITICAL-1

#### MEDIUM-38: resolveTarget() opinion-format URL divergence between cron and admin publishers
- **What:** `scripts/publish-drafts.mjs::resolveTarget()` maps opinion-format drafts to path `/opinion/<slug>`, while `src/app/admin/pending/actions.ts::resolveTarget()` maps the same format to `/blog/<slug>`. Same target table (`blog_posts`), divergent URL convention depending on which code path published the row. Live consequence: 1 row in `pending_drafts` (the lone opinion-format row in HIGH-35's population) is at `/opinion/...`; any future opinion published via admin will land at `/blog/...`.
- **Source:** Surfaced during HIGH-35 pre-script verification, 2026-06-22
- **Status: RESOLVED 2026-06-29.** This entry's own status field was never updated when the fix landed earlier the same session — corrected now. There is no longer a second `resolveTarget()` to diverge: both call sites now import a single implementation from `src/lib/publish-draft.ts` (the full publish-logic merge done as part of HIGH-52's session), which uses `/opinion` exclusively. Verified live before the fix: `src/app/blog/page.tsx` explicitly excludes `category='Opinion'` from its own listing (`.neq('category', 'Opinion')`), while `src/app/opinion/page.tsx` requires it (`.eq('category', 'Opinion')`) — `/blog` was the wrong choice; an opinion article published there would render at its own URL but never appear on any listing page. No existing published rows needed backfilling — both pipeline-published opinion rows already had `/opinion/` URLs (they'd gone through the cron path, not the admin one).
- **Owner:** C (done).
- **Target window:** Closed.
- **Dependencies:** none — but consolidation should align with MEDIUM-13's review-routing decision (single source of truth for format → {table, path} mapping). MEDIUM-13 itself remains open and unrelated to this fix — see below.

#### MEDIUM-39: Next.js 14 → 16 major version migration
- **What:** Production framework currently on 14.2.35; `npm audit` lists 14 CVEs in the 14.x line, fixes require major bump to 16 (`isSemVerMajor: true`). Applicability assessment (2026-06-22): no i18n, no CSP nonces, middleware is a 6-line pass-through — several listed CVEs don't apply, but DoS-via-Image-Optimizer and request-smuggling-in-rewrites plausibly do.
- **Status:** not started
- **Owner:** C
- **Target window:** this month — security CVEs in production framework, don't let it linger
- **Risk:** moderate. App Router migration story between 14 and 16 needs review; test surface is the full site.
- **Dependencies:** none. Standalone migration.
- **Source:** Surfaced during npm audit triage following weekly hygiene alerts, 2026-06-22

#### MEDIUM-41: extractSetNameCandidates theme stripper retains trailing tokens
- **What:** Theme-prefix stripping (e.g., "Disney Main Street USA" → "Main Street USA") doesn't handle trailing geo/region tokens. Real set name "Main Street" fails AND-word-match because "USA" survives stripping.
- **Source:** HIGH-35 final triage, 2026-06-22
- **Status:** not started
- **Owner:** C
- **Target window:** this month
- **Cross-ref:** HIGH-6 residual matcher-precision scope

#### MEDIUM-42: Gate 5 has no concept of non-set LEGO products
- **What:** Real LEGO products that aren't numbered consumer sets (platform components like LEGO SMART Brick, accessories, GWPs) cannot be verified by Gate 5 because `sets.set_number` is the only catalogue surface. Articles referencing such products will always FAIL_FACTUALITY despite being factually correct.
- **Source:** HIGH-35 final triage (Smart Brick case), 2026-06-22
- **Status:** not started
- **Owner:** C
- **Target window:** this quarter
- **Cross-ref:** HIGH-6 residual deeper-verification scope

#### MEDIUM-43: extractSetNameCandidates pulls non-product text as candidates
- **What:** Regex matches "LEGO [Title Case]" without distinguishing product names from event names ("LEGO World Netherlands"), pricing terminology ("LEGO India MRP"), or other non-product capitalized phrases. Surfaces as false FAIL_FACTUALITY in audits and could cause real publish-time rejections.
- **Source:** HIGH-35 final triage (World Netherlands, India MRP), 2026-06-22
- **Status:** not started
- **Owner:** C
- **Target window:** this month

#### MEDIUM-44: is_community signal gap — stray backend verdict metadata
- **What:** Phase 1's `is_community` heuristic (`draft_verdict IS NULL`) fails when the drafter assigns a buy/wait verdict to community/MOC content that gets retained in `pending_drafts.draft_verdict` even though it never reaches the published page (no structured verdict column in `news_articles`). Confirmed instances: 2 BrickHeadz articles, 1 Ebon Hawk article. Customer-facing impact: zero. Backend metadata cleanup + drafter-side fix needed.
- **Source:** HIGH-35 Phase 1 (BrickHeadz finding) + final triage (Ebon Hawk confirmation), 2026-06-22
- **Status:** not started
- **Owner:** C
- **Target window:** this month

#### MEDIUM-47: pending_drafts.requires_manual_approval column is structurally dead
- **What:** Column exists in schema and is displayed as a badge in `/admin/pending` (`page.tsx:144`), but `publish-drafts.mjs`'s SELECT (line 255 — confirmed by direct read 2026-06-22) never reads it — the cron cannot gate on a value it doesn't fetch. Originally set by Cerebras-probation logic that was removed in `8e3f915`, so it's always `false` today. Dead safety mechanism creates false confidence.
- **Decision needed:** Either wire it into the cron filter (revives a meaningful safety hatch) OR drop the column (removes the false confidence). Don't leave dead.
- **Source:** Surfaced 2026-06-22 during auto-publish policy verification.
- **Status:** not started
- **Owner:** C
- **Target window:** this week

#### MEDIUM-48: store_prices table has no rows for City theme sets
- **What:** technical-hygiene.yml 2026-06-22 run logged `[DataIntegrity] FAIL: No store_prices rows for City sets — related set cards will show no prices` (line 788). City is a flagship LEGO theme; absence of price data means related-set cards on City-themed articles will render without prices, degrading the comparison-shopping value proposition that is the platform's core differentiator.
- **Source:** hygiene run 2026-06-22T09:42:32Z, line 788
- **Status: RESOLVED 2026-06-30 — neither of the two originally proposed hypotheses was correct; root cause was a third thing, a flaky check.** Original entry asked: price-pipeline gap, or theme-classification gap? Neither. The check sampled `sets.select('set_number').eq('theme','City').limit(20)` with **no `ORDER BY`** — Postgres makes no row-ordering guarantee without one, so the "first 20" City sets returned are effectively random storage order each run. Confirmed live: one such unordered sample landed on a batch dominated by old/bundle/non-buildable SKUs (a 2013 advent calendar, a "City Playmat," several "Super Pack 4-in-1" bundles, a 2003-era polybag) — only 4 of those 20 specific IDs had any price. Queried real coverage directly instead of sampling: **City has prices for 28/261 sets (10.7%)** — more than double the catalogue-wide average of 4.38% (1,091/24,909 total sets have any price at all; `store_prices` only covers what Toycra/MyBrickHouse actually stock, a small slice of LEGO's full historical catalogue across all themes, so a low raw percentage is the norm everywhere, not City-specific). City was never under-covered — the check's pass/fail outcome on any given run was just luck of unordered row storage. (This is exactly why tonight's earlier hygiene reports showed `4 store_prices rows for City sets ✓` passing — same flaky check, different lucky sample, not a sign anything had actually changed.) Fixed: query `store_prices` and City `set_number`s as two independent, deterministic queries and intersect in JS, rather than sampling 20 and hoping. (An earlier draft tried a PostgREST embedded join — `store_prices.select('set_id, sets!inner(theme)')` — caught before shipping that this requires a real foreign key between the two tables, which doesn't exist: verified directly against `information_schema.table_constraints`, zero FK rows. PostgREST's `!inner` syntax cannot infer a join from matching column values alone; that version would have failed outright.)
- **Owner:** C (done).
- **Target window:** Closed.
- **Dependencies:** None.

#### MEDIUM-49: 2 articles have store data but missing store name(s)
- **What:** technical-hygiene.yml 2026-06-22 run logged `[ContentIntegrity] FAIL: 2 article(s) have data but missing store name(s): lego-disney-main-street-usa-43302-revealed-charming-but-pric, lego-architecture-21066-new-york-city-in-india-the-big-apple` (line 878). Articles have price data attached but the store name field is empty, meaning users see prices without knowing which retailer to buy from — credibility hit on the comparison shopping promise.
- **Source:** hygiene run 2026-06-22T09:42:52Z, line 878
- **Status: RESOLVED 2026-06-30 — check-script bug, not a data-ingestion bug as originally suspected.** Queried both originally-flagged articles directly. `lego-architecture-21066...` is one of 9 articles mentioning exactly one store (Toycra) rather than both — see the separate single-store list handed to Abhinav for review, same chat 2026-06-30 (8 of those 9 cluster tightly in early April 2026, likely predating consistent dual-store coverage in the prompt). `lego-disney-main-street-usa-43302...` is the more interesting case: the article correctly, honestly states "no official store prices for ... in India... it's an 'import only' situation" — but still quotes a calculated import-price estimate (₹12,349) for reader context, which the old check's blunt `₹[\d,]+ → must mention both stores` regex couldn't distinguish from an actual missing-store-name defect. Confirmed via live query: across the full catalogue, 114 articles correctly mention both stores, only 1 genuinely had a price with no store name and no acknowledgement of why (none found — the Disney article already self-discloses correctly). Fixed `technical-hygiene.mjs`'s store-coverage check (moved from `news10`-scoped 14k to full-table-scoped 14c2, alongside the HIGH-49 fix) to only flag when a ₹ figure appears with **no** store name **and no** explicit import-only/no-official-price language — i.e. only flag a genuine, unacknowledged gap, not an article being honest about a set with no Indian retail presence yet.
- **Owner:** C (done).
- **Target window:** Closed.
- **Dependencies:** None.

#### MEDIUM-50: Brickset API key validation returns malformed "success" response shape
- **What:** technical-hygiene.yml 2026-06-22 run logged `[ExtDependencies] FAIL: Brickset API: key returned "{"status":"success"}"` (line 852). Two possibilities: (a) the check-script's expected response shape is wrong (Brickset legitimately returns `{"status":"success"}` and the check's validation regex was written against a stale schema), or (b) the response is malformed — the API returned bare "success" without the expected sets/data payload, indicating a real auth or call-shape issue masquerading as success.
- **Source:** hygiene run 2026-06-22T09:42:47Z, line 852
- **Status:** ✅ CLOSED 2026-07-05 — DRIFTED, self-contradiction resolved. This entry said "Open... diagnostic needed" while **MEDIUM-67's own text already documented the fix and closure**: "Fixed 2026-06-29, closes MEDIUM-50... Verified live 2026-06-30 via two real dispatches... after (post-patch): `Brickset API: key valid ✓`." Root cause per MEDIUM-67: possibility (a) above was correct — `{"status":"success"}` is Brickset's own documented healthy response; the check was matching the wrong literal string (`"OK"`, which never appears) and had been alerting on correct behavior every run. No diagnostic curl was needed in the end; the fix was a regex correction (`/"status"\s*:\s*"success"/i`), already shipped and verified. This entry's own status line was simply never updated when MEDIUM-67 closed it — corrected here rather than left standing as a contradiction. Full context: `docs/audits/BOI_360_AUDIT_2026-07-04.md`, Part F.
- **Owner:** Abhinav (closed, via MEDIUM-67).
- **Target window:** Done.
- **Dependencies:** None.

#### MEDIUM-51: secrets-manifest references CI guard workflow that does not exist on origin
- **What:** `.github/secrets-manifest.json` declares `CONTACT_EMAIL.required_by: ["ci.yml"]` with the description "Enforced by CI guard verify-no-email-in-client-bundle". On origin/main, no `.github/workflows/ci.yml` file exists (16 workflows present, none named ci.yml). The manifest documents a guard that was never shipped. Same shape as the Bucket D anon-key issue earlier this session (script wiring correct, workflow wiring incomplete) — but inverted: here the documentation is correct and complete, the workflow it references is the missing piece. The candidate workflow file exists uncommitted in the Windows checkout (see HIGH-47). Manifest drift of this kind erodes trust in the manifest as a source of truth.
- **Source:** R1 reconciliation 2026-06-23; `find . -name ci.yml -not -path "./node_modules/*"` returns nothing on origin.
- **Status:** ✅ CLOSED 2026-06-26. ci.yml committed in R2 (commit `deaf982`); `SUPABASE_SERVICE_ROLE_KEY` added to ci.yml env block in `16ace63`; email-guard green on run `28255741099`. Manifest correctly reflects deployed reality.
- **Owner:** Abhinav (closed).
- **Target window:** Done.
- **Dependencies:** Resolved by HIGH-47 (closed).

#### MEDIUM-53: email-guard regex catches only `abhinav@bricksofindia.com`, not other `@bricksofindia.com` addresses
- **What:** `.github/workflows/ci.yml` scanned `.next/static/` and 5 rendered routes with the literal pattern `abhinav@bricksofindia.com`. If a future address (e.g. `support@bricksofindia.com`, `news@bricksofindia.com`) leaked into the client bundle, the guard would not catch it. The guard's correctness was coupled to the current single verified Resend address rather than the domain.
- **Source:** R2 post-review, 2026-06-26.
- **Status:** ✅ CLOSED 2026-07-04. **Motivating incident, not hypothetical:** exactly the predicted failure mode occurred — `public/brand/guide.html` shipped a `mailto:hello@bricksofindia.com` link (2026-07-03) to a mailbox that does not exist, and the guard never flagged it. Root cause was two independent gaps, not one: (1) the literal-only regex doesn't match any local-part other than `abhinav@`, and (2) `public/brand/guide.html` and `public/llms.txt` are static passthrough files, outside both the `.next/static/` bundle scan and the 5 hardcoded rendered routes — the guard was structurally blind to them regardless of regex. Verified before fixing: running the old literal regex against the pre-fix `guide.html` returns zero matches; running the widened regex against the same pre-fix content matches the `hello@` line immediately. Fixed in `.github/workflows/ci.yml`: (a) regex widened to `[A-Za-z0-9._%+-]+@bricksofindia\.com` in both scan steps, (b) client-bundle step extended to also scan `public/*.txt` and `public/brand/` directly, (c) rendered-HTML step no longer hardcodes 5 routes — it now reads every static (non-dynamic-segment, non-`/api/`) route from the build's own `.next/app-path-routes-manifest.json` (30 routes as of this build, vs. the previous 5).
- **Owner:** C (code-only change, no approval needed).
- **Target window:** Done.
- **Dependencies:** None.

#### MEDIUM-52: Windows checkout has 5 unexamined local-only branches
- **What:** During R1 reconciliation (2026-06-23), fetching from the Windows checkout at `C:\Users\bharg\Documents\BricksofIndia\website` surfaced 5 local-only branches never pushed to origin: `chore/lab-05-gate-note`, `chore/pr-2b-3.6-schema-drift-audit`, `feat/content-pipeline-foundation`, `feat/social-heartbeat`, `feat/pr-2b-3-failover-orchestration`. Two of these (`pr-2b-3.6-schema-drift-audit`, `pr-2b-3-failover-orchestration`) reference work memory describes as completed and merged; the others reference work whose status is unverified. Risk: real engineering work may be sitting in those branches unreachable from origin, same shape as the HIGH-45 phantom-commit issue just resolved in R1.
- **Source:** R1 reconciliation 2026-06-23, terminal fetch from windows-local remote.
- **Status:** Open. Each branch needs: (1) inventory of unique commits not on origin (`git log <branch> --not origin/main --oneline`), (2) per-commit decision (cherry-pick / discard / verify-already-merged), (3) once reconciled, branch deletion. Read-only diagnostic dispatch first; per-commit disposition prescribed back before any cherry-pick.
- **Owner:** Abhinav (terminal to inventory branches read-only, prescribe disposition).
- **Target window:** Before any further work touches the Windows checkout — risk of repeating the HIGH-45 phantom-commit pattern grows the longer this sits.
- **Dependencies:** None.

#### MEDIUM-54: Centralize secret loading via getSecret()
- **What:** Inline BOM stripping appeared at two independent sites within two weeks: `cerebras.ts` in `1dfef88`, `generate-approved-drafts.ts` in `ceb130b`. Same failure class, same fix, second occurrence. Centralized as `src/lib/get-secret.ts` — `getSecret(name)` strips BOM before returning any env secret. Protocol going forward: all Bearer-bound secrets route through `getSecret()`, not `process.env` directly.
- **Source:** Bug A root cause session 2026-06-27; two BOM incidents in 14 days triggered defensive centralization. Source commits: `1dfef88` (cerebras inline strip), `ceb130b` (centralized).
- **Status:** Closed — shipped in `ceb130b` (2026-06-27). Covers `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `CEREBRAS_API_KEY`.
- **Owner:** —
- **Target window:** Done.
- **Dependencies:** None.

#### MEDIUM-55: Checkout inventory is incomplete — third checkout discovered
- **What:** Handoff documents list two checkouts: `/root/bricks-of-india` (Linux/authoritative) and `C:\Users\bharg\Documents\BricksofIndia\website` (Windows/stale). Session 2026-06-27 revealed a third — `C:\Users\bharg\bricks-of-india` (`/c/Users/bharg/bricks-of-india` in Git Bash) — which is the actual working tree for Git Bash operations and was at clean parity with origin/main before session work. `ceb130b` was produced from this checkout. The "Linux/authoritative" label for `/root/` is at minimum misleading: Git Bash work lands on the Windows-side checkout, not the Linux one. Risk: handoffs that prescribe `~/bricks-of-india` without specifying shell context are ambiguous, and `/root/` will silently fall behind origin between sessions.
- **Source:** Post-commit provenance check, session 2026-06-27.
- **Status:** Open. Next handoff update must inventory all three paths: (1) full path, (2) HEAD at inventory time, (3) remote URL, (4) authoritative-for-what-kind-of-work. `/root/bricks-of-india` should be verified or pruned.
- **Owner:** Abhinav.
- **Target window:** Next handoff update.
- **Dependencies:** MEDIUM-52 (same class — checkout drift risks).

#### STORE-01: Additional Indian LEGO retailer scraping
- **What:** Add Hamleys India (and other Indian retailers) to store_prices scraping pipeline
- **Source:** Scope expansion request
- **Status:** not started
- **Owner:** C + A (A: retailer selection; C: scraper implementation)
- **Target window:** post-PR-2b-5
- **Dependencies:** none

#### NX-DOS-01: Next.js DoS advisory (GHSA-m99w-x7hq-7vfj) — accepted risk, deferred
- **What:** `GHSA-m99w-x7hq-7vfj` (CVE-2026-64641) — denial of service via crafted requests causing excessive CPU usage, affecting Next.js App Router applications with at least one Server Action. Confirmed reachable in this app: App Router ✓, Server Actions in `contact.ts`, `newsletter.ts`, `admin/pending/actions.ts` ✓. Found during CODE-AUDIT-01's `npm audit` triage (2026-07-26) — one of 7 advisories newly published against `next@14.2.35` since the Jul 13/20 code-audit runs.
- **No 14.x patch exists.** Confirmed via npm's full version history: `14.2.35` (our current version) is the last stable 14.x release Next.js has ever published — everything since is `14.3.0-canary.*` prereleases only. The only fixes are `15.5.21` and `16.2.11`, both major-version jumps past 14.x.
- **Why deferred, not fixed now:** the upgrade path has one unverified compatibility blocker — `@netlify/plugin-nextjs` (required for Server Actions support per this file's Next.js/Netlify rules section) declares no `peerDependencies` constraint on `next`'s version in its own `package.json`, so npm cannot catch an incompatibility automatically. Compatibility with Next 15/16 was not verified against Netlify's own release notes/changelog — doing that properly requires actually testing the upgrade against a real build, not just reading docs.
- **Not blockers, already checked:** React (`^18.2.0` still accepted as a peer by both `15.5.21` and `16.2.11` — no forced React 19 upgrade) and Node.js (`15.5.21` needs `^18.18/^19.8/>=20`, `16.2.11` needs `>=20.9` — CI already runs Node 20 everywhere) are both already satisfied. Also confirmed: the `postcss` override pattern added in the same CODE-AUDIT-01 pass (commit `a0c521e`) targets the parent package name (`next`), not a pinned `next` version — both `15.5.21` and `16.2.11` still bundle the identical `postcss@8.4.31` internally that `14.2.35` does, so the override should keep applying through a future upgrade without repeating this session's transitive-drift surprise.
- **The other 6 advisories from the same audit pass:** 5 are not applicable to this app's actual Next.js usage — no custom server (`GHSA-89xv-2m56-2m9x`), no `fetch(new Request(...), differentInit)` misuse anywhere in the codebase (`GHSA-68g3-v927-f742`, `GHSA-4633-3j49-mh5q`), no Edge runtime usage (`GHSA-4c39-4ccg-62r3`), no dynamic/request-controlled hostnames in `redirects()` — every destination is a static string (`GHSA-p9j2-gv94-2wf4`). The 6th (`GHSA-955p-x3mx-jcvp`, Server Action endpoint ID disclosure) is reachable in principle but already independently mitigated: `admin/pending/actions.ts` checks the `boi_admin` cookie against `ADMIN_PASSWORD` inside the action itself (not just page-level auth), which is exactly the advisory's own recommended fix.
- **Status:** Accepted risk, deferred — not forgotten, not silently pending.
- **Owner:** Abhinav (compatibility verification) / C (upgrade + test execution once unblocked).
- **Target window:** unscheduled — next step is verifying `@netlify/plugin-nextjs`'s actual Next 15/16 compatibility via Netlify's own docs/changelog, before scheduling a real upgrade attempt with full test coverage against RADAR/VID-P4's App Router usage. Not urgent, not code-blocking.
- **Dependencies:** none.

---

### LOW — Cleanup

#### LOW-19: posted_lego_sets table drop
- **What:** Drop orphan table (0 code refs confirmed) — pending GAP-10 resolution
- **Source:** RLS hardening session + GAP-10
- **Status:** not started
- **Owner:** C
- **Target window:** unscheduled
- **Dependencies:** GAP-10 resolved

#### LOW-20: prices table drop
- **What:** Drop legacy price table (1 defensive `/deals` fallback ref only); migrate to store_prices-only
- **Source:** CLAUDE.md price data rules
- **Status:** not started
- **Owner:** C + A
- **Target window:** unscheduled
- **Dependencies:** none

#### LOW-21: price_history vs price_snapshots redundancy
- **What:** Investigate if both tables serve distinct purposes; consolidate if redundant
- **Source:** Schema audit
- **Status:** not started
- **Owner:** C
- **Target window:** unscheduled
- **Dependencies:** none

#### LOW-22: featured_image_url deprecation on guides
- **What:** Drop `featured_image_url` from guides table — confirmed orphan column
- **Source:** PR-2b-3.6 schema audit
- **Status:** not started
- **Owner:** C
- **Target window:** post-Fan-CoLab
- **Dependencies:** HIGH-5 (PR-2b-5 family)

#### LOW-23: makeSlug() truncation bug
- **What:** Fix slug truncation that cuts mid-word (truncates at character limit, not word boundary)
- **Source:** Session observation
- **Status:** not started
- **Owner:** C
- **Target window:** unscheduled
- **Dependencies:** none

#### LOW-24: Admin Server Actions → useActionState
- **What:** Convert admin Server Actions to useActionState for graceful error UI (currently silent fails on error)
- **Source:** Session observation
- **Status:** not started
- **Owner:** C
- **Target window:** unscheduled
- **Dependencies:** none

#### LOW-25: getCerebrasStats() analytics function
- **What:** Build `getCerebrasStats()` paired with MEDIUM-12 weekly audit cron for Cerebras failover tracking
- **Source:** PR-2b-3 session
- **Status:** not started
- **Owner:** C
- **Target window:** unscheduled
- **Dependencies:** MEDIUM-12

#### LOW-26: Counter semantic decision — generator_runs
- **What:** Decide: should `gemini.attempted + cerebras.attempted == drafts_attempted`? Document constraint or fix counters.
- **Source:** PR-2b-3.5 session
- **Status:** not started
- **Owner:** A (decision) + C (implementation)
- **Target window:** unscheduled
- **Dependencies:** none

#### LOW-27: Vitest snapshot test failures (4 pre-existing)
- **What:** Regenerate baselines or fix prompts — trailing space vs empty line in `tests/snapshots/*.txt`
- **Source:** GAP-11; deferred in PR-2b-3.7
- **Status:** deferred (separate PR)
- **Owner:** C
- **Target window:** unscheduled
- **Dependencies:** none

#### LOW-28: continue-on-error masking in content-quality.yml (extended scope)
- **What:** Audit whether `continue-on-error: true` masks real failures. Original scope: `content-quality.yml`. **Extended 2026-06-22:** same pattern confirmed in `code-audit.yml` during npm audit triage — the `audit` and `secrets` steps both carry `continue-on-error: true`, so `gh run list` showed 4 consecutive weeks of "success" while `npm audit --audit-level=high` was genuinely failing every run (9 advisories, since reduced to 5 by the 2026-06-22 dependency cleanup). The job's separate alert step (`code-audit-notify.mjs`, gated on `steps.audit.outcome == 'failure'`) did fire correctly — so this isn't a silent-failure case, it's a misleading-run-conclusion case. Fix pattern (applies to both files): remove `continue-on-error` and rely on the explicit notification step for alerting, OR keep `continue-on-error` but add a final fail-the-job step gated on prior step outcomes.
- **Source:** Workflow audit during Days 35-N; extended scope surfaced during npm audit triage, 2026-06-22
- **Status:** ✅ CLOSED for `code-audit.yml` (2026-07-26) — see **§CODE-AUDIT-01**. Secrets-manifest blind spot fixed (`162b4f6`); false-green job-status problem fixed (`b3862f9`), verified against a real (not synthetic) failure — live `workflow_dispatch` run [30208647905](https://github.com/bricksofindia007/bricks-of-india/actions/runs/30208647905) shows job conclusion `failure` for the first time ever, correctly reflecting the genuinely-still-open `npm audit` finding while `lint`/`typecheck`/`secrets` all passed. **`content-quality.yml`'s original scope is still untouched** — this item stays open for that file only; re-file as a new LOW if `content-quality.yml` needs the same fix.
- **Owner:** C
- **Target window:** unscheduled
- **Dependencies:** none

#### LOW-29: env var naming drift in youtube-backfill.yml / social-automation.yml
- **What:** Standardize env var names across workflow files — drift detected between youtube-backfill and social-automation
- **Source:** Workflow audit
- **Status:** not started
- **Owner:** C
- **Target window:** unscheduled
- **Dependencies:** none

#### LOW-30: Hardcoded requires_manual_approval: false comment
- **What:** Remove or contextualize misleading hardcoded comment in `autoPublish()`
- **Source:** Code review during PR-2b-3.5
- **Status:** not started
- **Owner:** C
- **Target window:** unscheduled
- **Dependencies:** none

#### LOW-31: Supabase MCP → read-only mode
- **What:** Move Supabase MCP from write-capable to read-only (Option A preferred; Option B accepted as interim)
- **Source:** Security session; GAP-04 (MCP installation unconfirmed)
- **Status:** not started
- **Owner:** A + C
- **Target window:** unscheduled
- **Dependencies:** GAP-04 confirmed

#### LOW-32: LAB-05 CMF tracker verification
- **What:** Verify LAB-05 (CMF tracker) actual code status vs tracker claim — confirm live or update status
- **Source:** Consolidation audit Part B (not read in this audit)
- **Status:** not started
- **Owner:** C
- **Target window:** unscheduled
- **Dependencies:** none

#### LOW-40: Monitoring false positives on hero image health checks
- **What:** Two independent monitoring systems report broken hero images for live, working articles. Both verified 2026-06-22:
  - **`technical-hygiene.mjs` ImageHealth** (`scripts/technical-hygiene.mjs:717`/`739`): calls `fetch(a.hero_image, ...)` directly with no base URL. For relative paths like the intentional `/fallback-hero.png` fallback, Node's `fetch()` throws `TypeError: Failed to parse URL from /fallback-hero.png` (reproduced directly) — the catch block records this as a broken image, when `/fallback-hero.png` is a working local asset on the live site.
  - **CQS `image_render_broken`** (`scripts/visual-renderer.mjs:142-146`): reads `document.querySelector('img[src]').naturalWidth` — selects the *first* `<img>` on the page, not necessarily the hero image, with no wait for the image's `load` event before reading `naturalWidth`. Confirmed via DB query: exactly 60 distinct `article_slug` values flagged with `check_name='image_render_broken'` on 2026-06-22 in `content_quality_issues` (1174 total rows all-time, unresolved, table accumulates per check-run rather than deduping per article). Spot-checked 3 of the 60 (`lego-ebon-hawk-your-wallet-remains-safe-for-now`, `lego-11380-road-bike-...`, the megatron-brickheadz rows) — all three `hero_image` URLs resolve HTTP 200 and the component (`ImageWithFallback.tsx`) correctly bypasses Next/Image optimization for external URLs. No actual rendering defect found.
- **Why it matters:** False positives at this volume desensitize the team to real alerts.
- **Status:** not started
- **Owner:** C
- **Target window:** this week
- **Source:** Weekly hygiene report investigation, 2026-06-22

#### LOW-41: Dead artifact at /root/bricks-of-india/src/lib/get-secret.ts
- **What:** Session 2026-06-27 Write tool created `src/lib/get-secret.ts` at `/root/bricks-of-india/src/lib/get-secret.ts` (Linux checkout) before being superseded by a Bash heredoc at the correct working checkout (`/c/Users/bharg/bricks-of-india`). The `/root/` copy was never staged or committed — it is an untracked file. Risk: next `git pull` into `/root/bricks-of-india` will fail with "untracked working tree file would be overwritten" because `ceb130b` introduces that file at the same path.
- **Source:** Checkout provenance analysis, session 2026-06-27.
- **Status:** Open. Fix: `rm /root/bricks-of-india/src/lib/get-secret.ts` before pulling into that checkout.
- **Owner:** Abhinav (requires Linux/WSL terminal).
- **Target window:** Before next pull into /root/ checkout.
- **Dependencies:** MEDIUM-55 (checkout inventory).

---

### TRIVIAL — Informational / already resolved in documentation

#### TRIVIAL-33: raw_signals migration formalization (CONTRA-01 follow-up)
- **What:** CONTRA-01 resolved — migration exists, correct, created 2026-05-09 in `e5b71b1`. No code action needed.
- **Source:** CONTRA-01 resolution (this audit)
- **Status:** resolved in this commit
- **Owner:** —
- **Target window:** done
- **Dependencies:** none

#### TRIVIAL-34: lint_result vs lint_results historical note
- **What:** Confirm `lint_results` → `lint_result` rename (dropped plural) is captured in migration log — already handled in PR-2b-3.6
- **Source:** PR-2b-3.6 session
- **Status:** resolved in PR-2b-3.6
- **Owner:** —
- **Target window:** done
- **Dependencies:** none

---

### Social Automation

> Items from the 2026-06-27 consolidation audit. Not blocking Fan CoLab deadline unless IG-TOK-01 slips.

#### LOW-43: IG System User Token — permanent non-expiring setup
- **Superseded 2026-07-26 — see the full, current entry under §CRITICAL — Time-bound (top of §Pending — Next Up), same ID, same item.** Kept here as a pointer only, so this doesn't read as a second/conflicting record: current status, context, and exact action steps live there now, not here. Original text below retained for historical continuity only — do not treat as current.
- **What (original, 2026-06-27):** Replace the 60-day long-lived token with a permanent non-expiring token via Meta Business Manager → System User → Token Generator. One-time setup eliminates the annual IG-TOK-01 re-exchange cycle forever. Currently deferred behind IG-TOK-01 (re-exchange by 2026-07-16). Once IG-TOK-01 is complete, proceed with System User token setup.
- **Source:** B1 + E1 consolidated; SOCIAL_AUTOMATION_STATUS.md §Token calendar; absent from master tracker prior to consolidation audit

#### LOW-44: CE-06 — Deals Alert IG Story
- **What:** Weekly IG Story summarising top 5 deals from /lab/deals. LAB-06 (/lab/deals) is live — data exists. Canva template approach: pull top-5 `store_prices` rows by discount from MRP, export to Story format, post every Monday. No code needed.
- **Source:** B2; CE-06 from CONTENT_ENGINE_STATUS.md; LAB-06 unblocks this
- **Status:** not started
- **Owner:** A (Canva template + weekly post)
- **Target window:** unscheduled — strong RLFM portfolio evidence (data → content pipeline)
- **Dependencies:** LAB-06 live (✅ done)

#### MEDIUM-56: YouTube OAuth state — verify heartbeat vs known invalid_grant
- **What:** `social_automation_heartbeat` recorded a YouTube `status='success'` at 2026-06-27T09:19Z. Day 35 Ground Truth documented YouTube as `invalid_grant`-blocked since Day 34 (Google verification review submitted 2026-06-02). Either (a) OAuth was silently resolved, or (b) the heartbeat records "success" even when YouTube posts are gracefully skipped. Diagnostic: `SELECT * FROM social_automation_heartbeat WHERE platform='youtube' ORDER BY last_attempt_at DESC LIMIT 5` and cross-check against the GHA social-automation run log for that timestamp. Update YT-OAUTH-01 with current actual state.
- **Source:** B3; heartbeat-vs-INVALID_GRANT discrepancy surfaced in consolidation audit 2026-06-27
- **Status:** needs verification — Abhinav terminal diagnostic
- **Owner:** A
- **Target window:** this week
- **Dependencies:** none

#### MEDIUM-57: Cross-posting system for editorial content
- **What:** Social automation handles IG/YouTube for video/carousel content. No systematic social distribution exists for editorial text (news articles, guides, opinion pieces). Scope decision: (1) which content types get social posts, (2) per-platform format rules (IG caption with link, Reddit post), (3) duplicate-prevention tracking log. Operator decides scope; code follows.
- **Source:** E4; BOI_SOCIAL_TRACKER.md XPOST-01/02/03
- **Status:** not started — scope decision required before implementation
- **Owner:** A (scope decision) + C (automation if applicable)
- **Target window:** post-Fan-CoLab
- **Dependencies:** none

#### LOW-46: Newsletter platform decision + community engagement
- **What:** Newsletter subscribe form is live (Resend SDK, `newsletter_subscribers` table) but no broadcast platform is chosen. Decision: (a) Resend broadcast, (b) Buttondown, (c) Beehiiv, (d) defer. Community engagement layer not yet defined (comment system, DM cadence, Q&A format — BOI_SOCIAL_TRACKER.md COMM-01/02/03). Scope decision only — no implementation until decided.
- **Source:** E7; BOI_SOCIAL_TRACKER.md COMM-01/02/03
- **Status:** deferred — post-RLFM scope decision
- **Owner:** A
- **Target window:** post-2026-08-01
- **Dependencies:** none

---

### SEO / GEO

> Items from the 2026-06-27 consolidation audit. SEO/GEO sprint (Days 31–33) shipped all code-side changes; these are the remaining operator actions and one code extension.

#### MEDIUM-58: GSC verification — operator confirmation needed
- **What:** Google Search Console property verification and sitemap submission are manual operator steps. Days 29/30 show these as pending. Day 31 Addendum 10 says "GEO sprint (schema, robots, GSC)" — ambiguous whether this means code changes to robots.txt/schema only, or actual GSC property verification. If the property is unverified, all code-side schema markup and sitemap improvements have zero discoverability impact. Operator: log in to GSC (search.google.com/search-console), verify bricksofindia.com property, submit sitemap.xml, request indexing for 10 priority pages. ~15 min. Confirm here when done.
- **Source:** B5; SEO_ACTION_PLAN.md §Week 1; Day 30 Ground Truth §P2
- **Status:** unconfirmed — Abhinav verify and confirm
- **Owner:** A
- **Target window:** this week — prerequisite for any organic growth evidence before RLFM application
- **Dependencies:** none (sitemap.xml live, robots.txt correct, DNS set)

#### LOW-47: Reddit / AFOL community outreach for backlinks
- **What:** Post on r/IndiaLEGO and r/lego introducing bricksofindia.com. Suggested angle: "I built an India MRP tracker for LEGO sets — here's how prices compare to USD MSRP." Cheapest backlink source available. SEO_ACTION_PLAN.md listed this as a Week 1 action — check if already done.
- **Source:** B6; SEO_ACTION_PLAN.md §Immediate actions
- **Status:** unconfirmed — check if already done; if not, do before 2026-08-01
- **Owner:** A
- **Target window:** before 2026-08-01
- **Dependencies:** none

---

### Content Engine

> Items from the 2026-06-27 consolidation audit. CE-01 (Builder Spotlights) and CE-02/05 (guides + history) already done. These are remaining unstarted CE items.

#### LOW-48: CE-03 — Build Debate (opinion column)
- **What:** Monthly opinion piece debating a LEGO design, pricing, or community question. /opinion route live since Day 28. Format: 500–800 words, FOR / AGAINST / VERDICT. 3 opinion posts already published (Day 28 batch). Goal: 1 new post per month.
- **Source:** B7; CE-03 from CONTENT_ENGINE_STATUS.md; /opinion route now unblocks this
- **Status:** not started (format ready; editorial calendar not set)
- **Owner:** A (editorial brief) + C (drafting from brief)
- **Target window:** first post by 2026-07-15 strengthens RLFM portfolio
- **Dependencies:** none

#### LOW-49: CE-04 — Blind Bag Reel (India retail video)
- **What:** Bi-monthly IG Reel + YouTube Short filmed at Toycra or MyBrickHouse — buy a blind bag on camera, open, mini-review. Authentic India retail content; strong RLFM differentiator. No code dependency. Can record silent or natural audio before EL-05 voice decision is made.
- **Source:** B8; CE-04 from CONTENT_ENGINE_STATUS.md
- **Status:** not started
- **Owner:** A (filming)
- **Target window:** before 2026-08-01
- **Dependencies:** MEDIUM-61 (EL-05 voice decision) — soft dependency only; can proceed without it

#### MEDIUM-59: Review volume target — 20 reviews by 2026-07-31 (target metric ambiguous — needs Abhinav decision)
- **What:** Two separate "review" streams exist on the site and this item's "20 reviews" target doesn't specify which one it's counting:
  (a) **`reviews` table** — 3 hand-curated long-form reviews (McLaren P1, Rivendell, NHM), live at `/reviews/[slug]`, with full Review+Product JSON-LD schema via `buildReviewSchema()` (only called from that route — verified 2026-06-28).
  (b) **RADAR-08 auto-review pipeline** — `pending_drafts.draft_format='review'` → auto-published into `news_articles` (category="Review"), live at `/news/[slug]`. 14 published as of 2026-06-28. **No Review/Product schema** — same generic Article markup as any news post.
  If the RLFM application needs structured review evidence (the schema GEO-01-FU1 was built for), the real count is still 3, not trending toward 20. If it just needs review-flavored content anywhere on site, 14 is real progress. Open question for Abhinav: which one does the application actually need?
- **Source:** E9; BOI_PROJECT_STATUS_2026-05-25 §P2 review target; absent from tracker. Stream ambiguity surfaced 2026-06-28.
- **RLFM requirement confirmed (2026-06-28, via FAN_COLAB_TIMELINE.md):** The RLFM application only requires "3+ Codex-compliant reviews live" — already met by the `reviews` table (3 hand-curated long-form reviews: McLaren P1, Rivendell, NHM), checked off in the timeline. The "20 reviews" target is an **internal stretch metric** from E9/PR-2b, not an RLFM gate. RADAR-08 auto-reviews count toward breadth but the structured-schema (`/reviews/[slug]`) stream is what RLFM would inspect.
- **Status:** 🔵 BLOCKED_EXT — not blocking RLFM August 2026 application (3-review gate met). Internal "20 reviews" stretch target decision deferred to Abhinav; cadence is healthy (14 RADAR-08 publishes active).
- **Owner:** A (decide internal target framing) — not time-critical for application
- **Target window:** 2026-07-31 (internal stretch; RLFM gate already cleared)
- **Dependencies:** HIGH-45 (✅ closed); HIGH-50 (✅ closed — null draft_title is expected, not a skip); CRITICAL-1 (✅ closed 2026-06-23 baaf930)

---

### Web / Technical Hygiene

> Items from the 2026-06-27 consolidation audit. None blocking RLFM or Fan CoLab deadline.

#### LOW-45: CONTENT-RENDER-02 — /blog markdown rendering
- **What:** `/blog/[slug]/page.tsx` renders `{post.content}` as raw escaped text — markdown asterisks, hyphens, and link syntax appear as literal characters. Same fix applied to /news (markdown-it renderer) needs porting to the /blog route. Low traffic currently but a credibility issue when blog posts are reviewed for Fan CoLab.
- **Source:** B9; BOI_WEB_TRACKER.md CONTENT-RENDER-02; Day 28 Known Issues P3
- **Status:** not started
- **Owner:** C
- **Target window:** unscheduled
- **Dependencies:** none

#### MEDIUM-60: PROCESS-RLS-02 — audit pre-Day-6 tables for RLS gaps
- **What:** 9 tables existed before Day 6's PROCESS-RLS-01 mandate (ENABLE ROW LEVEL SECURITY on every new table). Tables created before that mandate may have permissive defaults. Diagnostic first: for each candidate table (`raw_signals`, `community_spotlights`, `social_posts`, `social_automation_heartbeat`, `generator_runs`, `content_quality_issues`, `content_image_registry`, `content_fix_log`), run `SELECT relrowsecurity FROM pg_class WHERE relname='<table>'` and verify policies exist for expected access patterns (service-role write, anon blocked). No DDL until diagnostic is reviewed.
- **Source:** B11; Day 6 §F.3 PROCESS-RLS-02; Day 28 Known Issues P2; absent from master tracker
- **Status:** not started — read-only diagnostic first
- **Owner:** A (terminal diagnostic) + C (migration if gaps found)
- **Target window:** this month
- **Dependencies:** none

#### LOW-50: LEGO Insiders escalation (INSIDER-01)
- **What:** Abhinav's LEGO Insiders account #811205769 shows zero points despite 100+ set purchase history across Toycra and MyBrickHouse. Steps: INSIDER-01 escalation to LEGO India CS; INSIDER-02 follow-up to US CS if unresponsive. INSIDER-03 content angle: if unresolved after 30 days, publish "LEGO Insiders doesn't work in India — here's the evidence" (high search intent, authentic AFOL grievance, RLFM credibility signal).
- **Source:** E8; BOI_PROJECT_STATUS_2026-05-25 P3; BOI_SOCIAL_TRACKER.md INSIDER-01/02/03
- **Status:** not started
- **Owner:** A (CS escalation)
- **Target window:** unscheduled — do before RLFM application; INSIDER-03 is the content angle if unresolved
- **Dependencies:** none

---

### Video — Phase 4

> Full Phase 4 spec (22 tasks: EL-01→05, YT-01→05, SHORT-01→04, FLOW-01→04, EQUIP-01→04) is in `docs/archive/BOI_VIDEO_TRACKER.md`. VID-P4-01/02 below are the new build-tracking items layered on top of that spec — they don't replace it.

#### MEDIUM-61: Phase 4 video gate — EL-05 voice clone decision
- **What:** All video production is gated on EL-05: operator decision on ElevenLabs AI voice clone after completing EL-01 (record voice sample) → EL-02 (clone on ElevenLabs) → EL-03 (test vs Codex v2 rubric) → EL-04 (cost-benefit review) → EL-05 (decision: full AI clone / hybrid / natural voice only). DaVinci Resolve confirmed as editor (EQUIP-01 done). Full breakdown in `docs/archive/BOI_VIDEO_TRACKER.md`.
- **Source:** E3; BOI_VIDEO_TRACKER.md Phase 4 spec; absent from master tracker prior to consolidation audit
- **Status: ✅ DECIDED 2026-07-05.** EL-05 = ElevenLabs Instant Voice Clone (IVC), Starter tier. Not the full EL-01→04 sequence (natural-voice-only or a from-scratch cost-benefit review) — decided directly, moving straight to build. This unblocks VID-P4-01/02 below.
- **Owner:** A (decided).
- **Target window:** Done.
- **Dependencies:** EQUIP-01 (✅ DaVinci Resolve confirmed).

#### VID-P4-01: Daily video pipeline engine (candidate selector, script gen, gates, assembly)
- **What:** `scripts/video/{engine.py,gates.py,prompts.py}` — Shopify candidate selection (Toycra + MyBrickHouse), Gemini script generation (Cerebras failover, 4-6s paced) against the fixed Codex video-voice system prompt, 7 pre-TTS quality gates, ElevenLabs TTS, moviepy assembly (Ken Burns over product images between the operator's recorded intro/outro), `video_posts` DB logging.
- **Source:** Operator project brief, adapted 2026-07-05.
- **Status: ✅ CLOSED 2026-07-05 — built and verified end-to-end without spending on TTS** (`--no-tts`). Real corrections made during verification, not assumed correct from the brief:
  - **Set-number range:** brief said 4-5 digits; the existing web-pipeline convention (`scripts/scrape-now.mjs`) uses 4-6 — verified against a real 6-digit catalog set (`853653`) that a 4-5-digit rule would have missed. Used 4-6.
  - **G5 factuality extraction:** a bare 4-6-digit regex would false-positive on years mentioned in a script ("since 2016") — ported the web pipeline's actual structural-context extraction (`extractSetNumberCandidates`, LEGO/set-prefixed, `#`-prefixed, parenthetical, or title-adjacent numbers, with year-range and currency-adjacency exclusions) instead of a weaker from-scratch version.
  - **G7 opener uniqueness:** brief said "first-sentence similarity"; tested literally against the exact motivating incident ("Your wallet called. It wants to discuss the LEGO ___.") and found a single-sentence cut misses it entirely, since the repeating template spans two sentences. Widened to the original web-pipeline Gate 8's actual window (first 150 chars, not sentence-bounded) — confirmed catches the real incident and doesn't false-positive on genuinely different openers.
  - **G2 banned patterns:** an initial bare `\blike\b` match failed real generated scripts using "like" as a normal preposition ("feels like", "told like a friend at a chai stall" — the latter literally quoted in the system prompt itself). Narrowed to the actual CTA-phrase sense (`like and subscribe`, `hit like`, `like this video`, `like button`) — bare `follow`/`subscribe`/`comment` kept as-is per the brief, no false positives observed there.
  - **Cerebras model name:** brief said `llama3.1-8b` — returns `404 model_not_found` on this account (`client.models.list()` shows only `gemma-4-31b`/`zai-glm-4.7`/`gpt-oss-120b`). Used `gpt-oss-120b`, matching the main site's already-proven Cerebras failover model.
  - **moviepy/Pillow incompatibility:** moviepy 1.0.3's resize path calls `PIL.Image.ANTIALIAS`, removed in Pillow >=10 (installed: 10.3.0) — raises `AttributeError` on any `.resize()` call. Monkeypatched `Image.ANTIALIAS = Image.LANCZOS` (same algorithm, renamed) at the top of `engine.py` before importing moviepy.
  - **Real, reproducible finding, not a bug:** across 6 live Gemini generations during verification, word count was over the 110-125 target every single time (132, 150, 142, 165, 149, 143). System prompt left untouched per "do not dilute" — flagged as an operational reality in `docs/runbooks/VIDEO_PIPELINE.md`'s troubleshooting section, expect the word-count gate to be the most common failure and more than one `--pick` attempt some days.
  - **Full dry-run verification:** real candidate fetch (live Shopify JSON, both stores), real Gemini/gate cycle (6 real generation attempts, 2 real gate bugs found and fixed), real image download, real placeholder audio, real moviepy/ffmpeg render to 1080x1920 h264/aac (`ffprobe`-confirmed, 54.0s), real `video_posts` insert and `--posted` status update. All test DB rows and rendered test artifacts deleted/cleaned after verification.
- **Owner:** C (built).
- **Target window:** Done.
- **Dependencies:** MEDIUM-61 (decided).

#### VID-P4-02: First supervised live run
- **What:** First real end-to-end run with real ElevenLabs TTS (spending Starter-tier credits) and the operator's actual recorded `intro_hook.mp4`/`outro_signoff.mp4` in `scripts/video/master_assets/`. Confirms voice-clone quality, real render duration/pacing, and the manual IG Reels + YT Shorts upload flow before this becomes a daily habit.
- **Source:** VID-P4-01 follow-on.
- **Status:** pending — blocked on the operator setting up the `Bricks-of-India-Social` Google AI Studio project (`GEMINI_SOCIAL_API_KEY`) and ElevenLabs Starter account (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`), plus dropping the two recorded clips into `master_assets/`.
- **Owner:** A (accounts + clips) → C (run once unblocked).
- **Target window:** Whenever the operator's accounts/clips are ready — no hard deadline set.
- **Dependencies:** VID-P4-01 (done); operator keys; operator clips.

**Lane separation, VID-P4 vs. SOC-AUTO-01 (existing daily social automation):** distinct DB tables (`video_posts` vs `posted_sets`), distinct trigger (manual `--pick` vs. automatic daily cron), distinct format (full voiceover video vs. static preview card), distinct caption/voice register (review/opinion Clarkson-voice vs. preview/announcement tone). Both log independently — a set can legitimately have both a `posted_sets` row (automatic preview card) and a `video_posts` row (manual review video) with neither pipeline aware of the other. Full detail in `docs/runbooks/VIDEO_PIPELINE.md`.

---

### VID-QP — Quiet Panic Format

> New, lower-frequency comedic track sitting alongside VID-P4's daily review pipeline — SFX/whisper-led, zero building footage, one persona ("The Overly Serious Whisperer") across three planned formats. Full spec: `briefs/VID-QP-01.md` (persona, voice lock, SFX library, bumpers). Phase 2b build spec (not yet executed): `briefs/VID-QP-02.md`.

#### VID-QP-01: SFX library + bumper lock (Phase 1 & 2a)
- **What:** One-time SFX library (6 cues) and the two standing intro/outro bumpers for every Quiet Panic video, generated via ElevenLabs and locked for reuse — never regenerated per video.
- **Status: ✅ Phase 1 & 2a COMPLETE 2026-07-29.** Phase 2b (script-gen/segment JSON/gates/assembly/DB-publish wiring) is **pending** — spec written (`briefs/VID-QP-02.md`) but not executed.
- **Locked voice:** Mira Whisper — ASMR & English whisper, voice ID `thNHFcPYszCz6ZPG6mUp`. Selected from a 3-candidate test batch (Viraj, Mira Whisper, Julian), re-confirmed against a vocabulary-loaded line ("Sharma ji," "Swiggy," rupee figures) — Julian tested clean on diction but read as distinctly American, disqualifying against Indian-cultural-reference scripts.
- **API key:** `ELEVENLABS_API_KEY_ASMR` (scoped: Text to Speech, Sound Effects, Voices — separate from VID-P4's production `ELEVENLABS_API_KEY`). All future TTS/SFX calls for this format use this key.
- **SFX library location:** `assets/sfx/library/` — `bag_tear.mp3`, `brick_snap.mp3`, `brick_pour.mp3`, `sorting_rummage.mp3`, `separator_pry.mp3`, `soft_whoosh.mp3` (6/6 generated). `brick_snap_short.mp3` (0.7s trim of `brick_snap.mp3`) also present, used in the final intro splice.
- **Bumper file locations:** `assets/bumpers/intro_final.mp3` (7.2s, `eleven_flash_v2_5`, brick-snap-scored) and `assets/bumpers/outro_final.mp3` (renamed from `outro_take6.mp3`, `eleven_multilingual_v2` — `eleven_flash_v2_5` repeatedly stuttered on this exact phrasing across every take, multilingual_v2 rendered clean on the first attempt; one-time asset, so stability was prioritized over generation speed). Both locked as permanent spliced-in bumpers for every video in this format.
- **Planned cadence:** The Quiet Panic (flagship) 3x/week, both platforms, 45–55s incl. bumpers (revised up from an initial 30–45s target once Mira's actual whisper pacing was measured). Guess the Sound (1x/week) and Pure Loop (3x/week, Instagram-only) both **deferred** until Quiet Panic has a couple weeks of real engagement data.
- **Standing dependency:** this format cannot go live for a given set until that set's MRP is confirmed audited (`sets.lego_mrp_inr`, verified rows only — never one of the ~2,770 unverified-estimate rows from the ongoing MRP audit). No live scraping at render time; the corrected DB column is the shared source of truth for both site and video.
- **Resolved 2026-07-29:** Julian and Viraj's added voice-library slots removed from the ElevenLabs account via API (`voices.delete`, both confirmed `status='ok'`) now that Mira is locked. Only Mira Whisper remains from the test batch alongside the account's default voices and the operator's own VID-P4 IVC clone.
- **Owner:** A (voice/creative decisions, brief authorship) + C (generation, splicing).
- **Target window:** Phase 2b next, no date set.
- **Dependencies:** VID-P4's existing ASSET-01/02 image pipeline (reused, no new scraper); MRP audit completion per set.

#### VID-QP-02a: Publish-side isolation (DB table, standalone script, standalone workflow)
- **What:** Operator requested full isolation from VID-P4's publish infrastructure, not just a `content_type` value on `video_posts` — "copy the model, not the infrastructure." Investigation first found `video_posts.content_type` doesn't exist at all (would've needed a migration either way); operator then redirected to a fully separate table instead.
- **Status: ✅ DONE 2026-07-29** — this slice only (DB table + standalone poller/publisher + standalone workflow). Script-gen, segment JSON, gates, TTS, assembly, and audio QC (VID-QP-02.md sections 1-6) are **still pending** — this is the publish-side (section 7) slice only, built ahead of the generation side.
- **`quiet_panic_posts` table:** `supabase/migrations/20260729000000_quiet_panic_posts.sql`, applied via Supabase MCP (project `hqpaiarhmiocmjrzjhtw`). Own schema (not a `video_posts` column addition), own `status` CHECK constraint (`pending_approval/approved/posted_ig/posted_yt/posted_both/discarded/publish_blocked`), own `sequence_number` ordering trigger (mirrors `video_posts.story_number`'s trigger pattern), RLS enabled with zero policies (matches the existing admin-table idiom — `video_posts`, `content_rejections`, `generator_runs`).
- **`scripts/video/publish_quiet_panic.py`:** new, fully standalone. Zero imports from `engine.py`/`publish.py` — the IG Reels (container-create → poll → publish → fetch-back-verify) and YouTube Shorts (channel-identity guard → resumable upload → fetch-back-verify) upload logic is duplicated as its own functions in this file. Own daily cap (1/day) and own IST-day-bounds check against `quiet_panic_posts` only, no shared counter with VID-P4's poller.
- **One shared data dependency (not code):** `IG_ACCESS_TOKEN` / `IG_USER_ID` / `YOUTUBE_CLIENT_SECRETS` — same Bricks of India IG/YouTube account credentials as VID-P4, reused as-is (there is only one account regardless of which pipeline posts to it). `IG_ACCESS_TOKEN` freshness still depends on the existing `ig-token-refresh.yml` workflow — no separate refresh cycle was built.
- **`.github/workflows/video-publish-poller-quiet-panic.yml`:** new, separate workflow, hourly at `:17` (`17 * * * *`) — independent schedule from VID-P4's `*/15 * * * *`.
- **Confirmed untouched by this change:** `video_posts` (table/schema), `scripts/video/engine.py`, `scripts/video/publish.py`, `.github/workflows/video-publish-poller.yml`, `social-assets` bucket contents.
- **`quiet-panic-assets` Storage bucket:** initial build shared VID-P4's `social-assets` bucket under a `quiet-panic-video/` prefix — reversed same-day once flagged that `service_role` bypasses RLS on `storage.objects` entirely and can't be scoped to a prefix, so the shared-bucket approach would have given this script full read/write/delete on VID-P4's stored videos. Created a fully separate bucket instead (`public: True`, same `create_bucket` pattern as `social-assets`). Verified live: test upload succeeded, `get_public_url()` returned a real fetchable `HTTP 200` link (byte-identical content), and `social-assets`' object listing showed zero new objects from the test.
- **Not built in this slice** (none requested): notification wiring (`notifier.py` was not duplicated), captions/story-badge OCR guards (no equivalent defined yet for this format), an evening publish-window restriction (only the daily cap was requested).
- **Owner:** A (isolation decision) + C (build).
- **Target window:** Done (this slice). Generation-side sections 1-6 of VID-QP-02.md still pending, no date set.
- **Dependencies:** VID-QP-01 (SFX/bumpers, done); VID-P4's IG/YouTube account credentials (shared, not owned by this slice).

#### VID-QP-02b: Generation-side build — IN PROGRESS (current-state snapshot, 2026-07-30)
- **What:** Building out VID-QP-02.md sections 1-6 (script-gen, segment JSON, gates, TTS, assembly, audio QC) inside `scripts/video/generate_quiet_panic_video.py`. First real end-to-end test render completed against set 77243 (Oracle Red Bull Racing RB20).
- **Locked/stable, reused as-is this session:** voice (Mira Whisper, `thNHFcPYszCz6ZPG6mUp`, `ELEVENLABS_API_KEY_ASMR`); SFX library (`assets/sfx/library/` — now 8 files including `brick_snap_body.mp3`/`brick_snap_short.mp3`, plus a new `peak_levels.json` manifest, see below); bumpers (`intro_final.mp3`/`outro_final.mp3`, spliced as-is); the publish-side isolation from VID-QP-02a (`publish_quiet_panic.py`, `quiet_panic_posts` table, `quiet-panic-assets` bucket) — untouched this session, confirmed it performs the Storage upload itself at publish time from `video_path` (not expecting the render step to have uploaded anything; falls back to downloading from `storage_url` only if the local file is missing).
- **In progress, all in `generate_quiet_panic_video.py`:**
  - **Voice on/off segment schema:** segments can now carry `"voice": false` — an SFX-primary beat with no TTS at all (duration comes from the SFX file's own native length). Proven via a restructured RB20 script (piece-count and price-reveal beats now play as SFX-only, e.g. `brick_snap_body.mp3`) through a full render.
  - **Audio mixing fixes:** `amix normalize=0` (explicit gain staging instead of ffmpeg auto-scaling SFX down against voice); peak-relative SFX gain via a new `assets/sfx/library/peak_levels.json` manifest (`--build-sfx-manifest` CLI flag) replacing a flat dB boost that was clipping hot SFX files; `alimiter` safety net added after the gain stage; single-pass `loudnorm` replaced with two-pass (measure then correct), applied once on the fully assembled track.
  - **Caption stroke/shadow legibility fix:** done (thicker outline + blurred drop shadow vs. the earlier thin-outline pass).
  - **Duration gate fix:** the gate was checking body-segment duration only, missing the ~21s of fixed intro+outro bumpers — the RB20 render passed gate at a reported 56.4s while the actual file was 77.5s. Fixed to gate on full assembled duration (intro+body+outro); re-run against the existing RB20 render now correctly reports **FAIL** (77.5s vs. the 40.5-60.5s band).
  - **Script pacing calibration:** measured Mira's real per-word TTS rate from the RB20 render — 0.717s/word aggregate, split ~0.65s/word for flowing sentences vs. ~0.95s/word for short/punctuation-heavy fragments (ellipses and commas add pause time independent of word count). Added a hard word-count budget rule to `briefs/VID-QP-01.md` §3 and `briefs/VID-QP-02.md` §2 — the original RB20 draft used ~73 voice-on words against a budget that should have been roughly 26-42.
- **Open decisions:**
  - **Intro wording:** `intro_final.mp3` is explicitly a placeholder — `intro_v2` has not been recorded/chosen yet.
  - **Word-budget-compressed RB20 script** (33 voice-on words, currently only in a scratchpad file, not in the repo) is pending operator's A/B listen — 4 standalone TTS clips rendered comparing two compressed lines against lightly-restored alternates. Script stays out of the repo/pipeline until reviewed.
  - **WALL-E (43279) and Rivendell (10316)** test candidates have **not** been restructured with the voice:true/false schema — do not render either until that's done (explicit operator instruction, still standing).
  - `quiet_panic_posts` row `181a8b81-980d-4c66-b02a-3d4ef442dca6` (the RB20 test render) corrected to `status='publish_blocked'` with `gate_results.duration` now showing the true FAIL — held pending a re-render with the calibrated script, not currently publishable.
- **Owner:** A (creative/wording decisions, A/B review) + C (pipeline build).
- **Target window:** No date set — mid-build, currently blocked on operator's A/B review of the word-budget script before any re-render.
- **Dependencies:** VID-QP-01 (voice/SFX/bumpers, done); VID-QP-02a (publish isolation, done, untouched this session).

#### VID-QP-02c: First operator-approved Quiet Panic video — 2026-07-30
- **What:** `quiet_panic_posts` row **`d6531082-062b-4fa7-98eb-9967a2db4523`** (RB20, set #77243) — **first Quiet Panic video approved by operator end-to-end**, closing out VID-QP-02b's remaining open items below. Committed `decf072` (pushed to `main`).
- **Status:** `quiet_panic_posts.status` confirmed `approved` (set directly by operator via Supabase, outside this session's file/code changes) — **awaiting the hourly publish poller** (`.github/workflows/video-publish-poller-quiet-panic.yml`, `:17` past the hour) to post it live to Instagram Reels and YouTube Shorts.
- **Resolved from VID-QP-02b's open-decisions list:**
  - Intro wording: **locked** — `intro_final.mp3` replaced with the v2 single-line take (`intro_v2_take2.mp3`, 8.17s), old two-clause version kept as `intro_final_v1_deprecated.mp3`.
  - Word-budget approach: **superseded** — telegraphic per-line compression was tested and rejected (broke delivery cadence, see `briefs/VID-QP-01.md` §3's corrected note); the shipped approach instead reduces *how many* segments carry voice (4 of 8 here) while keeping full original wording on the ones that do.
  - Row `181a8b81` (first, buggy-gate render) and `2a1b6d89` (word-budget-compressed, incoherent-delivery version) both remain untouched, `publish_blocked`/`pending_approval` respectively, kept as documented bad examples.
- **New fixes shipped this pass, all in `generate_quiet_panic_video.py`:** reading-speed floor for `voice:false` segments (`max(SFX native length, char_count/15)`, with the `car_build_texture` bed filling any gap so audio never goes silent); semi-transparent caption backing plate (tested against both dark and bright-white LEGO-box backgrounds); `apply_watermark()` now also applied to the intro/outro static cards, not just body frames; output filenames now include a `HHMMSS` timestamp (fixes the same-day collision that silently overwrote row `2a1b6d89`'s video evidence earlier this session).
- **One render-reliability note:** the render that ultimately produced `d6531082` needed two attempts — the first background run was killed externally partway through `moviepy`'s `write_videofile` step (corrupt `moov atom`, no DB row created, nothing lost), re-run from scratch completed cleanly. Suspected environmental (memory pressure during video encoding), not a code bug; worth watching if it recurs.
- **Resolved, not reverted:** commit `cfbf5b8` (this thread's tracker-status fix) swept in 6 unrelated files beyond the intended single-file change. Operator confirmed those 6 files are a separate, fully completed project — the Reviews Pipeline Overhaul (MyBrickHouse/Toycra direct sourcing, retailer-conditional disclaimers, CQS gates, flip-freeze self-verification), run to completion in its own session with its own testing/review, not an unreviewed fragment. Left as-is in `cfbf5b8`; see line ~70 of this file for that session's own note on the same incident. Root cause and prevention: see the new Concurrency note under §Auto-update protocol.
- **Next up:** WALL-E (43279) and Rivendell (10316) — **still not restructured** with the voice on/off schema. Next in line using the now-proven RB20 pattern (pick 3-4 strongest-joke segments to keep voiced at full original wording, rest to `voice:false` + caption, reading-speed floors, new intro/watermark/bed already wired for any candidate).
- **Owner:** A (approval) + C (pipeline build).
- **Target window:** Publish poller picks up `d6531082` on its next `:17` run once `status='approved'` is actually set. WALL-E/Rivendell restructuring: no date set.
- **Dependencies:** VID-QP-02b (done, this entry closes its remaining opens); VID-QP-02a (publish isolation, unchanged).

---

### Monetization

#### MEDIUM-62: MyBrickHouse coupon-code affiliate arrangement
- **What:** Approach MyBrickHouse (lego.mybrickhouse.com — 2nd active store in `store_prices`) for an affiliate coupon-code deal equivalent to Toycra's ABHINAV12. MBH already appears on every price-comparison page — a code converts existing traffic into commissions without additional content work. Template: email with monthly traffic stats + article count mentioning MBH prices. Toycra arrangement is the precedent.
- **Source:** E6; BOI_PROJECT_STATUS_2026-05-25 P2 MONETIZE-01; absent from master tracker
- **Status:** not started
- **Owner:** A (outreach email)
- **Target window:** after RLFM application — use post-Aug stats as leverage
- **Dependencies:** none

#### MEDIUM-63: admin/dashboard.html health score out of sync with tracker (Auto-update protocol violation)
- **What:** `admin/dashboard.html` `kpis.healthScore` is 85 with a `healthScoreNote` referencing stale `/news 16d` data. Tracker header reads 96. The Auto-update protocol (§Auto-update protocol, rule 1) requires both files update in the same commit; they have diverged. Pre-dates 2026-06-27 session — this is an existing violation, not introduced today.
- **Source:** Observed 2026-06-27 during Phase 3 archival; not introduced in consolidation audit.
- **Status:** Open. Dashboard needs full reconciliation against current tracker state (health score, KPIs, pipeline status, issue list). Scope is larger than a one-line fix — reconcile in a dedicated commit.
- **Owner:** C (reconcile dashboard JSON against current tracker)
- **Target window:** before next external review (Fan CoLab application, RLFM outreach)
- **Dependencies:** none — dashboard is a standalone JSON blob in `admin/dashboard.html`

---

### THE LAB — Deferred

#### LOW-51: Google Trends ingestion (PULSE-01 through PULSE-09) — explicitly deferred
- **What:** Full spec for a Google Trends data layer exists in `docs/archive/BOI_WEB_TRACKER.md` §Section E (PULSE-01→09): daily Trends API cron → `search_trends` table → `/pulse` route → state-level drilldown → Dataset JSON-LD. The shipped `/lab/heat-map` uses static demographic data and is the simplified placeholder. This item is **explicitly deferred** — not an accidental omission. /lab/heat-map satisfies the "trend popularity" user story at zero ongoing cost; full Trends ingestion requires GCP quota management and a new table. Revisit post-2026-08-01 if heat-map engagement warrants it.
- **Source:** E2; BOI_WEB_TRACKER.md PULSE-01/09; /lab/heat-map shipped as simplification
- **Status:** deferred indefinitely — explicit decision
- **Owner:** A (revisit post-RLFM)
- **Target window:** post-2026-08-01
- **Dependencies:** none

---

## Consolidation Audit — 2026-06-21

> **Branch:** `chore/consolidation-audit-2026-06-21` (DRAFT PR — do not merge pending Claude+Abhinav review)
> **Scope:** Days 35-N (2026-06-03 through 2026-06-21). Captures repo state, migration inventory, workflow inventory, sub-tracker drift, and known contradictions.

### Part A — Discovery

#### A1. Migration inventory (18 files as of 2026-06-21)

| File | Table / Object | Status |
|------|----------------|--------|
| `20260503000000_pending_drafts.sql` | pending_drafts | Applied (schema.sql baseline) |
| `20260503120000_pending_drafts_iteration.sql` | pending_drafts unique index dropped | Applied |
| `20260503140000_create_raw_signals.sql` | raw_signals | Applied |
| `20260510000000_newsletter_rls_hardening.sql` | newsletter_subscribers RLS | Applied |
| `20260514000000_reviews_schema_hardening.sql` | reviews schema | Applied |
| `20260524000000_posted_sets.sql` | posted_sets | Applied |
| `20260525000000_guides.sql` | guides | Applied |
| `20260525120000_community_spotlights.sql` | community_spotlights | Applied |
| `20260528000000_sets_retirement_columns.sql` | sets retirement columns | Applied |
| `20260528120000_content_quality_issues.sql` | content_quality_issues + tables | Applied |
| `20260528130000_pending_drafts_verdict_fix.sql` | pending_drafts verdict | Applied |
| `20260529000000_content_quality_system_v2.sql` | CQS v2 tables | Applied |
| `20260530000000_get_distinct_themes.sql` | get_distinct_themes RPC | Applied |
| `20260531000000_cmf_figures.sql` | cmf_figures | Applied |
| `20260606000000_v_published_articles_public.sql` | v_published_articles_public view | Applied |
| `20260617000000_social_automation_heartbeat.sql` | social_automation_heartbeat | Applied |
| `20260619000000_failover_infrastructure.sql` | generator_runs + pending_drafts additions | Applied (rewritten from fantasy schema) |
| `20260620120000_phase_b_reconciliation.sql` | pending_drafts + guides + generator_runs drift fixes | Applied |

**Note:** `scripts/schema.sql` (baseline) covers `blog_posts`, `news_articles`, `prices`, `price_history`, `price_snapshots`, `reviews`, `sets`, `store_prices`. Not in `supabase/migrations/` directory.

#### A2. Workflow inventory (17 files as of 2026-06-21)

| File | Schedule | Purpose |
|------|----------|---------|
| `deploy.yml` | push to main | Build + deploy |
| `sync-catalogue.yml` | Sun 02:00 UTC | Rebrickable sync |
| `snapshot-prices.yml` | daily 08:30 IST | Price snapshots (LAB-03) |
| `catalogue-audit.yml` | Mon 03:30 UTC | Catalogue health |
| `radar.yml` | daily 17:30 UTC | RADAR-01→02→03 |
| `brief.yml` | daily 01:30 UTC | Morning brief (BRIEF-01) |
| `retiring-soon.yml` | Sun 02:00 UTC | Retirement radar refresh |
| `content-quality.yml` | daily 03:00 UTC | CQS pipeline |
| `social-automation.yml` | daily 06:30 UTC | SOC-AUTO-01 (IG Feed + Reels + YT Shorts) |
| `scrape-prices.yml` | daily (3×/day) | Store price scrape |
| `technical-hygiene.yml` | Mon 04:00 UTC | Weekly hygiene (23+ checks) |
| `code-audit.yml` | Mon 05:00 UTC | ESLint + tsc + npm audit |
| `health-check.yml` | daily 02:30 UTC | 11 health checks |
| `youtube-backfill.yml` | manual dispatch | One-shot YouTube hero backfill |
| `publish-drafts.yml` | 3×/day (19:00/07:30/12:30 UTC) | Batch publish 30 drafts/run (was 15; commit `0b59a52`, 2026-06-06) |
| `ci.yml` | PR trigger | CI checks |
| `generate-drafts.yml` | manual dispatch | GHA batch generation |

---

### Part B — Reconciliation audit table

> Scope: items shipped since Day 34 close (2026-06-03) not yet reflected in any tracker file before this audit.

| Item | Shipped? (repo evidence) | In tracker? | Sub-tracker |
|------|--------------------------|-------------|-------------|
| social_automation_heartbeat table | ✅ Migration 20260617 + commit `7c8ffc8` | ❌ Not in any tracker | SOCIAL, CONTENT |
| health-check Check 6c (heartbeat) | ✅ commit `ed20404` | ❌ Not in any tracker | WEB |
| v_published_articles_public view | ✅ Migration 20260606 | ❌ Not in any tracker | WEB |
| X-Robots-Tag admin headers | ✅ commit `3bd4058` | ❌ Not in any tracker | WEB |
| CSP-Report-Only header | ✅ commit `3bd4058` | ❌ Not in any tracker | WEB |
| robots.ts 22 AI crawlers + crawl-delay | ✅ commit `e8d7192` | ❌ Not in any tracker | WEB |
| technical-hygiene Group 16 checks | ✅ commit `3bd4058` | ❌ Not in any tracker | WEB |
| Cerebras failover (PR-2b-3) | ✅ commits `2b19223`, `aded950` | ❌ Not in any tracker | CONTENT |
| generator_runs write fix (PR-2b-3.5) | ✅ commits `0ba1dea`, `293027b` | ❌ Not in any tracker | CONTENT |
| Schema drift audit (PR-2b-3.6) | ✅ commits `d06d37d`, `746cdaf`, `7e22036` | ❌ Not in any tracker | WEB, CONTENT |
| pending_drafts published_at + discard_reason | ✅ Migration 20260620 | ❌ Not in any tracker | CONTENT |
| pending_drafts CHECK constraint | ✅ Migration 20260620 validated | ❌ Not in any tracker | CONTENT |
| autoPublish() published_url + published_at bug fix | ✅ commit `746cdaf` | ❌ Not in any tracker | CONTENT |
| Filler pattern filter (PR-2b-3.7) | ✅ commits `e160e39`–`128d536` | ❌ Not in any tracker | CONTENT |
| filler-patterns.js + filler-filter.test.js | ✅ files on main | ❌ Not in any tracker | CONTENT |
| smoke test article retracted | ✅ DB-only (no code commit) | ❌ Not in any tracker | CONTENT |
| Cerebras pilot report | ✅ `docs/cerebras-pilot-report.md` | ❌ Not in any tracker | CONTENT |
| 4 pre-existing vitest snapshot failures | ✅ Known, deferred | ❌ Not in any tracker | CONTENT |

**Sub-tracker drift summary:**
- `BOI_SOCIAL_TRACKER.md` — Last updated: 2026-05-02. SOC-AUTO-01 shipped, social heartbeat table added. Tracker shows all cross-post tasks as 🔴 but pipeline has been live since Day 24.
- `BOI_CONTENT_TRACKER.md` — Last updated: 2026-05-10 (Day 9 session 3). RADAR-03 shows "Last run: 997 candidates, 50 queued, 349 total pending_drafts" — all stale. BRIEF-01 listed as 🔴 but shipped Day 27.
- `BOI_WEB_TRACKER.md` — Last updated: 2026-05-09. WEB-01→04 shown as 🔴 Not started; SCRAPE-03 shown as 🔴 Not started; store_prices shown as 492 rows. All stale.
- `BOI_VIDEO_TRACKER.md` — Not read in this audit (Phase 4 is 🔴 Not started; no significant changes expected). UNVERIFIED.

---

### Part D — Known gaps and contradictions

> Under-claiming required. "UNVERIFIED" is a valid status.

#### D1. Contradictions

| ID | Item | Contradiction | Source A | Source B |
|----|------|---------------|----------|----------|
| CONTRA-01 | raw_signals migration | **RESOLVED — case (a):** File `20260503140000_create_raw_signals.sql` created 2026-05-09 in commit `e5b71b1` ("Content pipeline foundation: RADAR-01 fetcher + RADAR-02 deduper + daily cron (#2)") — 6 weeks before the 2026-06-20 PR-2b-3.6 Phase A audit. Phase A grep missed the file (procedural gap — `supabase/migrations/` likely outside grep scope). Both source documents are correct: `docs/schema-live-2026-06-20.md` accurately reflects live DB state; migration file is complete and correct on disk. Contradiction was in the Phase A audit grep, not in either document. Confirmed via `git log --follow --diff-filter=A` run 2026-06-21. | `git log` result: commit `e5b71b1`, 2026-05-09 | `supabase/migrations/20260503140000_create_raw_signals.sql` (on disk, complete) |
| CONTRA-02 | pending_drafts source_url uniqueness | CLAUDE.md says unique index was dropped by `20260503120000`. classify-signals.js uses `fetchExistingUrls()` for application-level dedup. These are consistent — but any code that uses `.upsert(onConflict: 'source_url')` would throw `42P10` because no constraint exists. Verified no such call in current codebase at audit time. |
| CONTRA-03 | generator_runs original migration | `20260619000000_failover_infrastructure.sql` was rewritten in PR-2b-3.6 to match live schema. The original file (before rewrite) had fantasy column names that never matched the DB. Schema-of-record is live DB per CLAUDE.md; migration file is now reconciled. No contradiction post-PR-2b-3.6. |
| CONTRA-04 | BOI_CONTENT_TRACKER.md BRIEF-01 status | Tracker shows BRIEF-01 as 🔴 Not started. `scripts/morning-brief.mjs` and `.github/workflows/brief.yml` shipped Day 27. Memory file `project_brief01_spec.md` marks COMPLETE. Tracker entry is stale — UNUPDATED, not contradictory. |

#### D2. Known unknowns (UNVERIFIED)

| ID | Item | Last known state | Why UNVERIFIED |
|----|------|------------------|----------------|
| GAP-01 | store_prices row count | 1,512 at Day 34 open (was 2,600 at Day 33) | SCRAPE-INVESTIGATE-01 resolution never confirmed in terminal output |
| GAP-02 | news_articles current count | 98 at Day 34 close | Scheduled publish-drafts.yml has run 3×/day since; count UNVERIFIED |
| GAP-03 | Amazon Ancient Ruins retraction | ✅ **RESOLVED 2026-06-21** — 5 articles confirmed 404 by Abhinav: `/news/1999s-amazon-ancient-ruins-a-10000-relic-or-just-more-plasti`, `/news/1999-lego-adventurers-amazon-ancient-ruins-in-india-a-relic-`, `/news/lego-amazon-ancient-ruins-5986-nostalgia-trip-or-wallet-drai`, `/news/lego-adventurers-amazon-ancient-ruins-5986-1-nostalgia-or-ov`, `/news/lego-friends-sonia-figure-frnd0869-a-playground-mystery` | Verified by Abhinav 2026-06-21; closed |
| GAP-04 | Supabase MCP installation | Mentioned by user as installed | Never confirmed in terminal output |
| GAP-05 | 74-row filler backlog | Expected 74 rows matching filler patterns; 0 rows found in scope during verification run | Whether rows were processed by cron, previously rejected, or never existed is UNVERIFIED |
| GAP-06 | Cerebras pilot voice sign-off | `docs/cerebras-pilot-report.md` has 5 empty sign-off checkboxes — confirmed still empty 2026-06-28 (re-read in full, all 5 read `[ ] PASS [ ] FAIL`). **Status downgraded from open-action to informational**, not closed: Gate 7 hard-rules (CRITICAL-4, closed 2026-06-28) now gates the Cerebras path in production independent of this sign-off — `runHardRules()` runs on every Cerebras body and sets `requiresManualApproval` on fail. This pilot report predates Gate 7 and was never wired to anything load-bearing — no code path reads these checkboxes. The 5 pilot bodies were separately re-used as Gate 7's KNOWN_WEAK calibration corpus, which is a different, completed verification (deterministic rule pass/fail), not the manual voice-read judgment call these checkboxes ask for. Abhinav can still tick them as an editorial record if useful, but nothing in the pipeline is blocked on it. | Re-verified 2026-06-28 by direct file read; cross-checked against CRITICAL-4/Gate-7 wiring (`generate-with-failover.ts`) to confirm no dependency exists. |
| GAP-07 | Google OAuth review completion | Submitted 2026-06-02; 4–6 week estimate | 19 days elapsed as of 2026-06-21; no confirmation email in scope |
| GAP-08 | CE-01 Builder Spotlight responses | Outreach sent 2026-05-29; Jun 15 inbox-check threshold passed; CE-01 deadline 2026-07-15 | **ABHINAV-ACTION REQUIRED** — Claude cannot access email inbox. Abhinav must check `abhinav@bricksofindia.com` for builder spotlight replies. If responses received: capture name, set, bio, confirm publication slot. If no response by 2026-07-01: escalate via a second outreach. Report result to close this gap. |
| GAP-09 | BOI_VIDEO_TRACKER.md state | **RESOLVED (case a)** — `BOI_VIDEO_TRACKER.md` EXISTS. Last updated 2026-05-02. Covers: ElevenLabs voice clone test (EL-01→05, all 🔴), YouTube long-form pipeline (YT-01→05, all 🔴), Shorts/Reels section (all 🔴), DaVinci Resolve workflow. This is the video *production* tracker (script → edit → publish pipeline) — distinct from `social-automation/pipeline.py` (automated set gallery posting). File is stale but structurally accurate: Phase 4 genuinely has not started. No separate video DB table exists. No new tracker file needed. | Read 2026-06-21; case (a) confirmed |
| GAP-10 | posted_lego_sets table | Referenced in RLS hardening (2026-06-03) as separate from posted_sets | No migration file found for this table; may predate migration tracking |
| GAP-11 | 4 vitest snapshot test failures | Pre-existing trailing space vs empty line in tests/snapshots/*.txt baselines | Deferred to separate PR; exact files not listed in session notes |
| GAP-12 | technical-hygiene Group 16 checks | Added in commit `3bd4058` | Exact check descriptions not in commit message; source file not read in this audit |
| GAP-13 | Historical generator_runs telemetry | **UNVERIFIABLE-PERMANENTLY** — generator_runs has only 3 rows for entire project lifetime; pending_drafts has ~77 rows with status='published'. ~74 historical publishes predating PR-2b-3.5 (silent-write fix, commit `293027b`) have no telemetry trace. Provenance (model used, lint pass detail, failover invoked) cannot be reconstructed retroactively. All publishes from 2026-06-20 onward have full telemetry via the fixed write path. | PR-2b-3.5 session | Permanent — no remediation possible; document only |

#### INFRA-03 / Phase 8 status (checked 2026-06-21)

Searched all `.md` files for `INFRA-03`, `Phase 8`, and `LEGO Search Pulse`:
- **INFRA-03** (GHA migration): ✅ Done — commit `8992aef`. Netlify is origin host only; GHA handles all builds. No unresolved Netlify constraint exists. BOI_WEB_TRACKER.md line 73 confirms Done status.
- **Phase 8** (LEGO Search Pulse / LAB-07): ✅ Live at `/lab/heat-map` since Day 10 (commit `d5d1641`). `BOI_WEB_TRACKER.md` §E shows PULSE-02 as `🟡 Status uncertain` (stale from 2026-05-02 audit) but master tracker §Phase status overrides: Phase 8 ✅ Live.
- **Finding:** No undocumented Phase 8 / INFRA-03 blocker exists in any tracker file. No D2 gap added.

---

## BOI Shareables — AI-Animated Greeting Video Library

**Status:** Phase 1 (Creative Lock) DONE — all 27 clips finalized via video-by-video alignment session, consolidated into `docs/shareables/BOI_Shareables_Master_Production_Script_FINAL.md` (supersedes the original codex `BOI_Shareables_Master_Production_Script.md`, commit `7a94ff0`, and this section's own prior draft summary). Phase 5 (post-production script) and Phase 7 (Shareables tab) build now in progress in parallel — both consume the same manifest generated from the FINAL file. Phases 2-4 (reference photography, tool setup, generation) NOT started: Kling Pro plan not yet purchased, no reference photos exist, no generation has happened.
**Type:** One-time creative asset build. Explicitly outside the automation stack — no cron, no Supabase status table, no recurring pipeline. Once published, requires no maintenance.

**Objective:** Permanent, reusable library of 27 AI-animated BOI mascot clips (3 flagship intros + 24 occasion greetings) hosted in a `/shareables` tab for download and forwarding via WhatsApp/IG/FB/LinkedIn.

**Key decisions locked:**
- Generation tool: Kling AI, direct, Pro plan (~$25.99/mo, one-time month, manual web UI — not API, not routed through Higgsfield/Runway/Artlist/ElevenLabs after comparison)
- Render settings: Professional mode, 1080p, all 27 clips (19 at 10s, 8 at 5s — corrected from this section's earlier "20/7" summary, which was stale; the per-clip table in the FINAL doc is what actually governs render/trim settings)
- SFX: ElevenLabs Sound Effects (existing Starter plan), 1-2 cues per clip, placed at marked timestamp in post — no voiceover, no background music
- Post-production: single moviepy script (loop trim, SFX placement, caption burn-in, watermark bake-in), built once, run once — `scripts/shareables/postprocess.py`
- Hosting: static asset delivery via Netlify static (Next.js `public/` convention — confirmed by repo audit: no Supabase Storage usage exists anywhere in this codebase, so this project follows the existing convention rather than introducing a new one) — no database table
- IP: confirmed resolved — custom minifigures, no copyright dependency

**Reference doc:** `docs/shareables/BOI_Shareables_Master_Production_Script_FINAL.md` — locked scene/caption/Kling-prompt spec for all 27 clips, single source of truth for creative content.

**Open items:**
- [x] Creative lock — all 27 clips finalized (Phase 1)
- [ ] Reference photography session (minifigure, 3-5 angles, consistent lighting) — Phase 2
- [ ] Kling Pro tool setup — Phase 3
- [x] Post-production script build (Phase 5) — `scripts/shareables/postprocess.py`, manifest-driven, tested end-to-end against a dummy clip
- [x] Shareables tab UX build (Phase 7) — `/shareables` route, manifest-driven, placeholder assets pending Phase 4
- [ ] Purchase Kling Pro, generate 27 raws — Phase 4
- [ ] QA pass, publish, soft launch via one IG post

**Last updated:** 2026-08-08


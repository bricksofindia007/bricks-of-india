# BOI Master Tracker

> **Purpose:** One-page index of phase status, blockers, and deadlines. Task-level detail lives in the four sub-trackers below.
>
> **Last updated:** 2026-05-30 (Day 30 FINAL — 15-group integrity layer complete (90+ checks), homepage bugs fixed (reviews alias + dead prices table), YouTube hero backfill (10 articles), full site audit confirmed)
> **Health Score: 95** — GEO score < 50 is the sole drag (-5). 52 news articles live. 8 of 9 Lab tools live. Full integrity layer: Checks 1–15 covering routes, DB, content, external deps, performance, visual, pipelines.
> **Audit log:** `audit-block1.log`
> Sub-trackers (Web, Content, Video, Social) refreshed 2026-05-02 to current state via TRACK-HYGIENE-01.

---

## Auto-update protocol

**Source of truth hierarchy:** `BOI_MASTER_TRACKER.md` is the canonical source of truth.
`admin/dashboard.html` is a rendered view of the tracker. If the two ever conflict,
the tracker wins and the dashboard must be reconciled to match.

**Atomic update rule:** Any change to project state — bug closed, fix deployed, pipeline
status moved, audit run, KPI changed, new tool added, cadence modified — MUST update
both files in the same commit. Never one without the other.

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
| Phase 4 | Shorts / Reels workflow (DaVinci + ElevenLabs) | 🔴 Not started | VIDEO |
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

1. **IG System User Token** — current 60-day token expires ~2026-07-23. Manual re-exchange required by **2026-07-16** (hard deadline). Permanent fix (Meta Business Manager System User) deferred.
2. **GSC setup** — Google Search Console not yet verified. Zero Google indexing = no AI overview citations. Manual: DNS TXT via Cloudflare, sitemap submit, request indexing 10 key pages. ~15 min. Unblocks GEO score improvement.
3. **Visual renderer first live run** — `node --env-file=.env.local scripts/visual-renderer.mjs` not yet run against live site. P2.

> CE-01 outreach ✅ DONE 2026-05-29 — r/IndiaLEGO + AFOL India Facebook posted. Awaiting respondents.
> McLaren voice test ✅ DONE — 12 articles published 2026-05-29, voice test passed implicitly.
> Content Quality System v2 ✅ LIVE — first run 2026-05-29, email sent (Resend ID 26c25d6a).

> PARSER-01 closed 2026-05-12 — New Elementary re-enabled via Blogger JSON (commits 700b561 + a311fc6).
> BUG-013 closed 2026-05-02 as mis-diagnosed. GEO-01 hardening shipped. See Sprint changelog Day 2 for details.
> BRICKSET-01 — Listed in Brickset App Directory 2026-05-28 by Huw Millington. URL: brickset.com/article/131478. Quote: "It looks great."

## Carry-overs

| ID | Task | Status | Notes |
|----|------|--------|-------|
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
- BRIEF-01 daily digest live: `scripts/morning-brief.mjs` (6-section HTML email) + `.github/workflows/brief.yml` (01:30 UTC / 07:00 IST). Sender: hello@bricksofindia.com. Resend ID e78409af confirmed.
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

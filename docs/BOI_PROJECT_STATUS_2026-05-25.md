# Bricks of India — Project Status Report
**As of: 2026-05-25 (Day 25)**
**Health score: 80 / 100**
**Site age: ~5 weeks live**

---

## Health Score Breakdown

| Factor | Deduction | Reason |
|--------|-----------|--------|
| Content staleness | −5 | /news 16d stale, /blog 36d stale — 312 signals sitting at /admin/pending |
| WEB-06 not started | −5 | /community route is Fan CoLab critical path, due June 7 |
| GEO score 26 < 50 | −5 | Site not yet indexed on Google (expected for 5-week domain, no backlinks) |
| Voice test pending | −5 | Claude Project workbench not configured |
| **Total deductions** | **−20** | |
| **Score** | **80/100** | |

---

## Section 1 — DONE (Shipped and Live)

### Infrastructure

| Item | Details | Date |
|------|---------|------|
| Domain + DNS | bricksofindia.com on Cloudflare (kira.ns + yadiel.ns), Netlify origin, ImprovMX email MX | April 2026 |
| GitHub Actions deploy | deploy.yml — auto-deploys on every push to main | April 2026 |
| Netlify build | Production build on Netlify, GitHub Actions trigger | April 2026 |
| Supabase database | PostgreSQL — all tables live with RLS | April 2026 |
| Cloudflare edge | India traffic served from BOM (Mumbai) — verified via CF-RAY header | April 2026 |
| HSTS | strict-transport-security: max-age=31536000 — verified | April 2026 |
| Cache-Control headers | Route-specific headers in next.config.mjs (sets, lab, news, blog, admin) | 2026-05-02 |
| AI crawler policy | ROBOTS-01: 9 crawlers allowed (referral-traffic), 13 blocked (training-only) | 2026-05-01 |
| Catalogue sync | sync-catalogue.yml — Sunday 02:00 UTC, ~16,888 sets from Rebrickable | 2026-05-02 |
| Catalogue audit | catalogue-audit.yml — Monday 03:30 UTC, auto-issue if row count drops | 2026-05-02 |
| Price snapshot cron | LAB-03 snapshot — daily 08:30 IST, 724 snapshots/day, 20,820 total | 2026-05-02 |
| Scrape Store Prices | scrape-prices.yml — every 6h, 1,955 rows, Toycra + MyBrickHouse + Jaiman | Ongoing |
| RLS hardening | All active tables have Row Level Security enabled with explicit policies | 2026-05-10 |

### Website Pages (all returning 200)

| Route | Description | Status |
|-------|------------|--------|
| / | Homepage with mascot hero, Lab strip, YouTube strip, newsletter | ✅ Live |
| /sets | Full catalogue — 16,888 sets, paginated, search, price filter | ✅ Live |
| /sets/[slug] | Set detail — price comparison across stores, live store_prices | ✅ Live |
| /themes | Theme hub — 25 theme pages | ✅ Live |
| /deals | Deals page from store_prices table | ✅ Live |
| /reviews | 3 Codex-compliant reviews live | ✅ Live |
| /reviews/[slug] | Review detail with Rating schema + store price sidebar | ✅ Live |
| /news | News page — 24 articles | ✅ Live |
| /news/[slug] | Article detail with Article schema + social share | ✅ Live |
| /blog | Blog page | ✅ Live |
| /blog/[slug] | Blog post detail with ReactMarkdown | ✅ Live |
| /lab | The Lab directory — 3 tools live | ✅ Live |
| /lab/biryani-index | LAB-01 — LEGO price in biryani/chai/petrol equivalent | ✅ Live |
| /lab/which-set | LAB-02 — personality quiz → set recommendation | ✅ Live |
| /lab/heat-map | LAB-07 — D3 choropleth India + world, 23 states, city drill-down | ✅ Live |
| /guides | LAB/WEB-05 — guides index with category tabs (WEB-05, shipped today) | ✅ Live |
| /guides/[slug] | Guide article with Article schema + breadcrumb (WEB-05, shipped today) | ✅ Live |
| /about | Founder page with E-E-A-T signals | ✅ Live |
| /search | Set search | ✅ Live |
| /contact | Contact page | ✅ Live |
| /admin/pending | Operator-gated article review + publish UI (cookie-gated, not public) | ✅ Live |
| /sitemap.xml | 1,025+ URLs including /lab and /guides | ✅ Live |
| /robots.txt | AI crawler policy declared | ✅ Live |
| /llms.txt | GEO/AI readiness — LLM-friendly site description | ✅ Live |

### Content Pipeline (RADAR)

| ID | Component | Status |
|----|----------|--------|
| RADAR-01 | RSS/API/YouTube/Reddit fetcher — 16 active sources | ✅ Done |
| RADAR-02 | 4-pass deduper (exact URL → title → Jaccard ≥0.75 → unique) | ✅ Done |
| RADAR-03 | Classifier → pending_drafts (threshold score ≥4) | ✅ Done |
| RADAR-04 | Gemini article generation — operator-initiated only (not in cron) | ✅ Done |
| RADAR-05 | /admin/pending — 4-state review + publish UI | ✅ Done |
| RADAR-CRON | Daily cron 17:30 UTC (23:00 IST) — RADAR-01→02→03 only | ✅ Running |
| WEB-01 | generateArticle() in actions.ts (Gemini 2.5 Flash-Lite) | ✅ Done |
| WEB-02 | Lint gates — all 4 gates enforced before publishDraft() | ✅ Done |
| WEB-03 | Gate 1: word count (3-state), Gate 2: India Paragraph, Gate 3: verdict enum | ✅ Done |
| WEB-04-Gate | Gate 4: OG image HTTP 200 check in publishDraft() | ✅ Done |

### Social Automation (SOC-AUTO-01)

| Item | Details |
|------|---------|
| Platform | Python 3.11, GitHub Actions, daily 06:30 UTC (12:00 IST) |
| IG Feed | 8-image carousel (7 gallery + stats card), Meta Graph API v19.0 |
| IG Reels | 8s MP4, 3 slides, 0.3s crossfade, Ken Burns, background music |
| YouTube Shorts | 45s MP4, 10 slides, on-screen text overlays, uploaded direct |
| India defense | is_available_in_india() checks store_prices — skips sets already in Indian stores |
| Caption | Gemini 2.5 Flash-Lite, Jeremy Clarkson + Indian wallet anxiety voice |
| Status | **3 successful runs** — 11377-1, 76342-1, 75641-1 |
| Run 3 defense | Blocked 4 India-available sets: 75441-1, 31385-1, 76343-1, 31376-1 |
| IG token | 60-day long-lived token, expires ~2026-07-23 |

### Content Published

| Section | Count | Last Published | State |
|---------|-------|---------------|-------|
| /news articles | 24 | 2026-05-09 | ⚠️ 16 days stale |
| /blog posts | Unknown | 2026-04-19 | ⚠️ 36 days stale |
| /reviews | 3 | 2026-05-14 | ⚠️ 11 days stale |
| Social posts (automated) | 3 sets | 2026-05-25 | ✅ Daily |

**Reviews on record:** McLaren P1 42172 (BUY), Rivendell 10316 (BUY), Natural History Museum 10326 (WAIT FOR SALE)

### Structural / Standards

| Item | Status |
|------|--------|
| Voice Codex v2 | ✅ Done — 21 pages, docs/codex/BOI_Codex_v2.docx |
| JSON-LD schemas | ✅ All pages — Organization, Article, Product, Review, BreadcrumbList |
| Hero image dedup | ✅ Fixed today — publishDraft() now checks for duplicate hero_image URLs |
| RADAR failure documented | ✅ docs/RADAR_FAILURE_REPORT.md — operator bottleneck, not system failure |
| SEO baseline audit | ✅ docs/SEO_ACTION_PLAN.md — Week 1/30/60/90 day plan documented |
| /lab sitemap fix | ✅ /lab, /lab/biryani-index, /lab/which-set, /lab/heat-map added to sitemap |

---

## Section 2 — IN PROGRESS / UNBLOCKED (Started but Incomplete)

| ID | Item | State | Blocker |
|----|------|-------|---------|
| CONTENT-FRESHNESS | 312 approved signals need Generate Article + Publish | 🟡 Operator-blocked | Abhinav must visit /admin/pending |
| CONTENT-02 | Claude Project workbench setup (load Voice Codex as knowledge) | 🟡 Unblocked | Manual task — ~30 min in Claude.ai |
| GEO-01-FU1 | Verify /reviews/[slug] JSON-LD with Rich Results Test (browser) | 🟡 Unblocked | Manual test — Google Rich Results Test |
| GSC SETUP | Google Search Console verification + sitemap submission | 🟡 Unblocked | Manual — DNS TXT record in Cloudflare |
| CATALOG-05 | Theme backfill — older sets missing from theme pages | 🟡 Partial | Rebrickable daily API quota limits one-shot full sync |

---

## Section 3 — PENDING (Not Started)

### P1 — Must do next (Fan CoLab / revenue / critical)

| ID | Item | Due | Effort | Notes |
|----|------|-----|--------|-------|
| WEB-06 | /community route — index + [slug] pages | **June 7** | 1 session | Fan CoLab hard requirement. Needs new `community_spotlights` Supabase table. Blocks CE-01. |
| GUIDES-MIGRATION | Run supabase/migrations/20260525000000_guides.sql in Supabase dashboard | **Now** | 5 min | /guides route is live; table doesn't exist yet. Nothing breaks until first guide is published. |
| CE-05 | "History of LEGO in India" — flagship editorial piece | **July 1** | 4–6h session | Hardest Fan CoLab item. Requires Wayback Machine + Brickset forum research. Start no later than June 8. |
| CE-01 SUBJECTS | Identify 2 Indian AFOL subjects for Builder Spotlights | **June 1** | Outreach | Post in r/IndiaLEGO + AFOL India Facebook group. Needed before CE-01 write. |
| CE-01 | 2 Indian Builder Spotlights at /community | **July 15** | 2 sessions | Blocked on WEB-06 and subject identification. |
| LAB-06 | /lab/deals frontend (India Deals Today) | P1 ongoing | 1 session | Backend data already live in store_prices. Supports CE-06. |
| IG TOKEN | Re-exchange IG access token before 2026-07-16 | **July 16** | 30 min | Current 60-day token expires ~July 23. Must re-exchange every 55 days. |

### P2 — High value, not urgent

| ID | Item | Notes |
|----|------|-------|
| CE-02 | 8 LEGO 101 guides at /guides | Cadence: 1 per 11 days. Start June 8, complete July 25. Route now exists (WEB-05 done). |
| RADAR-08 | Automated reviews pipeline | Target 5+ Codex reviews/week without manual writing. Requires reviews format in RADAR-03. |
| MONETIZE-01 | MyBrickHouse coupon-code arrangement | Most actionable near-term affiliate path after Toycra. |
| MONETIZE-02 | Jaiman Toys coupon-code arrangement | Parallel to MONETIZE-01. |
| IG SYSTEM USER TOKEN | Permanent non-expiring IG token via Meta Business Manager | Eliminates 55-day manual re-exchange. Deferred — current workaround functional. |

### P3 — Later / Nice to have

| ID | Item | Notes |
|----|------|-------|
| CE-03 | Build Debate opinion pieces | Not required for Fan CoLab |
| CE-04 | Blind Bag Reel | Not required for Fan CoLab |
| CE-06 | Deals Alert IG Story | Linked to LAB-06. Not Fan CoLab requirement. |
| LAB-05 | CMF Tracker | No brief yet |
| LAB-07 (new) | Budget Calculator INR | No brief yet |
| LAB-08 | Retiring Soon | Needs 30+ days of price snapshot history (eligible ~June 1) |
| WEB-04 RSS | RSS feed for /news and /reviews | For aggregator pickup |
| CONTENT-03 | DaVinci Resolve template for news Shorts | Phase 4 (video not started) |
| CONTENT-04 | Instagram Canva carousel template | Manual social still pending |
| INSIDERS-01 | LEGO Insiders points reconciliation | Member #811205769 — zero points despite purchase history |
| PERF-01 | Cloudflare edge caching for article pages | Currently DYNAMIC — ~775ms latency, could be ~10ms with caching |
| ADMIN-CLEANUP-01 | Remove legacy Netlify secrets from GitHub Secrets | Low risk, low urgency |
| RLFM-01 | LAN RLFM / Fan CoLab application draft | August 2026 |
| MONETIZE-03 | Amazon affiliate reapplication | Eligible October/November 2026 |

---

## Section 4 — SCHEDULED (Date-Bound)

| Date | Item | Type |
|------|------|------|
| **Every 6 hours** | Scrape Store Prices (Toycra, MyBrickHouse, Jaiman) | Automated cron |
| **Daily 06:30 UTC (12:00 IST)** | Social automation — post to IG Feed, IG Reels, YouTube Shorts | Automated cron |
| **Daily 17:30 UTC (23:00 IST)** | RADAR pipeline — fetch RSS → dedupe → classify → pending_drafts | Automated cron |
| **Daily 08:30 IST** | Price snapshot cron (LAB-03) | Automated cron |
| **Weekly Sun 02:00 UTC** | Catalogue sync from Rebrickable (~16,888 sets) | Automated cron |
| **Weekly Mon 03:30 UTC** | Catalogue health audit — auto-issue if rows drop | Automated cron |
| **2026-06-01** | Identify CE-01 subjects (Indian AFOL builder contacts) | Manual |
| **2026-06-07** | WEB-06 /community route built + deployed | Build task |
| **2026-06-08** | CE-02 Guide 1 of 8 published at /guides | Content task |
| **2026-06-25** | Next project audit | Review |
| **2026-07-01** | CE-05 "History of LEGO in India" published (HARD) | Content task |
| **2026-07-15** | CE-01 Spotlight 1 + 2 live at /community | Content task |
| **2026-07-16** | IG access token re-exchange deadline | Maintenance |
| **2026-07-25** | CE-02 all 8 guides complete | Content task |
| **2026-08-01** | Fan CoLab / RLFM application submitted | Application |

---

## Section 5 — FAN COLAB CRITICAL PATH

**Deadline: August 2026 (~11 weeks from today)**
**Status: 1 of 5 required items complete**

| # | Required Item | Status | Due |
|---|--------------|--------|-----|
| 1 | /guides route live | ✅ **DONE** (WEB-05, shipped 2026-05-25) | Done |
| 2 | 8 LEGO 101 guides at /guides (CE-02) | 🔴 Not started | July 25 |
| 3 | "History of LEGO in India" CE-05 | 🔴 Not started | July 1 (HARD) |
| 4 | /community route live | 🔴 Not started | June 7 |
| 5 | 2 Indian Builder Spotlights at /community (CE-01) | 🔴 Not started | July 15 |

**Already satisfies:** Social automation (SOC-AUTO-01) is live and posting daily. 3 Codex-compliant reviews live.

**Critical path this week:**
1. WEB-06 /community route — 1 session
2. CE-01 subject outreach — post in r/IndiaLEGO + AFOL India Facebook group

---

## Section 6 — OPERATOR ACTIONS (Only Abhinav Can Do These)

These cannot be automated and are currently blocking progress.

| Priority | Action | Where | Time |
|----------|--------|-------|------|
| 🔴 URGENT | Visit /admin/pending — click Generate Article + Publish on approved signals | bricksofindia.com/admin/pending | 2–3h |
| 🔴 URGENT | Run guides table migration SQL in Supabase dashboard | Supabase SQL editor | 5 min |
| 🔴 HIGH | Google Search Console — verify bricksofindia.com (DNS TXT in Cloudflare) | GSC + Cloudflare | 30 min |
| 🔴 HIGH | Submit sitemap.xml in GSC | GSC dashboard | 5 min |
| 🔴 HIGH | Request indexing for 10 key pages via GSC URL Inspection | GSC dashboard | 30 min |
| 🟡 MEDIUM | CE-01 subject outreach — find 2 Indian AFOL builders for spotlights | r/IndiaLEGO, AFOL India FB | 1h |
| 🟡 MEDIUM | Claude Project workbench setup — load Voice Codex into claude.ai project | claude.ai | 30 min |
| 🟡 MEDIUM | Rich Results Test — verify 3 URLs in browser | search.google.com/test/rich-results | 15 min |
| 🟡 LOW | PageSpeed Insights — run on homepage + product page, report scores | pagespeed.web.dev | 15 min |
| 🟡 LOW | Reddit/AFOL outreach — post BOI in r/IndiaLEGO and r/lego | Reddit | 20 min |
| ⏰ CALENDAR | IG token re-exchange by July 16 | Meta Business Suite | 30 min |

---

## Section 7 — DATABASE STATE (Verified 2026-05-25)

| Table | Rows | Notes |
|-------|------|-------|
| store_prices | 1,955 | Scraper writes every 6h |
| price_snapshots | 20,820 | Daily snapshot cron — ~23 days of data |
| sets | ~16,888 | Rebrickable sync weekly |
| raw_signals | 7,403 | RADAR pipeline — last: 2026-05-24T18:39 UTC |
| pending_drafts (draft) | 5 | New signals from last RADAR run |
| pending_drafts (approved) | 312 | **Awaiting Generate Article + Publish clicks** |
| pending_drafts (published) | 4 | Successfully published via pipeline |
| news_articles | 24 | Last: 2026-05-09 |
| reviews | 3 | Last: 2026-05-14 |
| posted_sets | 3 | Social automation run history |
| newsletter_subscribers | Unknown | Resend integration active |
| guides | 0 | **Table not yet created — run migration** |

---

## Section 8 — AUTOMATED PIPELINES (All Healthy)

| Pipeline | Schedule | Last Run | Status |
|----------|----------|----------|--------|
| BOI Social Automation | Daily 06:30 UTC | 2026-05-25 02:50 UTC ✅ | ✅ 3 successful runs |
| RADAR Pipeline | Daily 17:30 UTC | 2026-05-24 18:38 UTC ✅ | ✅ All runs green |
| Scrape Store Prices | Every 6h | 2026-05-24 19:18 UTC ✅ | ✅ All runs green |
| Price Snapshot (LAB-03) | Daily 08:30 IST | 20,820 total | ✅ Running |
| Catalogue Sync | Weekly Sun | Last Sunday | ✅ 16,888 sets |
| Catalogue Audit | Weekly Mon | Last Monday | ✅ No alerts |
| GitHub Actions Deploy | On push to main | 2026-05-25 (today) | ✅ 5929ace |

---

## Section 9 — TOKEN / KEY EXPIRY CALENDAR

| Item | Expires | Action Required | Deadline |
|------|---------|-----------------|---------|
| IG Access Token (long-lived) | ~2026-07-23 | Re-exchange every 55 days | **2026-07-16** (7-day buffer) |
| YouTube OAuth | Never (permanent refresh token) | None | — |
| Supabase service role key | No expiry | None | — |
| Gemini API key | No expiry | None | — |
| Resend API key | No expiry | None | — |

---

## Section 10 — KNOWN ISSUES / ACCEPTED RISKS

| ID | Issue | Severity | Decision |
|----|-------|----------|---------|
| CONTENT-STALENESS | /news 16d stale, /blog 36d stale — 312 signals need operator publish | HIGH | Operator action required. No code fix needed. |
| LEGO.COM CLOUDFLARE | LEGO.com blocks social automation scraper (403) — Rebrickable/Brickset fallback active | MEDIUM | Accepted. India check is the real safety layer. |
| GEO SCORE | Google not yet indexing bricksofindia.com (score 26/100) | MEDIUM | Expected for 5-week domain. GSC setup is the fix. |
| NO BACKLINKS | Zero referring domains — purely new domain | MEDIUM | Week 1 SEO plan addresses this (Reddit + Brickset forum). |
| IG SYSTEM USER | Permanent IG token not set up — using 60-day long-lived token | LOW | Accepted. Manual re-exchange every 55 days. Deferred. |
| HERO IMAGE DEDUP | Fixed today — was causing same image across multiple articles | CLOSED | Fix applied in actions.ts, commit 6d11036. |
| /lab SITEMAP GAP | /lab pages were missing from sitemap.xml | CLOSED | Fixed 2026-05-25, commit 13078b1. |

---

## Section 11 — PRIORITY ORDER (What to Do Next)

**Ranked strictly by impact × urgency:**

| Rank | Action | Why |
|------|--------|-----|
| 1 | **Visit /admin/pending** — Generate + Publish approved signals | /news 16d stale, /blog 36d stale. 312 signals waiting. Biggest visible gap. |
| 2 | **Run guides migration** in Supabase SQL editor | /guides route is live — table doesn't exist. 5-minute fix. |
| 3 | **Build WEB-06 /community** (1 session) | Fan CoLab due June 7. Blocks CE-01 spotlights. |
| 4 | **GSC setup** — verify + submit sitemap + request indexing | Unlocks all SEO progress. Must be done for Google to see the site. |
| 5 | **Identify CE-01 subjects** — 2 Indian AFOL builders | Outreach takes time; start now even if WEB-06 isn't done yet. |
| 6 | **CE-05 research** — start Wayback Machine/Brickset archive research | July 1 hard deadline. Research phase alone needs 2–3 weeks. |
| 7 | **CE-02 Article 1** — first LEGO 101 guide at /guides | Cadence: 1 per 11 days to hit 8 by July 25. |
| 8 | **Claude Project workbench** — load Voice Codex into claude.ai | Improves all content quality. 30-min manual setup. |
| 9 | **LAB-06 /lab/deals** — India Deals Today frontend | Backend data is live. 1-session build. |
| 10 | **Reddit outreach** — post BOI in r/IndiaLEGO + r/lego | First backlinks. Directly improves Google indexing speed. |

---

*Generated from: BOI_MASTER_TRACKER.md, BOI_WEB_TRACKER.md, BOI_CONTENT_TRACKER.md, BOI_SOCIAL_TRACKER.md, BOI_VIDEO_TRACKER.md, docs/FAN_COLAB_TIMELINE.md, docs/SOCIAL_AUTOMATION_STATUS.md, docs/SEO_ACTION_PLAN.md, docs/RADAR_FAILURE_REPORT.md*
*All data verified against live Supabase queries and GitHub Actions run logs.*

# Day 28 Ground Truth — 2026-05-28

## Health Score: 95
GEO score < 50 is the sole drag (-5). All P0 bugs closed. Content freshness restored. Voice test pending < 14 days.

## HEAD Commit: 24066cb (pre-close — tracker+handover commit follows)
Branch: main. In sync with origin after Day 28 close push.

## All Pipelines: Green
radar.yml (RADAR-01→03): daily 23:00 IST ✅
social-automation: daily 12:00 IST ✅
scrape-prices.yml: every 6h ✅
price-snapshot (LAB-03): daily 08:30 IST ✅
sync-catalogue.yml: weekly Sunday 02:00 UTC ✅
catalogue-audit.yml: weekly Monday 03:30 UTC ✅
health-check.yml: daily 08:00 IST (11 checks) ✅
technical-hygiene.yml: weekly Monday 04:00 UTC ✅
brief.yml: daily 01:30 UTC (07:00 IST) ✅
retiring-soon.yml: weekly Sunday 02:00 UTC — NEW ✅
generate-drafts.yml: on-demand dispatch

---

## Session Start Protocol (Day 29)
1. `cat BOI_MASTER_TRACKER.md`
2. Read this file
3. Check BRIEF-01 email arrived at 07:00 IST
4. **Run McLaren voice test FIRST at 06:30 IST before any other terminal work:**
   ```
   node --env-file=.env.local scripts/generate-approved-drafts.js --id f9cb0916-64be-4bad-9ae1-add1256e380d
   ```
   Paste raw output to strategic Claude for voice check.
   Do NOT batch publish until voice check passes.
5. CE-01 outreach — DEADLINE JUNE 1. Post r/IndiaLEGO + AFOL India FB (drafts below).

---

## Completed This Session (Day 28 — includes Day 27 carryovers)

### Routes shipped
- `/opinion` — index page (blog_posts category=Opinion, newest first)
- `/opinion/[slug]` — article page, canonical set, 404 if not Opinion category
- `/lab/budget-calculator` — Budget Calculator (LAB-07)
- `/lab/retiring-soon` — Retirement Radar (LAB-08)
- `/lab/cmf-tracker` — CMF Tracker (LAB-05)
- `/guides` + `/guides/[slug]` — DONE (Day 25 WEB-05), confirmed 9 guides live

### Content published
- CE-02: 8 LEGO 101 guides (IDs 1–8)
- CE-05: History of LEGO in India (ID 9) — `/guides/history-of-lego-in-india`
- 3 opinion posts: `certified-store-india-charges-too-much`, `lego-should-manufacture-in-india`, `star-wars-lego-will-bankrupt-you`
- 1 news article: `lego-eiffel-tower-10307-retiring-india`

### Infrastructure
- CATALOG-04 v2: `retirement_date` (date), `is_retiring_soon` (bool), `retired` (bool) columns on sets table
- `scripts/populate-mrp.js` Phase 5: reads Brickset `exitDate`, writes `retirement_date` for all matched sets (3,039 rows)
- `scripts/update-retiring-soon.mjs`: 3-pass flag script — 2,202 sets retired, 128 is_retiring_soon=true
- `.github/workflows/retiring-soon.yml`: weekly Sunday 02:00 UTC
- `scripts/generate-approved-drafts.js`: Gemini prompt rewritten (few-shot examples, forbidden patterns, verdict enum fixed)
- `scripts/insert-news-eiffel-tower.js`: one-shot news insert

### External milestone
- **Brickset App Directory listing** — BRICKSET-01 COMPLETE. Added by Huw Millington personally, same day. URL: brickset.com/article/131478. Quote: "It looks great." First external authority validation from the global LEGO hobby ecosystem.

### Day 27 carryovers (included in Day 28 close)
- BRIEF-01: `scripts/morning-brief.mjs` + `.github/workflows/brief.yml` daily 07:00 IST, Resend confirmed
- RESEND_API_KEY fixed
- health-check.yml 11 checks
- /admin/pending body expander
- Gemini prompt rewrite (few-shot examples, verdict fix)

---

## Verified Live Pages (complete list as of Day 28)

Core:
`/`, `/sets`, `/sets/[slug]`, `/sets/page/[page]`, `/themes`, `/themes/[slug]`, `/deals`, `/reviews`, `/reviews/[slug]`, `/news`, `/news/[slug]`, `/blog`, `/blog/[slug]`, `/about`, `/search`, `/contact`

Content:
`/guides`, `/guides/[slug]` (9 guides), `/opinion`, `/opinion/[slug]` (3 posts), `/community`, `/community/[slug]`

Lab:
`/lab`, `/lab/biryani-index`, `/lab/which-set`, `/lab/heat-map`, `/lab/deals`, `/lab/budget-calculator`, `/lab/retiring-soon`, `/lab/cmf-tracker`

Admin + infra:
`/admin/pending`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`

---

## Database State (verified 2026-05-28)

| Table | Count | Notes |
|-------|-------|-------|
| sets | 24,559 | lego_mrp_inr: 45% (3,405/7,547 ≥2020) |
| sets.retirement_date | 3,039 | Written by populate-mrp.js Phase 5 |
| sets.is_retiring_soon | 128 | Within 90-day window |
| sets.retired | 2,202 | retirement_date ≤ today |
| store_prices | ~1,955 | In-stock rows |
| price_snapshots | 20,820+ | |
| news_articles | 26 | Last published: 2026-05-28 (today) |
| reviews | 3 | + 10 RADAR-08 drafts queued in pending_drafts |
| blog_posts | 22 | 3 new opinions + 19 legacy |
| pending_drafts (approved) | ~312 | Awaiting Gemini body generation |
| guides | 9 | IDs 1–9 |
| community_spotlights | 0 | CE-01 outreach not sent yet |
| newsletter_subscribers | 1 | |
| posted_sets | 4 | |

---

## Automated Pipelines (all green as of 2026-05-28)

| Pipeline | Schedule | Status |
|----------|----------|--------|
| RADAR fetch→dedupe→classify | Daily 23:00 IST | ✅ Green |
| RADAR-08 reviews seeder | Daily 23:00 IST (after RADAR-03) | ✅ Green |
| Social automation (IG+YT) | Daily 12:00 IST | ✅ Green |
| Scrape store prices | Every 6h | ✅ Green |
| Price snapshot (LAB-03) | Daily 08:30 IST | ✅ Green |
| Catalogue sync | Weekly Sunday 02:00 UTC | ✅ Green |
| Catalogue audit | Weekly Monday 03:30 UTC | ✅ Green |
| health-check.yml | Daily 08:00 IST (11 checks) | ✅ Green |
| technical-hygiene.yml | Weekly Monday 04:00 UTC | ✅ Green |
| brief.yml | Daily 01:30 UTC (07:00 IST) | ✅ Green — new Day 27 |
| retiring-soon.yml | Weekly Sunday 02:00 UTC | ✅ Green — new Day 28 |
| generate-drafts.yml | On-demand dispatch | Manual only |

---

## Content State

| Section | Count | Freshness |
|---------|-------|-----------|
| /news | 26 articles | Fresh — published today |
| /opinion | 3 posts | Fresh — published today |
| /blog | 22 rows | Fresh — 3 new opinions published today |
| /guides | 9 guides | Fresh — CE-02/CE-05 published today |
| /reviews | 3 live + 10 RADAR-08 queued | Last published Day 14 |
| /community | 0 live | CE-01 outreach not sent |
| Social | 4 sets posted | Daily automated |

---

## P0 — First Thing Tomorrow (Day 29)

### 1. McLaren voice test (06:30 IST — BEFORE ANYTHING ELSE)
```bash
node --env-file=.env.local scripts/generate-approved-drafts.js --id f9cb0916-64be-4bad-9ae1-add1256e380d
```
Paste raw terminal output (the generated article body) to strategic Claude.
Strategic Claude checks against BOI Voice Codex:
- India hook in para 1
- ₹ price + store name
- India Paragraph with <!-- INDIA_PARAGRAPH --> marker
- Verdict: BUY NOW / WAIT / IMPORT ONLY / AVOID
- No "So," opener, no markdown asterisks

If voice check PASSES → run batch:
```bash
node --env-file=.env.local scripts/generate-approved-drafts.js --limit 15
```
Then spot-check one article at /admin/pending → publish /news until >50 articles live.

If voice check FAILS → do NOT batch. Report specific failure to strategic Claude.

### 2. CE-01 outreach — DEADLINE JUNE 1 (TOMORROW)
Post to **r/IndiaLEGO**:
```
Title: Looking for Indian AFOL builders to feature on Bricks of India — anyone interested?

Hey r/IndiaLEGO,

I run Bricks of India (bricksofindia.com) — an Indian LEGO price comparison and content site. Been building it since August 2025 and it has been a fun ride.

I am starting a Builder Spotlight series on the site — short features on Indian AFOL builders, their collections, their builds, how they got into LEGO, and what it is like being a serious collector in India where the prices are what they are.

Looking for 2 builders to feature first. No follower count requirement, no minimum collection size. Just genuine Indian LEGO fans with a story worth telling.

What is involved:
- 8-10 questions over email or DM
- A few photos of your collection or favourite builds
- One published feature on the site with full credit and links to your social if you want

If you are interested or know someone who should be featured, drop a comment or DM me.

Abhinav — Bricks of India
```

Post to **AFOL India Facebook**:
```
Hi everyone,

I run Bricks of India (bricksofindia.com) — an Indian LEGO price comparison and content platform I have been building since August 2025. If you have used it to compare prices across Toycra, MyBrickHouse, and Jaiman before a purchase — thank you, genuinely.

I am launching a Builder Spotlight series on the site — proper written features on Indian AFOL builders. The Indian LEGO community has been here long before any certified store opened, and I want to document that.

Looking for 2 builders to feature in the first round. What it involves:
— 8 to 10 questions over email or WhatsApp
— A few photos of your collection or builds
— A published feature at bricksofindia.com/community with full credit and your social links if you want them included

No requirements on collection size, theme, or how long you have been collecting. Interesting story is the only criteria.

Comment below or send me a message if you are interested.

Thanks
Abhinav
Bricks of India
bricksofindia.com
```

---

## P1 — This Week

- Publish 50+ /news articles (after voice check passes)
- Publish 10 RADAR-08 review drafts
- Monthly SEO audit (first one — June baseline)
- Reddit post r/lego for backlinks

---

## Fan CoLab Critical Path

**Deadline: August 1 2026 (64 days)**

| Item | Status | Notes |
|------|--------|-------|
| /guides route | ✅ DONE | WEB-05, Day 25 |
| 8 LEGO 101 guides | ✅ DONE | CE-02, Day 28 |
| History of LEGO in India | ✅ DONE | CE-05, Day 28 |
| /community route | ✅ DONE | WEB-06, Day 25 |
| 2 Builder Spotlights | 🔴 NOT STARTED | CE-01 outreach due June 1 |
| Daily social automation | ✅ DONE | SOC-AUTO-01, Day 24 |
| 3+ Codex reviews | ✅ DONE | 3 reviews live (Day 14) |
| Price comparison | ✅ DONE | Live since launch |
| 24,559 set catalogue | ✅ DONE | |
| Brickset listing | ✅ DONE | BRICKSET-01, Day 28 |

**Critical path to August 1:** CE-01 outreach (June 1) → interviews (June) → write + publish 2 spotlights (July 15) → done.

---

## Voice Codex — Current Prompt State (Day 28)

Gemini prompt in `scripts/generate-approved-drafts.js` rewritten with:
- 4 annotated few-shot examples
- Forbidden patterns list updated ("So," added)
- Verdict options fixed: BUY NOW / WAIT / IMPORT ONLY / AVOID
- No markdown / no asterisks rule explicit
- Specific numeric India comparisons required
- India Paragraph marker placement enforced

Mirror copy: `src/lib/generate-body.ts`

**McLaren F1 test ID:** `f9cb0916-64be-4bad-9ae1-add1256e380d`
Run at 06:30 IST — paste to strategic Claude before any batch.

---

## McLaren Test Command
```bash
node --env-file=.env.local scripts/generate-approved-drafts.js --id f9cb0916-64be-4bad-9ae1-add1256e380d
```

---

## Token Expiry Calendar

| Token | Expires | Action by |
|-------|---------|-----------|
| IG Access Token | ~2026-07-23 | Re-exchange by **2026-07-16** |
| GH_DISPATCH_TOKEN PAT | 2027-05-27 | — |
| YouTube OAuth | Permanent | — |

---

## Brickset Listing

- **URL:** brickset.com/article/131478
- **Added by:** Huw Millington (Brickset founder), same day as submission
- **Date:** 2026-05-28
- **Quote:** "It looks great."
- **Significance:** First external authority validation from within the global LEGO hobby ecosystem. Visible to all Brickset users — the canonical LEGO reference database internationally.

---

## Known Issues

| Issue | Priority | Notes |
|-------|----------|-------|
| blog_posts 19 legacy rows uncategorised (not Opinion) | P3 | Cleanup deferred |
| lego_mrp_inr NULL ~55% of sets | P2 | populate-mrp.js ran; limited by sets without US retail price |
| Store coverage 5.8% of catalogue | P2 | Scraper matches 5.8% — expand stores or improve matching |
| CONTENT-RENDER-03 excerpt strip | P3 | stripMarkdown() in ArticleCard |
| HOME-HERO-01 missing some viewports | P3 | Hero responsive gaps |
| PROCESS-RLS-02 9 tables unaudited | P2 | RLS audit deferred |
| INSIDERS-01 zero points #811205769 | P3 | LEGO Insiders account |
| BUG-04 DK books in /compare | P3 | Non-LEGO items in store scrape |

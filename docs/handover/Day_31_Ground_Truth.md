# Day 31 Ground Truth — 2026-05-31
_Session close. UTC: 2026-05-30T20:39_

## HEAD
329f983 — hygiene: add checks 16-23 + delete 6 dead debug scripts

## Commit log — Day 31 only (on top of Day 30 FINAL f0a4206)

| Commit | What |
|--------|------|
| `323ea52` | fix: blog H1, guide card fallbacks, prose paragraph spacing |
| `a241dd2` | fix: prose spacing all content pages + MyBrickHouse URL + Rivendell MRP |
| `11a0b89` | fix: MBH name-based set number fallback in parseProduct |
| `329f983` | hygiene: add checks 16–23 + delete 6 dead debug scripts (HEAD) |

---

## What changed today

### Visual fixes
- `blog/page.tsx`: H1 was "GUIDES & OPINION" — now "BLOG" (matches nav label)
- `guides/page.tsx`: blank grey card fallback replaced with branded gradient tile
  - India Specific → saffron (#F7A800)
  - Advanced → red (#E3000B)
  - Getting Started → blue (#006CB7)
  - BOI wordmark + LEGO stud pattern SVG overlay (opacity-20)
- Prose paragraph spacing added to all 5 content slug pages:
  `prose-p:mb-5 prose-p:leading-relaxed prose-headings:mt-8 prose-headings:mb-3 prose-h2:text-2xl prose-h3:text-xl`
  Applies to: `blog/[slug]`, `guides/[slug]`, `opinion/[slug]`, `news/[slug]`, `reviews/[slug]`
  Note: `community/[slug]` has no prose block — skip intentional

### Data fixes (DB only, no code commit)
- `reviews.verdict`: 3 rows BUY → BUY NOW (McLaren P1 42172, Rivendell 10316, NHM 10326)
  Reason: VALID_VERDICTS set has 'BUY NOW' not 'BUY'; these were seeded pre-gate
- `sets.lego_mrp_inr` for 10316 Rivendell: 45000 → 50399
  Reason: MBH live page shows ₹50,399 — this is the correct India retail price

### Code fix — lab/which-set MyBrickHouse URL
- `src/app/lab/which-set/page.tsx` line 148: `mybrickhouse.in` → `lego.mybrickhouse.com`
  The scraper has always used `lego.mybrickhouse.com` (correct). This was a dead quiz link only.

### Scraper fix — MBH name-based set number fallback
**File:** `scripts/scrape-now.mjs`

**Problem:** MBH product titles like "THE LORD OF THE RINGS: RIVENDELL™" have no set number
in title or handle. `extractSetNumber()` returns null → `parseProduct()` drops product silently.
7 out of 874 MBH products affected. 3 were real sets (4 were accessories/test entries).

**Fix:**
1. `knownSetsByName = new Map()` declared at module level
2. `sets` load query extended to `select('set_number, name')`
3. Same load loop now populates `knownSetsByName` — no extra DB call
4. In `parseProduct()`: if `extractSetNumber()` returns null AND `storeId === 'mybrickhouse'`:
   - clean title: lowercase, strip ™®©, collapse whitespace, strip leading "the "
   - lookup in `knownSetsByName`
   - if match found: use that set_number

**Results (verified live after scraper run):**
- 10316 Rivendell: ₹50,399 ✅ in stock at MBH — **now in store_prices for first time**
- 30736 White Seaplane (Technic polybag): matched ✅
- 30734 Mini F1 Academy Car (Speed Champions polybag): matched ✅
- Accessories (Mug, Satchel, dummy products): correctly dropped ✅
- store_prices total: 2,597 → **2,600**

### Integrity layer — Checks 16–23 added to technical-hygiene.mjs

| Check | What it catches |
|-------|----------------|
| 16 | Reviewed sets missing store_prices — sidebar empty on review page |
| 17 | Reviews verdict not in VALID_VERDICTS — BOI Says component broken |
| 18 | Reviewed sets missing lego_mrp_inr — "X% below MRP" callout disappears |
| 19 | Approved pending_drafts with null draft_title — skipped by generator silently |
| 20 | Per-store count below baseline (Toycra≥500, MBH≥800, Jaiman≥1000) — scraper regression |
| 21 | Tier-1 RSS freshness 48h — Brothers Brick, Jay's Brick Blog, BrickNerd, New Elementary |
| 22 | guides.featured_image_url coverage tracker — log only, not alert |
| 23 | Slug collision between reviews and news_articles — routing guard |

Note: Check 21 source names corrected to actual `raw_signals.source_name` values
(user spec had Brickset/Eurobricks which are Tier 2/5, not Tier 1).

**6 dead debug scripts deleted:**
`investigate-10326.mjs`, `debug-mbh-10326.mjs`, `check-prices-10326.mjs`,
`verify-10326.mjs`, `find-nhm-review.mjs`, `inspect-nhm.mjs`
— all resolved diagnostics from Rivendell price debugging session.

---

## DB state at close (2026-05-30T20:39 UTC)

| Table | Count | Notes |
|-------|-------|-------|
| news_articles | 53 | — |
| blog_posts | 22 | — |
| reviews | 3 | verdicts: all BUY NOW (patched today) |
| guides | 9 | featured_image_url: 9/9 null (fallback gradient rendering) |
| store_prices | 2,600 | +3 MBH from scraper fix |
| pending_drafts | 463 | approved:355, draft:72, published:32, rejected:4 |
| raw_signals | 9,585 | — |
| sets | 24,559 | 10316 lego_mrp_inr patched to 50399 |
| newsletter_subscribers | 1 | — |

---

## All Pipelines: Green

| Pipeline | Schedule | Status |
|----------|----------|--------|
| radar.yml (RADAR-01→03 + RADAR-08) | Daily 23:00 IST | ✅ |
| social-automation.yml | Daily 12:00 IST | ✅ |
| scrape-prices.yml | Every 6h | ✅ + MBH name fallback now active |
| price-snapshot (LAB-03) | Daily 08:30 IST | ✅ |
| sync-catalogue.yml | Weekly Sunday 02:00 UTC | ✅ |
| catalogue-audit.yml | Weekly Monday 03:30 UTC | ✅ |
| health-check.yml | Daily 08:00 IST | ✅ |
| technical-hygiene.yml | Weekly Monday 04:00 UTC | ✅ — 23 check groups |
| code-audit.yml | Weekly Monday 05:00 UTC | ✅ |
| brief.yml | Daily 07:00 IST | ✅ |
| retiring-soon.yml | Weekly Sunday 02:00 UTC | ✅ |
| content-quality.yml | Daily 08:30 IST | ✅ |
| generate-drafts.yml | On-demand | Manual only |
| publish-drafts.yml | On-demand | ✅ |

---

## Known acceptable state (not bugs)

- `guides.featured_image_url`: 9/9 null — branded gradient fallback renders correctly
- `news_articles.hero_image`: 3 null — MOC articles (Dream Kitchen, DIY Studio, 1999 Adventurers)
  with no identifiable LEGO set — acceptable, ArticleCard shows generic fallback
- `sets.lego_mrp_inr`: 86% null — expected, only 2020+ sets have Brickset US retail price
- Review-format pending_drafts (107): publish to `news_articles` as category=Review by design.
  The `reviews` table is manual-only (requires set_id UUID, rating int, youtube_url)
- `community/[slug]`: no prose wrapper — no spacing fix needed, plain text
- generate+publish not run today — Gemini quota exhausted (~2 drafts generated before 429).
  355 approved drafts queued. Quota resets midnight Pacific (~12:30 IST).

## Architecture decisions made today

- `reviews` table stays manual-curated only. Pipeline reviews → `news_articles` (category=Review).
- MBH name fallback is `storeId === 'mybrickhouse'` only — not generalised to other stores.
  Reason: MBH is the only store with a LEGO-only domain where set numbers are routinely omitted.
- `community/[slug]` excluded from prose spacing — it has no ReactMarkdown/prose block.
- Check 21 Tier-1 sources use actual `source_name` values, not user-facing store names.

---

## Session start protocol (Day 32)

1. `cat BOI_MASTER_TRACKER.md`
2. Read this file
3. Check BRIEF-01 email (07:00 IST) and CQS email (08:30 IST)
4. **Gemini quota reset — run first thing:**
   ```
   node --env-file=.env.local scripts/generate-approved-drafts.js --limit 15
   node --env-file=.env.local scripts/publish-drafts.mjs --limit 15
   ```
5. **GSC setup** — DNS TXT via Cloudflare → verify property → submit sitemap.xml →
   request indexing on 10 key pages. ~15 min. Unblocks GEO score improvement entirely.
6. **CE-01 Builder Spotlights** — check Reddit/FB inbox for responses
7. **Visual renderer ISSUES** — 3 articles flagged. Check `content_quality_issues` in
   Supabase for which Playwright check failed on each article.

## Hard deadlines

| Deadline | Item |
|----------|------|
| **2026-07-16** | IG System User Token re-exchange (permanent fix deferred, current token expires 2026-07-23) |
| **2026-07-15** | CE-01 Builder Spotlight ×2 published at /community |
| **2026-08-01** | LEGO Fan CoLab application submitted |

# Day 30 Ground Truth — 2026-05-30

## Health Score: 95
GEO score < 50 is the sole drag (-5). 52 news articles live. 8 of 9 Lab tools live. CQS v2 running daily. Social automation back online after 2-day outage. India Paragraph prompt hardened — MANDATORY COMPARISON now required for all article types including MOC/fan-build/vintage.

## HEAD Commit: 9744990
fix: harden India Paragraph comparison — mandatory for all article types
Branch: main. In sync with origin.

## All Commits This Session (Day 30)
| Commit | What |
|--------|------|
| `21e0de2` | fix: apt-get update before install — social automation libcaca0 mirror 404 |
| `b2c5cf5` | fix: social automation caption + image quality (piece count N/A, monsoon guardrail, asterisk strip) |
| `4a41d99` | geo: expand llms.txt, /community to sitemap, NewsArticle schema on news pages |
| `59d28eb` | chore: reset-failing-drafts.mjs tool |
| `1159c53` | feat: Publish All button → GHA link; publishOneDraft() helper refactor |
| `8e7eb1f` | feat: LAB-09 price drop board + publish-drafts GHA workflow |
| `9744990` | fix: harden India Paragraph comparison — MANDATORY for all article types (HEAD) |

## All Pipelines: Green
| Pipeline | Schedule | Status |
|----------|----------|--------|
| radar.yml (RADAR-01→03) | Daily 23:00 IST | ✅ Green |
| RADAR-08 reviews seeder | Daily 23:00 IST | ✅ Green |
| social-automation | Daily 12:00 IST | ✅ Green — was down May 29–30, fixed commit 21e0de2 |
| scrape-prices.yml | Every 6h | ✅ Green |
| price-snapshot (LAB-03) | Daily 08:30 IST | ✅ Green |
| sync-catalogue.yml | Weekly Sunday 02:00 UTC | ✅ Green |
| catalogue-audit.yml | Weekly Monday 03:30 UTC | ✅ Green |
| health-check.yml | Daily 08:00 IST | ✅ Green |
| technical-hygiene.yml | Weekly Monday 04:00 UTC | ✅ Green |
| brief.yml | Daily 01:30 UTC (07:00 IST) | ✅ Green |
| retiring-soon.yml | Weekly Sunday 02:00 UTC | ✅ Green |
| content-quality.yml | Daily 03:00 UTC | ✅ Green |
| generate-drafts.yml | On-demand dispatch | Manual only |
| publish-drafts.yml | On-demand dispatch | ✅ NEW — live as of today |

---

## What Shipped Today

### Social Automation Fixes
- **Root cause**: libcaca0 (indirect ffmpeg dep) removed from Ubuntu noble-updates apt mirror. Runner's cached index still referenced the removed package. `apt-get` failed with exit code 100 before any Python ran.
- **Fix**: `apt-get update -y` before install in `social-automation.yml`.
- **Caption writer hardening**: `piece count 0 → 'N/A'` in carousel image overlay (was showing `?`); `monsoon`/`season`/`weather` banned in SYSTEM_PROMPT; `re.sub(r'\*+', '', caption)` strips Gemini asterisks before use.
- Verified: manual dispatch run completed in 7m30s (matches May 28 baseline).

### GEO Improvements
- `public/llms.txt`: 24 → 60 lines. Now includes all 7 lab tools, /guides (9 articles), /opinion, /community, data sourcing details (Shopify API, daily scrape, Rebrickable), Brickset listing note.
- `/community` added to `sitemap.ts` (was the only live route missing from sitemap).
- `buildArticleSchema()` accepts `type` param — news/[slug] emits `NewsArticle`, blog/guides/opinion emit `Article`. Correct schema types for AI/search crawler differentiation.

### Admin Pending — Publish All Refactor
- `PublishAllButton.tsx`: removed useState/useRouter/Server Action entirely. Now a static link: "N ready — Run publish-drafts on GitHub Actions ↗" pointing to workflow dispatch URL.
- `actions.ts`: `publishAll()` Server Action removed. `publishOneDraft()` private helper extracted from `publishDraft()` — DRY, shared, zero behaviour change on single-draft publish.

### LAB-09 Price Drop Board (/lab/price-drops)
- **Data**: `store_prices` (current price per set/store) vs oldest 5 pages of `price_history` in 30-day window ordered ASC. First occurrence per (set_id, store_id) = baseline. Drop = current < baseline by ≥₹200 or ≥5%.
- **Display**: set image, name, set number, theme, store badge, strikethrough old price → new price, green drop badge (−₹X, Y% off), ABHINAV12 Toycra discount, "Updated [date]", View Set button.
- **Filters**: store dropdown, theme dropdown, min % drop (10/20/30%). Server-side via `searchParams`. Clear link when active.
- **Sort**: biggest ₹ drop first.
- **Empty state**: "No price drops in the last 30 days — check back soon. Our scrapers run daily."
- **UI**: saffron top stripe, Fredoka heading, identical card style to retiring-soon.
- `lab-tools.ts` unlocked (`coming_soon` → `live`, `href: null` → `/lab/price-drops`).
- Added to `sitemap.ts`.

### publish-drafts.yml GHA Workflow
- `workflow_dispatch` with `limit` input (default: 15).
- Runs `node scripts/publish-drafts.mjs --limit ${{ inputs.limit }}`.
- Secrets: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`.
- Eliminates Netlify function timeout risk for batch publishes.

### India Paragraph Prompt Hardening
- **Problem**: `INDIA_COMPARISON_RE` failing on 9 recurring drafts. Root cause: comparison was soft bullet 5 of 6, no explicit instruction for MOC/no-price-data articles. Gemini skipped it when no price existed.
- **Fix in `scripts/generate-approved-drafts.js`** (`VOICE_EXAMPLES` const, line ~96):
  - `MANDATORY COMPARISON` heading replaces the soft bullet.
  - Explicit fork: (a) price data → actual INR comparison; (b) no price data → aspirational estimate required.
  - "standalone sentence", "number + Indian reference", "Do not skip under any circumstances."
- 9 failing drafts (Megatron BrickHeadz, Road Bike 11380, Koi MOC, Volvo MOC, Bo-Katan MOC, Shape of Water, Amazon Ancient Ruins ×3) already reset to `approved` for tonight's run.

### Content Published Today
- **Batch 1** (from yesterday's quota): 3 articles published early in session.
- **Batch 2**: generate run (15 generated, 5 published, 10 failed Gate 2). Net: **news: 47 → 52**.
- 9 Gate 2 failures reset by `reset-failing-drafts.mjs`. 1 Gate 1 failure (Tahu, 224w) reset manually.

---

## Pending Tonight (Quota Reset ~12:30 IST)

### Priority 1: Generate + Publish with hardened prompt
```
node --env-file=.env.local scripts/generate-approved-drafts.js --limit 15
node --env-file=.env.local scripts/publish-drafts.mjs --limit 15
```
The 9 reset drafts (Megatron, Road Bike, Koi MOC, Volvo MOC, Bo-Katan MOC, Shape of Water, Amazon Ancient Ruins ×3) should now produce compliant India Paragraphs. If any still fail, check: does the new prompt appear in generate-approved-drafts.js `VOICE_EXAMPLES`? It should be at lines ~96–113.

### Priority 2: Check social automation ran cleanly
The May 30 manual dispatch confirmed 7m30s success. The next scheduled run is 12:00 IST daily — should be May 31. Monitor via GH Actions.

---

## Open Items (carry into Day 31)

### P1 — Hard Deadlines
| Item | Action | Due |
|------|--------|-----|
| IG System User Token | Re-exchange at Instagram → Settings → Advanced → Token refresh. Or go to Meta Business Manager for permanent System User fix. | **2026-07-16** |

### P2 — This Week
| Item | Action |
|------|--------|
| GSC setup | Manual: Cloudflare DNS TXT → verify bricksofindia.com property → submit sitemap.xml → request indexing 10 pages. ~15 min. Instructions in docs/SEO_ACTION_PLAN.md. |
| Visual renderer first live run | `node --env-file=.env.local scripts/visual-renderer.mjs` — 14 Playwright checks on live site. Never run. |
| GEO score diagnosis | Score is 26. Root cause unknown — no measurement tool identified. GSC setup is prerequisite. |
| Content freshness | /news at 52. Target 75+ before Fan CoLab application. Run generate + publish daily. |
| CE-01 Builder Spotlights | CE-01 outreach done (r/IndiaLEGO + AFOL India FB, 2026-05-29). Awaiting respondents. DM any r/IndiaLEGO replies. Deadline July 15. |

### P3 — Queued
| Item | Notes |
|------|-------|
| SETS-02/03/04 | Filters, sort, enrichment on /sets — waiting for traffic data |
| LAB-09 | ✅ DONE today. LAB-10 (Brick Portfolio) needs user accounts — deferred indefinitely |
| Price Drop Board data freshness | Page shows drops vs baseline from start of 30-day window. Re-evaluate comparison logic after 60 days of history |
| DESIGN-CSS-03 | /admin/pending inline style cleanup (37+ inline styles) — cosmetic |

---

## Database State (2026-05-30)

| Table | Count | Notes |
|-------|-------|-------|
| sets | 24,559 | lego_mrp_inr: 45% (3,405/7,547 ≥2020) |
| sets.retirement_date | 3,039 | |
| sets.is_retiring_soon | 128 | |
| sets.retired | 2,202 | |
| store_prices | ~1,955 | |
| price_history | ~23,000+ | 30+ days of daily snapshots — LAB-09 data eligible |
| news_articles | 52 | +5 published today |
| reviews | 3 | + RADAR-08 review drafts in approved queue |
| blog_posts | 22 | 3 opinion + 19 legacy |
| guides | 9 | |
| pending_drafts (approved, no body) | ~333 | 9 reset with new prompt |
| community_spotlights | 0 | CE-01 outreach sent — waiting |
| content_quality_issues | 130 open | From Day 29 CQS first run |

---

## Fan CoLab Status (August 1 2026 — 63 days)

| Item | Status |
|------|--------|
| /guides route (WEB-05) | ✅ DONE Day 25 |
| 9 guides live (CE-02 + CE-05) | ✅ DONE Day 28 |
| History of LEGO in India (CE-05) | ✅ DONE Day 28 |
| /community route (WEB-06) | ✅ DONE Day 25 |
| 2 Builder Spotlights (CE-01) | 🟡 Outreach done 2026-05-29. Awaiting respondents. Target: July 15. |
| Daily social automation | ✅ DONE — fixed today after 2-day outage |
| 3+ Codex reviews | ✅ DONE (3 live) |
| Brickset App Directory listing | ✅ DONE — Huw Millington, "It looks great." |

Critical path: receive CE-01 responses → interview → write → publish 2 spotlights by July 15 → submit application August 1.

---

## Lab Tools Status
| ID | Route | Status |
|----|-------|--------|
| LAB-01 | /lab/biryani-index | ✅ Live |
| LAB-02 | /lab/which-set | ✅ Live |
| LAB-03 | (price snapshot cron) | ✅ Live |
| LAB-04 | /lab (directory) | ✅ Live |
| LAB-05 | /lab/cmf-tracker | ✅ Live |
| LAB-06 | /lab/deals | ✅ Live |
| LAB-07 | /lab/budget-calculator | ✅ Live |
| LAB-07b | /lab/heat-map | ✅ Live |
| LAB-08 | /lab/retiring-soon | ✅ Live |
| LAB-09 | /lab/price-drops | ✅ Live — shipped today |
| LAB-10 | /lab/portfolio | 🔴 Not started (needs user accounts) |

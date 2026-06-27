# Day 30 Ground Truth — 2026-05-30 (FINAL)

## Health Score: 95
GEO score < 50 is the sole drag (-5). All other systems green.
52 news articles live. 8 of 9 Lab tools live. Full 15-group integrity layer operational.
Homepage bugs fixed (reviews alias + dead prices table). YouTube hero images replaced.
Integrity layer audit confirmed — every layer covered.

## HEAD Commit: f0a4206
chore: P1 integrity gaps closed -- checks 8g-8n, 9f-9h, 9 route additions
Branch: main. In sync with origin.

---

## Complete Commit Log — Day 30 (17 commits)

| Commit | What |
|--------|------|
| `21e0de2` | fix: apt-get update — social automation libcaca0 mirror 404 |
| `b2c5cf5` | fix: caption writer (piece count N/A, monsoon guardrail, asterisk strip) |
| `4a41d99` | geo: llms.txt expanded, /community sitemap, NewsArticle schema |
| `59d28eb` | chore: reset-failing-drafts.mjs |
| `1159c53` | feat: PublishAll → GHA link; publishOneDraft() helper refactor |
| `8e7eb1f` | feat: LAB-09 price-drops + publish-drafts.yml |
| `9744990` | fix: India Paragraph MANDATORY COMPARISON hardening |
| `d9676e1` | chore: close stale NETLIFY-CREDITS tracker item |
| `6a1d639` | chore: Day 30 AM tracker + handover + Fan CoLab timeline |
| `fa55271` | fix: Gate 3 news exemption + BOM strip (content-quality-report) |
| `44070c0` | fix: Map iteration downlevelIteration (price-drops page TS build) |
| `684b28a` | fix: Set/Map spread → Array.from (price-drops final build fix) |
| `910346a` | fix: related-set prices dead table → store_prices; anon → service role |
| `789cf6c` | feat: SCRAPE-03 per-store zero-row alert via Resend |
| `3229ceb` | chore: code-audit.yml weekly workflow |
| `61486d3` | chore: /lab/price-drops to technical-hygiene routes |
| `6d1792c` | feat: SETS-02/03/04 filters + sort + searchParams pagination |
| `87a72ca` | chore: data integrity Check 7 (7a–7f) + CONTRIBUTING rule |
| `f016b7c` | feat: CATALOG-05 dynamic theme list via Supabase RPC |
| `2bfb6e5` | chore: Day 30 close — tracker + ground truth |
| `b59b6d1` | fix: YouTube hero backfill (10 articles) + year-exclusion filter + pipeline fix |
| `139a887` | chore: P1 integrity checks + null hero backfill (4 articles) |
| `ddb9090` | fix: homepage reviews alias + deals dead prices table + integrity checks |
| `91c5db9` | chore: P2+P3 integrity checks — Checks 11–15, full site coverage |
| `f0a4206` | chore: P1 integrity gaps closed — 8g–8n, 9f–9h, 9 route additions (HEAD) |

---

## All Pipelines: Green

| Pipeline | Schedule | Status |
|----------|----------|--------|
| radar.yml (RADAR-01→03 + RADAR-08) | Daily 23:00 IST | ✅ |
| social-automation.yml | Daily 12:00 IST | ✅ (was down 2 days, fixed 21e0de2) |
| scrape-prices.yml | Every 6h | ✅ + zero-row Resend alert added |
| price-snapshot (LAB-03) | Daily 08:30 IST | ✅ |
| sync-catalogue.yml | Weekly Sunday 02:00 UTC | ✅ |
| catalogue-audit.yml | Weekly Monday 03:30 UTC | ✅ |
| health-check.yml | Daily 08:00 IST | ✅ |
| technical-hygiene.yml | Weekly Monday 04:00 UTC | ✅ — 15 check groups, 90+ assertions |
| code-audit.yml | Weekly Monday 05:00 UTC | ✅ NEW |
| brief.yml | Daily 01:30 UTC (07:00 IST) | ✅ |
| retiring-soon.yml | Weekly Sunday 02:00 UTC | ✅ |
| content-quality.yml | Daily 03:00 UTC | ✅ (BOM strip fixed) |
| generate-drafts.yml | On-demand dispatch | Manual only |
| publish-drafts.yml | On-demand dispatch | ✅ |

---

## What Shipped — Day 30 Full Session

### Morning
- Social automation back (apt-get update fix)
- Caption writer: piece count N/A, no monsoon, no asterisks
- llms.txt 24→60 lines, /community to sitemap, NewsArticle schema
- LAB-09 /lab/price-drops live (8 of 9 lab tools)
- publish-drafts.yml GHA workflow
- India Paragraph MANDATORY COMPARISON hardening
- 5 articles published (news: 47→52)
- NETLIFY-CREDITS carry-over closed (stale)

### Afternoon — Fixes
- **Gate 3 news exemption**: publish-drafts.mjs + actions.ts — news format skips verdict gate
- **BOM strip**: content-quality-report.mjs RESEND_API_KEY BOM fix — CQS daily email restored
- **TypeScript build**: price-drops Map/Set iteration → Array.from (3 fixes, 4 failed builds → green)
- **Related-set prices**: sets/[slug]/page.tsx `prices(*)` dead table → store_prices; anon → createServerClient()
- **SCRAPE-03**: scrape-now.mjs zero-row Resend alert + scrape-prices.yml env vars
- **code-audit.yml**: weekly Monday ESLint + tsc + npm audit; code-audit-notify.mjs

### Afternoon — Features
- **SETS-02/03/04**: /sets full rewrite with theme/sort/price-band/in-stock filters, searchParams pagination, price mode vs DB mode, /sets/page/[N] → redirect shim
- **CATALOG-05**: get_distinct_themes() Supabase RPC migration + /sets dropdown 25 hardcoded → 188 DB themes + fallback. Applied to Supabase.

### Evening — Integrity Layer
- **Check 7 DataIntegrity** (7a–7f): related prices join, store coverage, India content, lab ₹ data, sets filter routes, RPC themes. CONTRIBUTING rule added.
- **Check 8 P1 Technical** (8a–8n): store URLs, 25h freshness, stuck drafts, lab data, error boundaries, sets missing data, blog/guides content+hero nulls, pipeline freshness (price_snapshots, raw_signals), product_url validity, Rebrickable P1, Shopify P1.
- **Check 9 P1 Content** (9a–9h): markdown leak (news + blog), placeholder text (news + blog), meta descriptions (routes + blog seo_description).
- **Check 10 Homepage**: reviews `set:` alias regression guard, deals `prices(*)` regression guard.
- **Checks 11–15**: Page coverage (11 routes with content assertions), external deps (Rebrickable, Brickset, Shopify, CDNs, tokens), data pipeline health, content integrity (14 sub-checks), performance (9 sub-checks).
- **P1 gaps closed**: 4 missing routes added, 8g–8n + 9f–9h added.

### Evening — Bug Fixes
- **Homepage reviews alias**: `sets(name,...)` → `set:sets(name,...)` — ReviewCard reads `review.set` but homepage passed `review.sets` → placeholder SVG instead of Rebrickable images on all 3 review cards. Fixed in `page.tsx` line 36.
- **Homepage deals dead table**: `prices(*)` (legacy, not written to since Day 9) → explicit columns + separate `store_prices` query → `dealPriceMap`. Deal cards now show live prices.
- **YouTube hero backfill**: 10 articles total — 6 YouTube CDN thumbnails + 4 null hero_images replaced. Year-exclusion filter prevents years 1930–2030 appearing as set numbers. `SKIP_SLUGS` for edge cases.

---

## Integrity Layer — Complete Audit Status

### Coverage confirmed as of f0a4206:

**ROUTES**: 29 routes HTTP 200, 9 guide slugs, 11 additional routes with content assertions, 4 sets filter variants  
**DB TABLES**: sets, store_prices, price_history (proxy), price_snapshots, raw_signals, pending_drafts, reviews, blog_posts, news_articles, guides, community_spotlights, newsletter_subscribers, content_fix_log, content_image_registry  
**CONTENT**: news_articles (9 checks), blog_posts (5 checks), reviews (2 checks), guides (2 checks)  
**PIPELINES**: RADAR, price scraper, price snapshots, content quality, social automation, Gemini queue  
**EXTERNAL DEPS**: Rebrickable (P1 + P2), Brickset, 3 Shopify stores, D3/TopoJSON/India map CDNs, GH_DISPATCH_TOKEN, IG token expiry  
**PERFORMANCE**: Response times (3 pages), internal links (10 sampled), OG meta (3 pages), canonical (2 pages), scraper balance  
**VISUAL**: Playwright via content-quality.yml daily (14 checks × all articles × 2 viewports)  
**HOMEPAGE REGRESSIONS**: reviews join alias, deals price table reference

### Known remaining gaps (acceptable, documented):
- `/sets/[slug]` and `/reviews/[slug]` live render — would need one spot-check added to Check 11
- `/compare` actual search functionality — requires headless browser (visual-renderer domain)
- Supabase RLS audit (PROCESS-RLS-02) — security, not integrity
- Newsletter signup Server Action end-to-end test
- `/lab/which-set` quiz outcome correctness

---

## Session Start Protocol (Day 31)

1. `cat BOI_MASTER_TRACKER.md`
2. Read this file
3. Check BRIEF-01 email (07:00 IST) and CQS email (08:30 IST)
4. **Content pipeline**: ~352 approved drafts awaiting bodies. Run:
   ```
   node --env-file=.env.local scripts/generate-approved-drafts.js --limit 15
   node --env-file=.env.local scripts/publish-drafts.mjs --limit 15
   ```
5. **GSC setup** still pending — manual, 15 min, biggest single unblocking action left
6. **Visual renderer ISSUES** — 3 articles flagged (`lego-speed-champions`, `lego-titanic`, `star-wars-lego-will-bankrupt-you`). Check `content_quality_issues` in Supabase for Playwright failure details.
7. **CE-01 Builder Spotlights** — check Reddit/FB inbox for responses to outreach

---

## Open Items (Day 31)

### P1 — Hard Deadlines
| Item | Action | Due |
|------|--------|-----|
| IG System User Token | Re-exchange before token expires | **2026-07-16** |
| CE-01 Builder Spotlights | Interview → write → publish 2 spotlights | July 15 |

### P2 — This Week
| Item | Action |
|------|--------|
| GSC setup | DNS TXT → verify → submit sitemap → request indexing 10 pages (~15 min) |
| Visual renderer 3 ISSUES | Diagnose Playwright failure details in content_quality_issues |
| Content volume | /news at 52, target 75+ before Fan CoLab. Generate + publish daily. |
| /sets/[slug] spot-check | Add one known set (42172) to Check 11 to catch set page regressions |

### P3 — Queued
| Item | Notes |
|------|-------|
| LAB-10 Brick Portfolio | Needs user accounts |
| SETS-05/06 | aggregateRating schema, URL canonicalisation |
| DESIGN-CSS-03 | /admin/pending inline styles |
| Video (Phase 4) | 22 tasks, all blocked on EL-05 voice clone decision |

---

## Database State (2026-05-30 final)

| Table | Count | Notes |
|-------|-------|-------|
| sets | 24,559 | distinct themes: 188 (get_distinct_themes RPC live) |
| store_prices | ~2,597 | 3 stores, 0-row alert active |
| price_history | ~23,000+ | 30+ days — LAB-09 eligible |
| news_articles | 52 | 5 published today |
| reviews | 3 | all hero_images: Brickset CDN URLs, verified 200 |
| blog_posts | 22 | 3 opinion + 19 legacy |
| guides | 9 | all with non-null content |
| pending_drafts (approved) | ~352 | awaiting body generation |
| pending_drafts (draft) | 58 | RADAR-classified, awaiting operator approval |
| community_spotlights | 0 | CE-01 outreach sent, awaiting respondents |
| content_quality_issues | 133+ | 3 visual renderer issues added |

## Fan CoLab (August 1 deadline — 63 days)

| Item | Status |
|------|--------|
| /guides (WEB-05) | ✅ DONE |
| 9 guides (CE-02 + CE-05) | ✅ DONE |
| /community (WEB-06) | ✅ DONE |
| 2 Builder Spotlights (CE-01) | 🟡 Outreach done 2026-05-29. Awaiting respondents. |
| Daily social automation | ✅ DONE — fixed today |
| 3+ Codex reviews | ✅ DONE |
| Brickset listing | ✅ DONE |

## Lab Tools (8 of 9 live)

| Route | Status |
|-------|--------|
| /lab/biryani-index | ✅ |
| /lab/which-set | ✅ |
| /lab/cmf-tracker | ✅ |
| /lab/deals | ✅ |
| /lab/budget-calculator | ✅ |
| /lab/retiring-soon | ✅ |
| /lab/heat-map | ✅ |
| /lab/price-drops | ✅ (shipped today) |
| /lab/portfolio | 🔴 needs user accounts |

## Integrity Layer (technical-hygiene.mjs)

| Check Group | Sub-checks | What it covers |
|-------------|-----------|----------------|
| 1. RouteHealth | 29 routes | HTTP 200 for all live routes |
| 1b. GuideRoutes | 9 slugs | All guide pages live |
| 2. HeroImages | All news | hero_image URLs return 200 |
| 3. Sitemap | ≥1000 URLs | Sitemap generation health |
| 4. Lighthouse | 2 pages | perf ≥50, a11y ≥70, SEO ≥80 |
| 5. Staleness | 3 stores | store_prices scraped ≤8h |
| 6. RowCounts | 12 tables | Trend tracking (logged) |
| 7. DataIntegrity | 7a–7f | Join health, store coverage, content proxies |
| 8. P1 Technical | 8a–8n | URLs, freshness, stuck drafts, lab data, error boundaries, catalogue, blog/guides nulls, pipeline, Rebrickable, Shopify |
| 9. P1 Content | 9a–9h | Markdown, placeholders, meta — news + blog |
| 10. Homepage | 10a–10b | Alias regression, dead table regression |
| 11. PageCoverage | 11 routes | Content assertions (₹, quiz form, theme count) |
| 12. ExtDependencies | 8 checks | Rebrickable, Brickset, Shopify, CDNs, tokens |
| 13. DataPipeline | 7 checks | RADAR, snapshots, fix log, tables |
| 14. ContentIntegrity | 14 checks | Word count, HTML, ABHINAV12, store names, sign-offs, verdicts, slugs, dates, CAPS, India Paragraph, hero null rate |
| 15. Performance | 9 checks | Response times, links, OG, canonical, balance, Gemini, social |

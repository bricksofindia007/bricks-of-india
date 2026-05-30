# Day 30 Ground Truth — 2026-05-30 (CLOSE)

## Health Score: 95
GEO score < 50 is the sole drag (-5). 52 news articles live. 8 of 9 Lab tools live.
/sets has full filter+sort+pagination. CATALOG-05 done (188 DB themes via RPC).
Visual renderer first live run done: 57/60 OK, 3 ISSUES logged.
Social automation back online after 2-day outage.

## HEAD Commit: f016b7c
feat: CATALOG-05 dynamic theme list via Supabase RPC, replaces hardcoded 25
Branch: main. In sync with origin.

## Full Commit Log — Day 30

| Commit | What |
|--------|------|
| `21e0de2` | fix: apt-get update — social automation libcaca0 mirror 404 |
| `b2c5cf5` | fix: caption writer (piece count N/A, monsoon guardrail, asterisk strip) |
| `4a41d99` | geo: llms.txt expanded, /community sitemap, NewsArticle schema |
| `59d28eb` | chore: reset-failing-drafts.mjs |
| `1159c53` | feat: PublishAll → GHA link; publishOneDraft() helper |
| `8e7eb1f` | feat: LAB-09 price-drops + publish-drafts.yml |
| `9744990` | fix: India Paragraph MANDATORY COMPARISON hardening |
| `d9676e1` | chore: close stale NETLIFY-CREDITS tracker item |
| `6a1d639` | chore: Day 30 AM tracker + handover + Fan CoLab timeline |
| `fa55271` | fix: Gate 3 news exemption + BOM strip (content-quality-report) |
| `44070c0` | fix: Map iteration downlevelIteration (price-drops build) |
| `684b28a` | fix: Set/Map spread → Array.from (price-drops build, final fix) |
| `910346a` | fix: related-set prices dead table → store_prices; anon → service role |
| `789cf6c` | feat: SCRAPE-03 per-store zero-row alert via Resend |
| `3229ceb` | chore: code-audit.yml weekly workflow |
| `61486d3` | chore: /lab/price-drops to technical-hygiene routes |
| `6d1792c` | feat: SETS-02/03/04 filters + sort + searchParams pagination |
| `87a72ca` | chore: data integrity Check 7 (7a–7f) + CONTRIBUTING rule |
| `f016b7c` | feat: CATALOG-05 get_distinct_themes RPC (HEAD) |

## All Pipelines: Green

| Pipeline | Schedule | Status |
|----------|----------|--------|
| radar.yml (RADAR-01→03 + RADAR-08) | Daily 23:00 IST | ✅ Green |
| social-automation | Daily 12:00 IST | ✅ Green — was down May 29–30, fixed 21e0de2 |
| scrape-prices.yml | Every 6h | ✅ Green — now alerts on 0-row store |
| price-snapshot (LAB-03) | Daily 08:30 IST | ✅ Green |
| sync-catalogue.yml | Weekly Sunday 02:00 UTC | ✅ Green |
| catalogue-audit.yml | Weekly Monday 03:30 UTC | ✅ Green |
| health-check.yml | Daily 08:00 IST | ✅ Green |
| technical-hygiene.yml | Weekly Monday 04:00 UTC | ✅ Green — Check 7 DataIntegrity added |
| code-audit.yml | Weekly Monday 05:00 UTC | ✅ NEW — live as of today |
| brief.yml | Daily 01:30 UTC (07:00 IST) | ✅ Green |
| retiring-soon.yml | Weekly Sunday 02:00 UTC | ✅ Green |
| content-quality.yml | Daily 03:00 UTC | ✅ Green — BOM strip fixed |
| generate-drafts.yml | On-demand dispatch | Manual only |
| publish-drafts.yml | On-demand dispatch | ✅ Live |

---

## What Shipped — Full Day 30

### AM Session
- Social automation back (apt-get update fix)
- Caption writer: piece count N/A, no monsoon, no asterisks
- llms.txt 24→60 lines, /community to sitemap, NewsArticle schema
- LAB-09 /lab/price-drops live (8 of 9 lab tools)
- publish-drafts.yml GHA workflow
- India Paragraph MANDATORY COMPARISON hardening
- 5 articles published (news: 47→52), 44 stale bodies cleared, 9 reset

### PM Session
- **Gate 3 news exemption** — publish-drafts.mjs + actions.ts: verdict not required for news format
- **BOM strip** — content-quality-report.mjs: RESEND_API_KEY BOM stripped before Resend init; fixes daily CQS email
- **TypeScript build fixed** — price-drops page: Map/Set iteration → Array.from (3 fixes, 4 failed builds → green)
- **Related-set prices** — sets/[slug]/page.tsx: `prices(*)` dead table → store_prices; anon → createServerClient()
- **SCRAPE-03** — scrape-now.mjs: zero-row alert email per store; scrape-prices.yml gets RESEND env vars
- **code-audit.yml** — weekly Monday ESLint + tsc + npm audit; scripts/code-audit-notify.mjs
- **SETS-02/03/04** — /sets full rewrite: theme/sort/price-band/in-stock filters; searchParams pagination; /sets/page/[N] → redirect; price mode vs DB mode architecture
- **Check 7 DataIntegrity** — technical-hygiene.mjs: 6 sub-checks (7a–7f) covering related prices, store coverage, India content, lab pages, sets filters, RPC; CONTRIBUTING rule; sitemap threshold 30→1000
- **CATALOG-05** — get_distinct_themes() Supabase RPC; migration 20260530000000; /sets dropdown: 25 hardcoded → 188 DB themes. RPC applied to Supabase.
- **Visual renderer first live run** — 57/60 OK, 3 ISSUES: lego-speed-champions-2026-india, lego-titanic, star-wars-lego-will-bankrupt-you. Written to content_quality_issues.

---

## Session Start Protocol (Day 31)

1. `cat BOI_MASTER_TRACKER.md`
2. Read this file
3. Check BRIEF-01 email (07:00 IST) and CQS email (08:30 IST)
4. **Content pipeline**: Gemini quota resets ~12:30 IST. Run:
   ```
   node --env-file=.env.local scripts/generate-approved-drafts.js --limit 15
   node --env-file=.env.local scripts/publish-drafts.mjs --limit 15
   ```
   ~352 approved drafts awaiting bodies. Target: /news to 60+.
5. **GSC setup** still pending — manual, 15 min, unblocks GEO score improvement
6. **3 visual renderer ISSUES** — check content_quality_issues in Supabase for details. May need manual content fixes.
7. **CE-01 Builder Spotlights** — check inbox/Reddit DMs for responses to outreach

---

## Open Items (carry into Day 31)

### P1 — Hard Deadlines
| Item | Action | Due |
|------|--------|-----|
| IG System User Token | Re-exchange by July 16 | **2026-07-16** |
| CE-01 Builder Spotlights | Respond to outreach, interview, write | July 15 |

### P2 — This Week
| Item | Action |
|------|--------|
| GSC setup | Cloudflare DNS TXT → verify → submit sitemap → request indexing 10 pages |
| Visual renderer ISSUES | Check 3 flagged articles in Supabase, diagnose Playwright check failures |
| Content freshness | /news at 52, target 60+ — run generate + publish daily |

### P3 — Queued
| Item | Notes |
|------|-------|
| SETS-05/06 | aggregateRating schema, URL canonicalisation |
| LAB-09 price-drops data | Review comparison logic after 60 days of price_history |
| DESIGN-CSS-03 | /admin/pending inline styles |
| LAB-10 Brick Portfolio | Needs user accounts |

---

## Database State (2026-05-30 close)

| Table | Count | Notes |
|-------|-------|-------|
| sets | 24,559 | distinct themes: 188 (get_distinct_themes RPC live) |
| store_prices | ~2,597 | 3 stores: toycra, mybrickhouse, jaiman |
| price_history | ~23,000+ | 30+ days — LAB-09 eligible |
| news_articles | 52 | +5 published today |
| reviews | 3 | |
| blog_posts | 22 | |
| guides | 9 | |
| pending_drafts (approved) | ~352 | awaiting body generation |
| pending_drafts (draft) | 58 | raw RADAR signals, need operator approval |
| content_quality_issues | 133+ open | 3 new visual renderer issues added |

## Fan CoLab Status (August 1 deadline — 63 days)

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

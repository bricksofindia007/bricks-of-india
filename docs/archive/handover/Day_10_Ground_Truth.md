# Day 10 Ground Truth — Bricks of India

**Date written:** 2026-05-10, end of Day 10
**Branch:** main
**Last commit:** d5d1641
**Remote:** origin/main in sync

---

## A. Repo state

**Full Day 10 commit trail (chronological):**
```
c42a7be fix(blog): render markdown content with ReactMarkdown (CONTENT-RENDER-02)
b415cab fix(articles): strip markdown literals from ArticleCard excerpt (CONTENT-RENDER-03)
c67f546 fix(audit): scope lego_mrp_inr gate to year>=2020 sets only
d57348e feat(catalogue): populate lego_mrp_inr via Brickset API, audit gate 45% of 2020+ sets
e95afa0 fix(populate-mrp): correct audit gate threshold in final report (45% not 50%)
7a44d20 feat(reviews): seed first 3 reviews (42161, 31120, 10317), ReactMarkdown on review page (REVIEWS-FIRST-3)
b66cbc0 fix(populate-mrp): live USD/INR rate from open.er-api.com, fallback 90
b26abf0 design(global): align color system to BOI brand — white bg, saffron primary, LEGO red accent
d5d1641 feat(lab): LAB-02 Which Set Are You + LAB-07 Search Pulse live, global color system aligned to BOI brand
```

---

## B. What shipped today

| Ticket | Description | Commit |
|---|---|---|
| CONTENT-RENDER-02 | ReactMarkdown wrapping on /blog/[slug] | c42a7be |
| CONTENT-RENDER-03 | ArticleCard excerpt markdown stripped | b415cab |
| PRICE-PIPELINE-01 | lego_mrp_inr populated — 3,370 sets via Brickset API, live USD/INR rate from open.er-api.com, fallback 90 | e95afa0 + b66cbc0 |
| REVIEWS-FIRST-3 | 3 reviews written to DB, GEO-01-FU1 verified in production HTML | 7a44d20 |
| GEO-01-FU1 | /reviews/[slug] JSON-LD confirmed — Organization, BreadcrumbList, Review schema all server-rendered | no code change |
| LAB-02 | Which Set Are You quiz live at /lab/which-set | d5d1641 |
| LAB-07 | LEGO Search Pulse live at /lab/heat-map | d5d1641 |
| DESIGN-01 | Brand CSS variables added to globals.css — 9 variables covering full BOI color system | d5d1641 |

---

## C. Infrastructure — unchanged from Day 9

All 6 GitHub Actions workflows running. Supabase healthy. Netlify auto-deploy on push. Cloudflare stable. Node.js 24 migration complete.

---

## D. Lab status

| ID | Tool | Status | URL |
|---|---|---|---|
| LAB-01 | Biryani Index | ✅ Live | /lab/biryani-index |
| LAB-02 | Which Set Are You | ✅ Live | /lab/which-set |
| LAB-03 | Daily price snapshot cron | ✅ Running | — |
| LAB-04 | Lab homepage strip | ✅ Live | /lab |
| LAB-05 | Price Drop Board | 🔴 Deferred | needs 30d snapshot data |
| LAB-06 | Retirement Radar | 🔴 Deferred | needs CATALOG-04 v2 |
| LAB-07 | LEGO Search Pulse | ✅ Live | /lab/heat-map |
| LAB-08 | Brick Portfolio | 🔴 Deferred indefinitely | auth strategy decision |

---

## E. Design system

Brand CSS variables confirmed live in src/app/globals.css lines 23–35:
- --boi-saffron: #F7A800
- --boi-red: #E3000B
- --boi-green: #138808
- --boi-blue: #006CB7
- --boi-sky: #7EC4E8
- --boi-sky-light: #A8D8ED
- --boi-text: #1A1A1A
- --boi-text-secondary: #4A5568
- --boi-border: rgba(0,0,0,0.08)
- --boi-bg: #FFFFFF

Variables exist but components still use hardcoded hex values. Day 11 carry-over: systematic refactor to replace hardcoded colors with CSS variables across all components.

Footer background: var(--boi-navy) #1a2332 — intentional dark footer, decision pending on whether to lighten.

---

## F. Database state

| Table | Rows | Notes |
|---|---|---|
| sets | 24,190 | lego_mrp_inr populated for 3,370 (2020+ sets, 46% of scoped rows — passes 45% audit gate) |
| store_prices | ~243 sets | Live scraper data |
| raw_signals | 15 sources | 349+ pending_drafts |
| pending_drafts | 349+ | RADAR-04 on-demand only |
| reviews | 3 | GEO-01-FU1 verified |
| newsletter_subscribers | 2 | active |

---

## G. Open carry-overs entering Day 11

| Priority | ID | Item |
|---|---|---|
| P1 | DESIGN-CSS-01 | Refactor all components to use CSS variables instead of hardcoded hex values |
| P2 | PARSER-01 | New Elementary feed — needs @extractus/feed-extractor swap |
| P2 | RADAR-03-TUNE | Rebrickable over-classified as NEWS — polluting draft queue |
| P2 | WEB-01 | 4-gate article lint pipeline |
| P2 | DEFECT-005 | RADAR-04 voice/format ceiling — prompt engineering |
| P2 | FOOTER-01 | Decision pending: keep dark footer or align to white/light brand direction |
| P3 | CONTENT-RENDER-03 | ArticleCard excerpt — verify fix in production |
| P3 | LAB-05 | Price Drop Board — needs 30 days snapshot data (running since May 2, ~8 days in) |
| P3 | LAB-06 | Retirement Radar — needs CATALOG-04 v2 |
| P3 | LAB-02-UX | Which Set Are You — review color palette in production, may need light theme pass |
| P3 | LAB-07-UX | Search Pulse — review map rendering in production, GeoJSON load verified |

---

## H. Day 11 recommended entry point

1. DESIGN-CSS-01 — systematic CSS variable refactor. Start with Footer and Navbar, then page layouts, then components. One component at a time, verify in browser after each.
2. PARSER-01 — New Elementary back as Tier 1 source, 30 min job.
3. RADAR-03-TUNE — clean up the 349 draft queue classification.

---

## I. Known risks

- LAB-07 GeoJSON loads from raw.githubusercontent.com at runtime — if GitHub is slow, map shows loading spinner. Acceptable for Lab tool.
- populate-mrp.js is idempotent — safe to re-run after catalogue syncs, will pick up new NULL rows at live USD/INR rate.
- 349 pending drafts include Rebrickable noise — RADAR-03-TUNE needed before queue is trustworthy.

---

*Supersedes all previous session docs. Next session start: cat this file + cat BOI_MASTER_TRACKER.md*

# Day 11 Ground Truth — Bricks of India

**Date written:** 2026-05-12 (reconstructed at Day 12 open — doc was not committed at Day 11 close)
**Day 11 date:** 2026-05-11
**Branch:** main
**Last commit Day 11:** 987b07a (chore(tracker): Day 11 update — design sprint, phase/blocker/carry-over corrections)
**Remote:** origin/main in sync as of 2026-05-12 pull

---

## A. Repo state

**Day 11 commit trail (chronological):**
```
8392b42 fix(day11): heat-map SVG height + cancellation + auto-drill, stale dates, spacing consistency
7bd7862 feat(about): add LEGO origin story section with photo, fix credentials year to 2025
29d0104 feat(about): add lego-car-build.jpg for origin story section
10ce445 design: sky blue hero banners sitewide, green section badge on lab, fix news excerpt italic, unify about page text colours
ac81aa8 design(heroes): align blog + lab hero banners to bg-dark system (news/reviews parity)
01238e4 Revert "design(heroes): align blog + lab hero banners to bg-dark system (news/reviews parity)"
145a9b6 design: white navbar, saffron footer (navy text), about photo float-right magazine layout
2c34f75 fix: tricolour stripe saffron/white/green, footer blue+saffron, review card images, remove duplicate excerpt
987b07a chore(tracker): Day 11 update — design sprint, phase/blocker/carry-over corrections
```

---

## B. What shipped Day 11

| Ticket | Description | Commit |
|---|---|---|
| DESIGN-HERO-01 | Sky blue (`var(--boi-sky)`) hero banners — news, blog, reviews, lab. Navy h1 + p at 75% opacity. Lab gets green "THE LAB" pill badge. | 10ce445 |
| DESIGN-NAV-01 | White navbar — removed sky-to-sky-light gradient, `#fff` + `shadow-sm`. Clean separation from hero. | 145a9b6 |
| DESIGN-FOOTER-01 | BOI-blue footer — `#006CB7` bg, saffron `#F7A800` text/headers/wordmark, warm cream links `rgba(255,247,220,0.85)`. Closes FOOTER-01. | 145a9b6 + 2c34f75 |
| DESIGN-STRIPE-01 | Tricolour stripe → saffron `#F7A800` / white / green `#138808` — Indian flag tricolour corrected. | 2c34f75 |
| LAB-07-UX | Heat-map: SVG `height: 100%` collapse fixed (`minHeight` container), async cancellation flag, auto-drill removed (button-only), "Q1 2025" → "Q1 2026". Closes LAB-07-UX. | 8392b42 |
| CONTENT-FIX-01 | Review card images: Supabase join alias fixed `sets(...)` → `set:sets(...)` — Rebrickable CDN images now load on reviews listing. | 2c34f75 |
| CONTENT-FIX-02 | Duplicate excerpt `<p>` removed from `news/[slug]` and `blog/[slug]` — excerpt remains in `<head>` metadata only. | 8392b42 + 2c34f75 |
| ABOUT-01 | About page origin story — 8-paragraph origin, LEGO car float-right photo (280px), credential year corrected to 2025, hardcoded hex replaced with CSS variables. `public/images/lego-car-build.jpg` committed. | 7bd7862 + 29d0104 + 145a9b6 |
| SPACING-01 | news/blog content areas `py-8` → `py-10` (matches reviews). News article excerpt `italic` added. | 10ce445 |

---

## C. Infrastructure — unchanged from Day 10

All 6 GitHub Actions workflows running. Supabase healthy. Netlify auto-deploy on push to main. Cloudflare stable. Node.js 24 migration complete (DEFECT-010).

**NETLIFY-CREDITS note (from tracker carry-overs):** An earlier entry flagged Netlify build minutes exhausted mid-sprint (affecting /admin/pending, RADAR-03, DATA-01 deploys). Status unclear as of Day 12 — the Day 11 design sprint commits show in Recent Deploys, suggesting credits may have reset or the issue resolved. Verify Netlify dashboard before relying on this carry-over as current.

---

## D. Lab status

| ID | Tool | Status | URL |
|---|---|---|---|
| LAB-01 | Biryani Index | ✅ Live | /lab/biryani-index |
| LAB-02 | Which Set Are You | ✅ Live | /lab/which-set |
| LAB-03 | Daily price snapshot cron | ✅ Running | — |
| LAB-04 | Lab homepage strip | ✅ Live | /lab |
| LAB-05 | Price Drop Board | 🔴 Deferred | needs 30d snapshot data (~2026-06-01) |
| LAB-06 | Retirement Radar | 🔴 Deferred | needs CATALOG-04 v2 |
| LAB-07 | LEGO Search Pulse | ✅ Live | /lab/heat-map |
| LAB-08 | Brick Portfolio | 🔴 Deferred indefinitely | auth strategy decision |

---

## E. Design system

Brand CSS variables live in `src/app/globals.css`:
- `--boi-saffron`: #F7A800
- `--boi-red`: #E3000B
- `--boi-green`: #138808
- `--boi-blue`: #006CB7
- `--boi-sky`: #7EC4E8
- `--boi-sky-light`: #A8D8ED
- `--boi-navy`: #1a2332
- `--boi-text`: #1A1A1A
- `--boi-text-secondary`: #4A5568
- `--boi-border`: rgba(0,0,0,0.08)
- `--boi-bg`: #FFFFFF

**DESIGN-CSS-01 status:** Variables exist but many components still use hardcoded hex values. About page CSS variables applied (Day 11). Systematic refactor of remaining components is the outstanding P1 carry-over.

---

## F. Database state

| Table | Rows | Notes |
|---|---|---|
| sets | 24,190 | lego_mrp_inr: 3,370 populated (2020+ via Brickset API, 46% — passes 45% gate) |
| store_prices | ~243 sets | Live scraper data (6h cadence) |
| price_snapshots | 10d+ data | LAB-03 cron running since 2026-05-02; eligible for LAB-05 ~2026-06-01 |
| raw_signals | 15 sources | 349+ pending_drafts |
| pending_drafts | 349+ | RADAR-04 on-demand only via /admin/pending |
| reviews | 3 | 42161, 31120, 10317 — GEO-01-FU1 verified |
| newsletter_subscribers | 2 | active |

---

## G. RADAR pipeline state

| Step | Status |
|---|---|
| RADAR-01 (fetch-rss.js) | ✅ Nightly cron 17:30 UTC |
| RADAR-02 (dedupe-signals.js) | ✅ Nightly cron |
| RADAR-03 (classify-signals.js) | ✅ Nightly cron — 349 pending_drafts |
| RADAR-04 (generate-drafts.js) | ✅ On-demand only — /admin/pending "Generate Article" button |
| RADAR-05 (publish-drafts.js) | ✅ On-demand only — /admin/pending "Publish" button |
| /admin/pending | ✅ Live in production |

Active sources: 14 (Brothers Brick, Jay's Brick Blog, BrickNerd, Brickset, Brick Fanatics + Tier 3–5). New Elementary: disabled (PARSER-01 open).

---

## H. Open carry-overs entering Day 12

| Priority | ID | Item |
|---|---|---|
| P1 | DESIGN-CSS-01 | Refactor all components to use CSS variables — hardcoded hex still in most components |
| P2 | PARSER-01 | New Elementary — swap rss-parser for @extractus/feed-extractor (~30 min) |
| P2 | RADAR-03-TUNE | Rebrickable over-classified as NEWS; BrickNerd digest/contest round-ups missed |
| P2 | WEB-01 | 4-gate article lint pipeline (Codex Page 20) |
| P2 | DEFECT-005 | RADAR-04 voice/format ceiling — prompt engineering for BOI voice compliance |
| P3 | LAB-05 | Price Drop Board — needs 30 days snapshot data (~2026-06-01) |
| P3 | LAB-06 | Retirement Radar — needs CATALOG-04 v2 |
| P3 | CONTENT-RENDER-03 | ArticleCard excerpt strip — verify in production |
| P3 | ADMIN-CLEANUP-01 | Remove legacy Netlify secrets from GitHub Secrets |

---

## I. Day 12 recommended entry point

1. **DESIGN-CSS-01** — systematic CSS variable refactor. Start with Navbar and SetCard (high-visibility), then page layouts. One component per commit, verify in browser.
2. **PARSER-01** — New Elementary back as Tier 1 source. 30 min job (`@extractus/feed-extractor` swap in `fetch-rss.js`).
3. **RADAR-03-TUNE** — classifier fix for Rebrickable over-indexing. Clears noise from 349-draft queue before any publish decisions.

---

## J. Known risks

- 349 pending_drafts include Rebrickable noise — queue is untrustworthy until RADAR-03-TUNE ships.
- NETLIFY-CREDITS status unclear — verify Netlify dashboard if deploys seem stalled.
- DEFECT-GEO-01-FU2 still deferred: BreadcrumbSchema on routes deeper than 2 levels unverified.
- populate-mrp.js safe to re-run after catalogue syncs (idempotent, picks up NULL rows at live USD/INR).

---

*Supersedes Day 10 Ground Truth for session context. Next session start: cat this file + cat BOI_MASTER_TRACKER.md*

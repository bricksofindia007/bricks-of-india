# Day 9 Ground Truth FINAL v2 — Bricks of India

**Date written:** 2026-05-09, end of full session
**Supersedes:** Day_9_Ground_Truth.md, Day_9_Ground_Truth_FINAL.md, all prior Day 9 files
**Last commit:** 57cd130

This document is the single authoritative state of the project as of end of Day 9. Every claim is anchored in a verified terminal command, DB query, or GitHub Actions log from today's session.

---

## A. Repo state

**Branch:** `main` at `57cd130`
**Remote:** `origin/main` in sync

**Verification block:**
```bash
cd "C:\Users\bharg\Documents\BricksofIndia\website"
git log --oneline -5
git status
git branch --show-current
gh run list --repo bricksofindia007/bricks-of-india --limit 3
```
Expected: main, clean, last commit 57cd130, latest Netlify deploy green.

**Day 9 commit trail (full, chronological):**
```
84c73e3  docs(handover): Day 9 Ground Truth session 1 (deprecated)
7bc74c9  chore(trackers): Day 9 close-out session 1
7fb5b6d  chore: package-lock.json for @netlify/plugin-nextjs@^5.0.0
8d178c6  fix(supabase): guard createClient against empty URL
772624d  fix(admin): Server Actions + filters + bulk approve + Netlify plugin v5
60fca80  fix(admin): filter chip labels wrap correctly
784adb6  fix(radar): PARSER-01/SCRAPE-01 source fixes + Jay's Brick Blog
1f82da0  fix(nav+sitemap+sources): Blog in nav, sitemap fixes
cbb4ac9  fix(nav+sitemap+sources): PARSER-01 findings documented
8d77720  chore(docs): Day 9 documentation close-out v1
9baf37d  feat(radar): RADAR-05 Publish button + publish-drafts.js
0fad972  feat(radar): RADAR-04-FULLTEXT — fetch full article body before Gemini
6d8d0f4  fix(admin): Awaiting Generation badge + message
68aa474  fix(radar): fetchFullBody CSS selector fix — JBB 1607 chars
57cd130  feat(admin): on-demand generation — Generate Article button
```

---

## B. Database state

| Table | Count | Notes |
|---|---|---|
| sets | 24,190 | Weekly Rebrickable sync |
| store_prices | ~1,900+ | 3 stores, 6h scraper |
| raw_signals | ~1,500+ | Accumulated |
| pending_drafts | **349+** | All status='draft' after RADAR-04 runs. 3 Brickset articles had bodies generated today. |
| news_articles | 20 | Frozen |
| blog_posts | 19 | Frozen |
| reviews | 0 | Empty — blocks GEO-01-FU1, RLFM |
| price_snapshots | active | RLS enabled (DEFECT-007) |

**pending_drafts status distribution (post session):**
- Most rows: `status='draft'` — unreviewed signals OR signals with generated bodies awaiting second approval
- A few rows: `status='approved'` — signals approved by operator, no body yet → "Awaiting Generation"
- RLS: enabled on all 11 public tables

---

## C. RADAR pipeline state

**Nightly cron (radar.yml, 17:30 UTC / 23:00 IST): RADAR-01 → RADAR-02 → RADAR-03 only.**
RADAR-04 is NOT in the cron. Generation is on-demand per draft via /admin/pending.

| Stage | Script | Mode | Last run result |
|---|---|---|---|
| RADAR-01 | `fetch-rss.js` | Nightly auto | 322 signals, 14 sources, 0 errors |
| RADAR-02 | `dedupe-signals.js` | Nightly auto | 280 unique |
| RADAR-03 | `classify-signals.js` | Nightly auto | 50 new pending_drafts |
| RADAR-04 | `generate-drafts.js` | **On-demand only** | Single draft per operator click |
| RADAR-05 | `/admin/pending` publish | **On-demand only** | Inserts to news_articles/blog_posts |

**Active sources (14):**

| Tier | Source | Status |
|---|---|---|
| 1 | The Brothers Brick | ✅ active |
| 1 | Jay's Brick Blog | ✅ active — added Day 9 |
| 1 | BrickNerd | ✅ active |
| 1 | New Elementary | 🔴 disabled — PARSER-01 (cascading XML violations) |
| 2 | Brickset | ✅ active — URL fixed to `/feed` (Day 9) |
| 2 | Rebrickable Recent Sets | ✅ active |
| 2 | LEGO New Sets | 🔴 disabled — SPA (Playwright required) |
| 3 | r/lego | ✅ active (≥500 upvotes) |
| 4 | BrickClicker, JANGBRiCKS, Brick Vault, Tiago Catarino, Brick Finds & Flips, JB Spielwaren | ✅ 6 YouTube channels |
| 5 | Blocks Magazine | ✅ active — URL fixed (Day 9) |
| 5 | Brick Fanatics | ✅ active |
| 5 | LEGO Ideas Blog, Eurobricks News | 🔴 disabled — SCRAPE-01 |

---

## D. Full editorial flow (5 steps)

```
1. Nightly cron writes signals to pending_drafts (status='draft', no body)

2. Operator goes to /admin/pending → DRAFT tab
   → Reviews title + source excerpt
   → Clicks "✓ Approve signal" on ones worth turning into articles
   → Row becomes status='approved', "Awaiting Generation" badge appears

3. Operator switches to APPROVED tab
   → Sees amber "✦ Generate Article" button on rows with no body
   → Clicks it — Gemini generates BOI-voice article from full fetched body (or excerpt fallback)
   → Row resets to status='draft', body is now populated

4. Operator back on DRAFT tab
   → Sees "Generated body" preview (labeled, blue left border)
   → Reviews generated article
   → Clicks "✓ Approve article" — row becomes status='approved' again

5. Operator on APPROVED tab
   → Sees blue "↑ Publish" button (only on approved rows with draft_body)
   → Clicks it — article inserted into news_articles or blog_posts
   → Row becomes status='published', published_url set
   → Article appears live on /news or /blog
```

**Target table routing:**
- `draft_format='news'` → `news_articles`, category='News'
- `draft_format='review'` → `news_articles`, category='Review' (reviews table needs set_id+rating — not available from RADAR-04)
- `draft_format='opinion'` → `blog_posts`, category='Opinion'

---

## E. Bugs fixed today (Day 9 full session)

| Bug | Fix | Commit |
|---|---|---|
| Nav "Sets" linked to /compare | Fixed to /sets | 4651696 |
| Hero CTAs linked to /compare | Fixed to /sets | 4651696 |
| Stats block linked to /compare | Fixed to /sets | 4651696 |
| Server Actions doing nothing on production | redirect() not revalidatePath() + Netlify plugin v5 | 772624d |
| Supabase opaque Digest crash if NEXT_PUBLIC_SUPABASE_URL unset | createClient guard | 8d178c6 |
| Brickset source URL wrong (returned HTML) | Fixed to /feed | 784adb6 |
| Blocks Magazine hostname mismatch after redirect | Fixed URL to blocksmag.com/news/ | 784adb6 |
| Blog missing from navbar | Added after News | 1f82da0 |
| /compare in sitemap, /calendar in sitemap | Fixed to /sets, removed /calendar | 1f82da0 |
| DEFECT-011: fetchFullBody `[class*="sidebar"]` removing JBB content | Targeted selectors | 68aa474 |
| DEFECT-012: RADAR-04 auto-generating on all approved drafts | Removed from cron, on-demand only | 57cd130 |

---

## F. Open items

| ID | Description | Priority |
|---|---|---|
| PARSER-01 | New Elementary — 3 cascading XML violations, needs @extractus/feed-extractor swap | P2 |
| DEFECT-010 | actions/checkout + setup-node Node.js 20 deprecated, deadline 2026-06-02 | Medium |
| PRICE-PIPELINE-01 | lego_mrp_inr 0% populated — catalogue-audit failing, price filter thin | P1 |
| REVIEWS-FIRST-3 | 0 reviews in DB — blocks GEO-01-FU1, RLFM | P1 |
| RADAR-03-TUNE | Classifier: Rebrickable always 'news'; BrickNerd digests not caught as community | P2 |
| CONTENT-RENDER-02/03 | Markdown on /blog; excerpt leakage in ArticleCard | P2 |
| BUG-04 | DK books / non-LEGO ISBNs appearing in /compare | Low |
| WEB-01 | 4-gate article lint pipeline | P1 |

---

## G. Functional audit (Day 9)

**Verified working:** Homepage (hero, CTAs→/sets, stats block→/sets), Nav (/sets, /themes, /deals, /reviews, /news, /blog, About, Search), /compare (filters, affiliate banner), /sets (24,190 sets, store_prices), /sets/[slug] (price table, WhatsApp share), /news, /blog, /deals, /reviews (empty state), /themes, /lab (Biryani Index), /about, /legal pages, footer.

**Confirmed live:** /admin/pending with 4-state card UI, Generate Article button (Gemini on-demand), Publish button (inserts to news/blog), status/format/domain filters, bulk approve.

**Known non-bugs:** /search → /compare redirect (intentional), lazy-loading images (timing).

---

## H. Next session priorities (in order)

1. **Use /admin/pending** — go to APPROVED tab, click "Generate Article" on 3 Brickset drafts (Road Bike, NYC Architecture, Imperial Shuttle), review generated bodies, approve, publish. This will put first RADAR-04-generated articles live on /news.
2. **Write first 3 set reviews** manually using Voice Codex → publish to `reviews` table. Unblocks GEO-01-FU1 and RLFM application.
3. **PARSER-01** — swap rss-parser for @extractus/feed-extractor, re-enable New Elementary.
4. **PRICE-PIPELINE-01** — Brickset MSRP ingestion (unblocks catalogue-audit ≥50% gate).
5. **DEFECT-010** — bump actions/checkout and setup-node before 2026-06-02 deadline.

---

## I. Quick reference

- GitHub: `bricksofindia007/bricks-of-india`
- Supabase: `hqpaiarhmiocmjrzjhtw`
- Local repo: `C:\Users\bharg\Documents\BricksofIndia\website`
- Last commit: `57cd130`
- radar.yml cron: daily 17:30 UTC — RADAR-01/02/03 only
- scrape-prices.yml: every 6h (toycra, lego.mybrickhouse.com, jaiman)
- lab-03 price snapshot: daily 08:30 IST
- catalogue-audit: weekly Monday 03:30 UTC
- /admin/pending: bricksofindia.com/admin/pending
- pending_drafts: 349+ rows, status='draft'
- Editorial flow: Approve signal → Generate Article → Approve article → Publish

---

**End of Day 9 Ground Truth FINAL v2.**
Next session: /admin/pending → generate+publish the 3 Brickset articles → first live RADAR-04 content.

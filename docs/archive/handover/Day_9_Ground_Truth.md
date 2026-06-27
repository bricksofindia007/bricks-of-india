> **DEPRECATED — superseded by `Day_9_Ground_Truth_FINAL.md`**
> This file reflects session 1 state only (before /admin/pending, source fixes, Server Actions fix). Do not use as reference. Read `Day_9_Ground_Truth_FINAL.md` instead.

---

# Day 9 Ground Truth — Bricks of India (SESSION 1 — DEPRECATED)

**Date written:** 2026-05-09, end of session (IST)
**Session duration:** ~3 hours
**Branch:** main
**Last commit:** 12b26a6 — docs: commit orphaned Day 5 session handover

This document supersedes Day 8 Ground Truth on all points of conflict.

---

## A. Repo state

**Verification block:**
```bash
cd "C:\Users\bharg\Documents\BricksofIndia\website" && git status && git log --oneline -5 && git branch --show-current
```
Expected: branch `main`, clean, last commit `12b26a6`.

**Day 9 commit trail (selected):**
```
12b26a6  docs: commit orphaned Day 5 session handover
6e2e47b  feat(admin): /admin/pending — password-gated draft review page
9106d2c  fix(radar-03): use plain insert instead of upsert
db1dd2d  feat(radar): RADAR-03 classifier — score/filter raw_signals, write to pending_drafts
4651696  fix(nav): Sets link and hero CTAs point to /sets not /compare
3a683f9  fix(scraper): paginate sets load to bypass PostgREST 1000-row cap
```

---

## B. Database state (unchanged from Day 8)

- sets: 24,190
- store_prices: 1,900 rows, 1,278 unique sets
- raw_signals: 163+
- pending_drafts: 5
- news_articles: 20 (frozen 29 days)
- blog_posts: 19 (frozen 29 days)
- reviews: 0

---

## C. Bugs closed this session

| ID | Description | Commit |
|---|---|---|
| BUG-01 | Nav "Sets" → /compare (should be /sets) | 4651696 |
| BUG-02 | Hero CTA "Browse 2026 sets" → /compare | 4651696 |
| BUG-03 | Stats block "24,190 SETS TRACKED" → /compare | 4651696 |

---

## D. Bugs still open

| ID | Description | Severity |
|---|---|---|
| BUG-04 | DK books / non-LEGO ISBNs appearing as set cards on /compare | Low |
| DEFECT-010 | actions/checkout + setup-node deprecated Node 20, deadline 2026-06-02 | Medium |
| RADAR-03-TUNE | Classifier over-indexes on Rebrickable as NEWS; BrickNerd digest/contest round-ups not caught by community regex | P2 |
| NETLIFY-CREDITS | Production deploys paused — free-tier build minutes exhausted. Billing resets 2026-05-22. /admin/pending + RADAR-03 + scraper fixes not live on production until then. | P1 |

---

## E. Full functional audit results (completed Day 9)

### ✅ Verified working
- Homepage: hero, CTAs, affiliate banner, price search, theme grid, news strip
- Nav: all links correct post-fix (Sets→/sets, Themes, Deals, Reviews, News, About, Search)
- /compare: search, theme filter chips, price filter chips, affiliate banner
- /sets: 24,190 count, cards load with images (lazy), Price TBD on unpriced sets
- Set detail page: price table (Toycra/MBH/Jaiman/Amazon/Flipkart), Buy Now → store in new tab, WhatsApp share with ABHINAV12, FAQ accordion with live prices, breadcrumb
- /news: article cards, category filters, article click-through, breadcrumb
- /blog: loads, category filters
- /deals: loads, affiliate section
- /reviews: hero renders, empty state code present (REVIEWS LOADING + mascot)
- /themes: loads, 25 themes
- /lab: 3 tools, Biryani Index live and calculating correctly
- /about: loads, YT/IG buttons
- /legal/privacy, /legal/terms, /contact: all load
- Footer: all links correct (About, Privacy, Terms, Contact, YouTube, Instagram, email)

### ⚠️ Known issues (not bugs)
- /search → redirects to /compare (intentional — compare IS search)
- Set card images lazy-load (timing, not a bug)
- News article images lazy-load on first scroll (timing, not a bug)

---

## F. Priority list — next session

### F.1 Immediate (next session, in order)

| # | Item |
|---|---|
| 1 | RADAR-03 classifier — score/filter raw_signals, write qualifying signals to pending_drafts |
| 2 | /admin/pending route — authenticated Next.js route to review and publish |
| 3 | First 3 reviews — write manually using Voice Codex, publish to reviews table |

### F.2 P1 — Within 7 days

| Item | Notes |
|---|---|
| PRICE-PIPELINE-01 | Brickset MSRP ingestion. Unblocks /compare full price filter, fixes catalogue-audit |
| EL-05 | ElevenLabs voice clone test. Decision gate for video pipeline |
| DEFECT-010 | Bump actions/checkout and setup-node to @v5 before 2026-06-02 |
| BUG-04 | Filter non-LEGO ISBNs (DK books) from /compare set cards |

### F.3 Do NOT do next session
- Do not start RADAR-05/06/07 before RADAR-03 and /admin/pending are live
- Do not investigate scraper coverage further — 5.3% is a data gap, not a bug

---

## G. Quick reference

- GitHub: bricksofindia007 / bricks-of-india
- Supabase: hqpaiarhmiocmjrzjhtw
- Local repo: C:\Users\bharg\Documents\BricksofIndia\website
- Last commit: 4651696
- store_prices: 1,900 rows, 1,278 unique sets
- Scraper upserts per run: ~1,866
- radar.yml cron: daily 17:30 UTC (23:00 IST)
- Next tracker update due: end of next session

---

**End of Day 9 Ground Truth.**

Next session: run verification block (section A), then straight to RADAR-03.

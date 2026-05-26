# Day 26 Ground Truth — Bricks of India
**Date written:** 2026-05-26
**Branch:** main
**HEAD commit:** bf151c5 (pre-session; Day 26 commits pending push)

---

## A. Work completed this session

### P0 fixes (committed before RADAR-08)

| Commit | Work |
|--------|------|
| `243d134` | Strip HTML comments in ReactMarkdown renderers (review/news/blog); `fmtInr()` ICU-safe price formatter; health-check BOM strip |
| `92dbf59` | Surface `generateArticle()` errors on `/admin/pending` UI via try/catch + `?genError=` redirect + red banner |
| `e32265e` | Add "Netlify Environment Variables" section to `docs/DEPLOYMENT.md` — documents all 8 runtime vars including GEMINI_API_KEY and ADMIN_PASSWORD which were absent |
| `bf151c5` | Strip `GEN:` debug logs from `generateArticle()` after root cause confirmed |

**Root cause of `generateArticle()` P0:** `GEMINI_API_KEY` was present in GitHub Secrets (build-time only) but absent from Netlify Environment Variables (runtime). User added key to Netlify UI; generation confirmed working in production.

### RADAR-08 — Automated reviews pipeline

**Script:** `scripts/radar-08-reviews.js`

**Logic:**
1. Paginate `store_prices` for all `in_stock=true, price_inr IS NOT NULL` rows
2. Join to `sets` table by set_number → get name + UUID
3. Dedup: skip sets with existing `reviews` row (UUID match) or existing `pending_drafts` source_url (`https://brickset.com/sets/<set_number>/`)
4. Filters: price_inr ≥ ₹1,000 (price floor); skip if name matches `/\b(pen|keychain|key chain|magnet|bag charm|pin)\b/i` (accessory filter)
5. Best store per set: mybrickhouse(1) > toycra(2) > jaiman(3), tiebreak price_inr desc
6. Sort candidates: store priority asc, price desc → take top 10
7. Insert with `status: 'approved'` and `draft_title` pre-populated

**Draft title format:** `LEGO [Set Name] ([Set Number]) — Worth ₹[fmtInr(price)] in India?`
**Source URL format:** `https://brickset.com/sets/[set_number]/`

**First run results (10 rows written to pending_drafts, status=approved):**

| # | Set | Store | Price |
|---|-----|-------|-------|
| 1 | LEGO Death Star (75419) | mybrickhouse | ₹1,04,999 |
| 2 | LEGO Eiffel Tower (10307) | mybrickhouse | ₹65,999 |
| 3 | LEGO Titanic (10294) | mybrickhouse | ₹63,999 |
| 4 | LEGO Venator-Class Republic Attack Cruiser (75367) | mybrickhouse | ₹58,999 |
| 5 | LEGO Jabba's Sail Barge (75397) | mybrickhouse | ₹51,999 |
| 6 | LEGO Avengers Tower (76269) | mybrickhouse | ₹48,999 |
| 7 | LEGO Tropical Aquarium (10366) | mybrickhouse | ₹45,799 |
| 8 | LEGO Volvo EC500 Hybrid Excavator (42215) | mybrickhouse | ₹44,999 |
| 9 | LEGO Hogsmeade Village – Collectors' Edition (76457) | mybrickhouse | ₹41,199 |
| 10 | LEGO Captain Jack Sparrow's Pirate Ship (10365) | mybrickhouse | ₹36,499 |

Set 1701 "Bionicle Gali Pen" was rejected by operator (price data mismatch) and eliminated by the accessory name filter.

**Cron integration:** Added as RADAR-08 step in `.github/workflows/radar.yml` after RADAR-03.

**Stats:** 1711 in-stock rows → 1047 matched sets → 934 candidates after filters → 10 selected.

---

## B. Known Netlify gotchas (permanent rules — add to CLAUDE.md next edit)

Three rules saved in memory (`feedback_claude_md_pending.md`) for addition to CLAUDE.md:

1. **`toLocaleString('en-IN')` throws on Netlify** — Netlify Node.js minimal ICU. Use `fmtInr()` (defined in `actions.ts`) everywhere.
2. **BOM in GitHub Secrets** — U+FEFF silently corrupts env vars. Strip with `.replace(/^﻿/, '').trim()` on sensitive env vars.
3. **Live page verification mandatory** — TypeScript green ≠ content correct. Fetch live URL and confirm symptom absent before closing any content fix.

---

## C. Open items carried forward

| Item | Status | Notes |
|------|--------|-------|
| GEO-01-FU1 | 🟡 Unblocked | Verify `buildReviewSchema()` on live `/reviews/lego-42172-mclaren-p1-review`. Netlify credits reset 2026-05-22. |
| Task 2 — "Generate All Approved" batch button | 🔴 Not started | Sequential generation, 7s delay (Gemini 10 RPM). Deferred until RADAR-08 confirmed working in production. |
| CLAUDE.md Netlify Gotchas section | 🟡 Pending | Add on next CLAUDE.md edit — memory saved in `feedback_claude_md_pending.md`. |
| CE-02: 8 `/guides` articles | 🔴 Not started | Fan CoLab critical path. Start June 1. 1 article per 11 days. |
| CE-05: History of LEGO in India | 🔴 Not started | Fan CoLab must-be-live. Start by July 1. |
| CE-01: Builder Spotlight × 2 | 🔴 Not started | 2 live required for Fan CoLab. |

---

## D. Pipeline state

- **Nightly cron:** RADAR-01 → RADAR-02 → RADAR-03 → RADAR-08. RADAR-04 (generate) remains on-demand only.
- **pending_drafts:** was 233 source_urls pre-session; +10 approved review drafts written this session.
- **reviews table:** 3 rows (McLaren P1, Rivendell, NHM).
- **store_prices in-stock:** 1711 rows across mybrickhouse/toycra/jaiman.

---

## E. Day 27 entry point

```
cat docs/handover/Day_26_Ground_Truth.md && echo "---" && cat BOI_MASTER_TRACKER.md
```

Priority order:
1. Verify RADAR-08 ran clean on first nightly cron (check `gh run list --workflow=radar.yml` for the next run after 17:30 UTC)
2. Task 2 — "Generate All Approved" batch button on `/admin/pending`
3. GEO-01-FU1 — verify JSON-LD on live review page
4. CE content (WEB-05 `/guides` route done — start CE-02 articles)

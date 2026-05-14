# BOI Content Tracker

> Voice Codex, RSS ingestion, article publishing operations, morning brief.
>
> **Last updated:** 2026-05-10 (Day 9 session 3: pipeline fully operational end-to-end, 4 articles published via pipeline, 15 sources, newsletter Resend confirmed, BRIEF-02 resolved)

---

## Section A — Voice Codex (Phase 1)

**Status:** ✅ Done 2026-05-01 — `docs/codex/BOI_Codex_v2.md` and `docs/codex/BOI_Codex_v2.docx`, 21 pages, Sections 1+2. Verdict vocabulary locked: BUY / WAIT FOR SALE / IMPORT ONLY / SKIP. India Paragraph spec written. Length rules: news 300–400, reviews 500–700, opinion 400–500, weekly digest 350–400.

**Why it matters:** Without the Codex, WEB-01→04 article lint gates can't validate "India Paragraph present" or verdict format. Every article still needs manual voice-checking. Once the Codex exists, Claude Project (Phase 2) and article pipeline (WEB-01→04) unlock.

### A.1 — Source material (already identified)

- 25 existing BOI scripts (tonal reference)
- Jeremy Clarkson reference material (positive anchor)
- Anti-examples — LEGO press release language, generic influencer style (negative anchor)

### A.2 — Codex contents (8–12 pages)

| Section | Content | Status |
|---------|---------|--------|
| CODEX-01 | Voice one-liner — "Jeremy Clarkson meets Indian wallet anxiety" | ✅ Done 2026-05-01 |
| CODEX-02 | Sentence rhythm rules — long sentence followed by short. For impact. | ✅ Done 2026-05-01 |
| CODEX-03 | Vocabulary whitelist (EMI, chai, traffic, wallet, etc.) | ✅ Done 2026-05-01 |
| CODEX-04 | Vocabulary blacklist (press-release words: "thrilled to announce", "unveils", "stunning new") | ✅ Done 2026-05-01 |
| CODEX-05 | Per-format templates — news 300–400w, review 500–700w, opinion 400–500w, digest 350–400w | ✅ Done 2026-05-01 |
| CODEX-06 | **India Paragraph spec** — INR price (MSRP × 1.35 × USD/INR), stores, 4–6 week lag, verdict, relatable comparison | ✅ Done 2026-05-01 |
| CODEX-07 | Hook library — opens with Indian context (chai/traffic/EMI), pivots to LEGO in 2 sentences | ✅ Done 2026-05-01 |
| CODEX-08 | Sign-off library — "On that bombshell..." (opinion), "Bubyee" (YouTube) | ✅ Done 2026-05-01 |
| CODEX-09 | Title conventions — news = set# + "India", review = "Worth ₹X in India?" | ✅ Done 2026-05-01 |
| CODEX-10 | Verdict vocabulary — Buy now / Wait / Import only / Avoid (no hedging) | ✅ Done 2026-05-01 |
| CODEX-11 | Precise hyperbole examples — "₹6,499 = 11kg mangoes or 4 months Spotify Premium" | ✅ Done 2026-05-01 |
| CODEX-12 | Never explain the joke — failure modes + example rewrites | ✅ Done 2026-05-01 |

### A.3 — Delivery

| ID | Task | Status |
|----|------|--------|
| CODEX-DOC-01 | Write Codex as `VOICE_CODEX.md` at project root | ✅ Done 2026-05-01 — shipped as `docs/codex/BOI_Codex_v2.md` (path differs from original spec; file is canonical) |
| CODEX-DOC-02 | Load into Claude Project knowledge (Phase 2) | 🔴 — manual task, pending |
| CODEX-DOC-03 | Convert rules to machine-checkable lint regexes where possible | 🔴 — blocked on WEB-01 |

---

## Section B — Claude Project workbench (Phase 2)

**CONTENT-02: 🟡 Unblocked — Claude Project workbench setup (manual, ~30 min). Unblocked as of 2026-05-01 (Voice Codex shipped). Pending manual setup in Claude.ai.**

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| WORKBENCH-01 | Create Claude Project for BOI | 🔴 | CODEX-DOC-01 |
| WORKBENCH-02 | Upload Voice Codex as project knowledge | 🔴 | CODEX-DOC-02 |
| WORKBENCH-03 | Upload 25 existing scripts as reference | 🔴 | — |
| WORKBENCH-04 | Upload Rebrickable API sample outputs | 🔴 | — |
| WORKBENCH-05 | System prompt tuned to BOI voice + India Paragraph requirement | 🔴 | WORKBENCH-02 |

---

## Section C — Topical Radar / RSS pipeline (Phase 3)

### C.1 — Sources (locked)

| Source | Method | Filter |
|--------|--------|--------|
| Brickset | RSS | All new posts |
| The Brothers Brick | RSS | All new posts |
| New Elementary | RSS | All new posts |
| BrickNerd | RSS | All new posts |
| r/lego | JSON feed | >500 upvotes |
| Rebrickable | recent-adds API | All |
| LEGO.com/new | Scrape | Daily diff |
| YouTube RSS | Per-channel feeds | Key creators (list TBD) |

### C.2 — Pipeline tasks

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| RADAR-01 | RSS/API/scrape/reddit/youtube fetcher | ✅ Done — 14 sources active (up from 11). Jay's Brick Blog added Tier 1, Brickset re-enabled at correct URL, Blocks Magazine re-enabled. sanitizeXml() added. Last run: 322 signals fetched. `scripts/radar/fetch-rss.js`. | — |
| RADAR-02 | De-dup across sources | ✅ Done — 4-pass design. Last run: 322 in, 280 unique. `scripts/radar/dedupe-signals.js`. | RADAR-01 |
| RADAR-03 | Classify signals → pending_drafts | ✅ Done 2026-05-09 — `scripts/radar/classify-signals.js` (commit `db1dd2d`). Threshold score ≥4. Last run: 997 candidates, 50 queued. 349 total pending_drafts. | RADAR-02 |
| RADAR-04 | Gemini 2.5 Flash-Lite article generation — on-demand only | ✅ Done 2026-05-09 — **removed from cron**. `generate-drafts.js` kept for manual bulk use. `generateArticle()` Server Action in /admin/pending triggers per-draft on operator click. Full-text fetch live (JBB 1607 chars, Brickset 4000 chars). Zero Gemini waste. | RADAR-03 |
| RADAR-05 | /admin/pending — four-state review+publish UI | ✅ Done 2026-05-09 — (1) draft+no-body → Approve signal/Reject, (2) draft+body → Approve article/Reject, (3) approved+no-body → Generate Article button, (4) approved+body → Publish button. Publish inserts to news_articles/blog_posts. | RADAR-04 |
| RADAR-06 | Email morning brief at 08:00 IST | 🔴 | RADAR-05 |
| RADAR-07 | Lock full radar cron (RADAR-01→02→03) | ✅ Done — radar.yml chains RADAR-01 → RADAR-02 → RADAR-03 daily 17:30 UTC. RADAR-04 removed from cron — on-demand only. | All above |

**Nothing in this pipeline auto-publishes.** Drafts land in `/admin/pending` and require manual approve-and-merge.

---

## Section D — Article publishing ops

### D.1 — Current state

| Metric | Value |
|--------|-------|
| Articles live | 20 |
| Publishing cadence | Manual |
| Target cadence | 2–3 website news posts/week (per BOI Content OS Phase 5) |

### D.2 — Weekly output target (reference, from BOI Content OS)

| Format | Count/week | Capacity needed | Current status |
|--------|------------|-----------------|----------------|
| Long-form video | 1 | — | See Video tracker |
| News videos | 2 | — | See Video tracker |
| Shorts / Reels | 3 | — | See Video tracker |
| IG carousels | 3 | — | See Social tracker |
| Website news posts | 2–3 | 10hr weekend | 🟡 Manual, pre-pipeline |

### D.3 — Priority tasks

| ID | Task | Status | Notes |
|----|------|--------|-------|
| REVIEWS-FIRST-3 | Write first 3 set reviews | ✅ Done 2026-05-14 — 42172 McLaren P1 (BUY), 10316 Rivendell (BUY), 10326 NHM (WAIT FOR SALE). All Codex-compliant, all pass lint. Unblocks GEO-01-FU1 and RLFM. | — |

---

## Content Rendering

| ID | Task | Status | Notes |
|----|------|--------|-------|
| CONTENT-RENDER-01 | Markdown rendering fix on /news/[slug] | ✅ Done | react-markdown applied. Asterisks no longer render as literal **text**. |
| CONTENT-RENDER-02 | Apply markdown fix to /blog | 🔴 Not started | — |
| CONTENT-RENDER-03 | ArticleCard excerpt markdown leakage | 🔴 Not started | — |

---

## Content Inventory (as of 2026-05-02)

| Type | Published | Source |
|---|---|---|
| News articles | 24+ | news_articles table — 4 published via RADAR pipeline (Road Bike, Friends Summer 2026, NYC Architecture, Road Bike 11380). All have hero_image populated. |
| Blog posts | 19 | blog_posts table |
| Reviews | 3 | McLaren P1 42172 (BUY ₹29,399), Rivendell 10316 (BUY ₹39,999), NHM 10326 (WAIT FOR SALE ₹34,999). All Codex-compliant. Schema: hero_image, excerpt, seo_title, seo_description, updated_at. |
| Voice Codex | 1 (v2) | docs/codex/ |

Content is 100% database-driven. No markdown-on-disk publishing workflow.
GA4 wired in src/app/layout.tsx via gtag (NEXT_PUBLIC_GA_MEASUREMENT_ID).

---

## Section E — Morning brief (08:00 IST email)

| ID | Task | Status |
|----|------|--------|
| BRIEF-01 | Email template — top stories, classifier buckets, suggested angles | 🔴 |
| BRIEF-02 | Sender infrastructure (SMTP / Resend / similar) | ✅ Done 2026-05-10 — Resend SDK (`resend@6.12.3`), from `abhinav@bricksofindia.com`, RESEND_API_KEY in all env stores. Newsletter confirmation live. See `src/app/actions/newsletter.ts`. |
| BRIEF-03 | Unsubscribe / delivery compliance | 🔴 (only needed if list expands) |

---

## Legend

- ✅ Done
- 🟡 In progress / partial
- 🔴 Not started / blocked

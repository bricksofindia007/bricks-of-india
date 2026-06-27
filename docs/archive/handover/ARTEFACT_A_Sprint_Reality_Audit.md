# BOI Sprint Reality Audit
**Date:** 2026-05-02
**Status:** Replaces 2026-05-01 audit. This is the new master handover doc.
**Source:** AUDIT-01 printout (filesystem + Supabase + GHA evidence)

---

## TL;DR — What's actually true on 2026-05-02

The sprint shipped real things. It also accumulated debt that yesterday's audit missed because yesterday's audit trusted the trackers. The trackers lied — three of the four sub-trackers haven't been touched in 8 days and still show pre-sprint state.

**What shipped (verifiable on disk / in DB):**
- BOI_MASTER_TRACKER.md is current and canonical (272 lines, updated today)
- Voice Codex v2 (docs/codex/BOI_Codex_v2.docx + .md) — the highest-ROI item is done
- GEO-01 server-side JSON-LD migration — needs view-source verification but tracker says shipped
- LAB-01 Biryani Index — live at /lab/biryani-index, brief on disk
- Catalogue + search fix (fix/catalog-search merged 2026-04-26, commit d19625d)
- Sitemap (dynamic, live, pulls from all four content tables)
- GA4 wired via gtag in src/app/layout.tsx
- INFRA-03 GitHub Actions deploy live, scrapers firing 3×/day
- 20 news articles, 19 blog posts in production

**What's broken or missing that the trackers don't show:**
- Three sub-trackers (Content, Video, Social) are decorative — 8 days stale, still showing 🔴 for items that are ✅
- briefs/CATALOG-04-v2.md is referenced in the master tracker but the file does not exist
- PULSE prototype HTML files referenced as "Done" in WEB tracker but absent from working tree
- /lab has no index page — navigating to /lab would 404 today
- reviews table is empty (0 rows) — /reviews route renders nothing, blocks GEO-01-FU1
- No Cache-Control headers in next.config.mjs — root cause of 2.3% Cloudflare cache rate
- Lint gates (WEB-01) spec'd in Codex Page 20 but not implemented; .eslintrc.json is baseline only
- LAB-03 (price snapshot cron) brief exists but unfired — every day delayed pushes LAB-05 launch

**The realistic re-assessment is at the bottom of this doc.** Read it.

---

## 1. The four sub-trackers: which ones are real

| Tracker | Lines | Last updated | Status | Verdict |
|---|---|---|---|---|
| BOI_MASTER_TRACKER.md | 272 | 2026-05-02 | Current | ✅ **Canonical. Trust this.** |
| BOI_WEB_TRACKER.md | 239 | 2026-04-25 (7d stale) | Pre-sprint | ⚠️ Decorative — shows pre-Codex, pre-GEO-01 state |
| BOI_CONTENT_TRACKER.md | 128 | 2026-04-24 (8d stale) | Pre-sprint | ⚠️ Decorative — Voice Codex still shows 🔴 Not started |
| BOI_VIDEO_TRACKER.md | 104 | 2026-04-24 (8d stale) | Pre-sprint | ⚠️ Decorative |
| BOI_SOCIAL_TRACKER.md | 120 | 2026-04-24 (8d stale) | Pre-sprint | ⚠️ Decorative |

**Implication:** Yesterday's handover doc cited the sub-trackers as evidence of state. That was wrong. They're snapshots from 8 days ago, frozen in pre-sprint amber. The master tracker has been doing all the real work alone.

**Fix path:** Artefact B (tracker hygiene brief) brings all four sub-trackers to current state in a single ~30-minute pass. After that they become useful again. Until then, the master tracker is the only reliable view.

---

## 2. Workstream-by-workstream: file evidence vs claimed state

### ✅ Shipped and verified

**Voice Codex v2 (CONTENT-01)**
- File evidence: `docs/codex/BOI_Codex_v2.md`, `docs/codex/BOI_Codex_v2.docx` — both on disk
- Tracker state (master): ✅ Done, 2026-05-01
- Tracker state (Content sub-tracker): 🔴 Not started ← **stale, wrong**
- Reality: Done. 21 pages. Sections 1+2. Verdict vocab locked. India Paragraph spec written. Length rules locked.

**LAB-01 Biryani Index**
- File evidence: `src/app/lab/biryani-index/` directory exists with implementation
- Brief: `briefs/LAB-01-biryani-index.md` (8 KB)
- Tracker state: ✅ Shipped
- Reality: Confirmed live.

**Catalogue + search fix (CATALOG-02, CATALOG-03)**
- File evidence: merged commit `d19625d` on main, branch `fix/catalog-search` deleted
- Catalogue: 16,888 rows, 99.4% image coverage
- Tracker state (WEB sub-tracker, Section G): "PR open" ← **stale, should be Done**
- Reality: Merged 2026-04-26.

**INFRA-03 GitHub Actions deploy**
- File evidence: `.github/workflows/deploy.yml` live, scrapers firing 3×/day at 100% success
- Tracker state: ✅ Done
- Reality: Confirmed.

**SITE-01 Dynamic sitemap**
- File evidence: `src/app/sitemap.ts` — pulls from sets, blog_posts, news_articles, reviews
- Live at `/sitemap.xml`
- Tracker state (WEB sub-tracker B.1): ✅ Done
- Reality: Confirmed.

**GA4 analytics**
- File evidence: `gtag` in `src/app/layout.tsx` via `next/script` (strategy="afterInteractive"), measurement ID from `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- Reality: Live. No second analytics tool needed.

---

### 🟡 Shipped but unverified

**GEO-01 server-side JSON-LD migration**
- Tracker state (master): ✅ Shipped
- File evidence: not directly verified in this audit — needs a `curl` against a live page + grep for `<script type="application/ld+json">` in the rendered HTML, not in the React tree
- **Action:** Run view-source verification on a sample of /sets, /news, /blog URLs before claiming done in any external comms (RLFM application, etc.)

**ROBOTS-01**
- Tracker state: claimed shipped
- Not independently verified in this audit
- **Action:** `curl https://bricksofindia.com/robots.txt` and confirm it allows ClaudeBot, GPTBot, etc.

---

### 🔴 Spec-ready, not implemented

**LAB-02 Which Set Are You? quiz**
- Brief: `briefs/LAB-02-which-set-quiz.md` (14 KB) ✓
- Code: none
- Status: 🔴 Not fired

**LAB-03 Price snapshot cron** ⏰ **TIME-SENSITIVE**
- Brief: `briefs/LAB-03-price-snapshot-cron.md` (10 KB) ✓
- Code: no source files, no GHA workflow
- Status: 🔴 Not fired
- **Why it matters:** Every day delayed pushes LAB-05 (Price Drop Board) launch. The cron needs to accumulate snapshot history before the board has anything to render. This was flagged 6 days ago and is still sitting.

**LAB-04 Lab homepage strip + /lab index**
- Brief: `briefs/LAB-04-homepage-strip.md` (13 KB) ✓
- Code: `src/app/lab/` exists but contains only `biryani-index/`
- Status: 🔴 Not fired
- **Side effect:** `/lab` returns 404 today. The Biryani Index is reachable only at `/lab/biryani-index`, with no parent index, no nav entry, no homepage strip.

**WEB-01 Four lint gates in CI**
- Spec: Codex Page 20 (in `docs/codex/BOI_Codex_v2.md`)
- Code: `.eslintrc.json` is baseline `next/core-web-vitals` + `next/typescript` only
- Required gates: word count, India Paragraph presence, verdict enum match, image 200 check
- Status: 🔴 Not implemented
- **Why it matters:** RADAR-01 (Topical Radar cron) is hard-blocked on this. Without lint gates, the cron would auto-publish drafts that violate Codex rules.

**RADAR-01 Topical Radar cron**
- Spec: none beyond the master tracker description
- Code: none, no GHA workflow
- Status: 🔴 Not started
- **Blocked by:** Voice Codex (✅ done) + WEB-01 lint gates (🔴 not done)
- Codex is unblocked, lint gates are the actual remaining blocker

**CF-CACHE-01 Cloudflare cache rate**
- Reality: 2.3% cache hit rate
- Root cause confirmed in audit: `next.config.mjs` `headers()` sets only security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection). No `Cache-Control` or `s-maxage` headers on any route. ISR `revalidate` exists in `deals/page.tsx` and `rebrickable.ts` but that's Next.js data cache, not HTTP cache.
- Status: P1, Day 3
- **Fix is small:** add `Cache-Control: public, s-maxage=...` headers per route type (long for /sets static pages, short for /news listings, none for /admin). One PR.

**VOICE-01 ElevenLabs voice test**
- Status: 🔴 Not started
- Decision still open: free-tier test pending to assess whether clone preserves Clarkson dry-sarcastic delivery

**BRIEF-01 Morning email brief**
- Status: 🔴 Not started, no SMTP infra in repo

**DATA-01 store_prices ↔ prices reconcile**
- Status: 🔴 Not started, open carry-over from WEB tracker Section H

**CONTENT-02 Claude Project workbench**
- Status: 🟡 Unblocked (Codex done), pending manual setup in Claude.ai
- This is a 30-minute manual task, not a code task

---

### ❌ Lost or missing files

**briefs/CATALOG-04-v2.md**
- Master tracker carry-overs table says "Brief at briefs/CATALOG-04-v2.md"
- File does not exist in repo
- Either never written or deleted before commit
- **Action:** decide whether to rewrite the brief or remove the reference. Without the brief, CATALOG-04 v2 (USD MSRP ingest) is not actually spec-ready despite tracker implying it is.

**bricks-globe-preview.html, lego-search-pulse.html**
- Referenced as "Done" in BOI_WEB_TRACKER.md Section E
- Neither file exists in current working tree
- Likely on Abhinav's local machine, never committed, or committed and later deleted
- **Action:** ask Abhinav whether these exist locally; if yes, commit them; if no, mark PULSE prototypes as 🔴 not 🟢

---

### ❓ Untracked / undocumented

**IMG-01 image resize/automation**
- No resize scripts on disk
- `public/` has brand/mascot PNGs only
- `next.config.mjs` has remote image domains configured
- Not found in any tracker — either not actually a workstream, or it's a phantom item from older planning

**PERF-01 Lighthouse CI**
- No `lighthouserc.*` file
- No Lighthouse step in any GHA workflow
- Not in the open workstream list — appears to have been dropped or never started

**INFRA-06 scripts/test-env.mjs**
- Flagged in WEB tracker as "untracked file from audit run"
- Now gitignored
- Should be marked done/closed

---

## 3. Content runway: the gap nobody is tracking

### What's published
- 20 news articles
- 19 blog posts
- **0 reviews** ← this is the problem

### Implications
1. **Reviews = 0 blocks GEO-01-FU1.** The follow-up to verify `/reviews/[slug]` JSON-LD cannot be completed because there are no review pages to verify. The route renders, but the listing is empty and there are no detail pages to inspect.

2. **Reviews = 0 blocks the RLFM differentiation story.** "India's first LEGO RLFM" is stronger if the site has reviews of sets actually available in India, with INR pricing and the India Paragraph applied. 0 reviews undermines that.

3. **Content runway is shorter than it looks.** 20 news + 19 blog ≈ 39 pieces over the launch period. At the locked length budgets (news 300–400, blog/opinion 400–500, weekly digest 350–400), this is roughly 14,000–17,000 words of published content. RLFM applications typically expect a track record. Need to map publish cadence against the 13-week roadmap to August.

4. **No content-on-disk workflow.** Content is 100% database-driven via Supabase. There is no `content/` or `data/` directory. Every published piece lives in `news_articles`, `blog_posts`, or `reviews` tables. This is fine architecturally but means there's no markdown-on-disk audit trail — the only history is Supabase row timestamps.

### What needs to happen
- **First reviews: 3 pieces minimum before RLFM submission.** Pick 3 sets from the catalogue that have stable INR pricing on Toycra/MyBrickHouse, write reviews using locked Codex format, publish, then run GEO-01-FU1 verification.
- **Decide cadence:** if Topical Radar (RADAR-01) is the answer, lint gates (WEB-01) become the critical path. If manual cadence is the answer, schedule the next 13 weeks now.
- **CONTENT-02 (Claude Project workbench)** is the fastest unlock for manual cadence — it lets Abhinav draft in BOI voice with the Codex pre-loaded, no code required. ~30 minutes of setup.

---

## 4. The four LAB briefs: firing order revisited

Original firing order (from late April): LAB-01 → LAB-03 (parallel) → LAB-02 → LAB-04
Reality on 2026-05-02:

| Item | Brief on disk | Code on disk | Why it should fire when |
|---|---|---|---|
| LAB-01 Biryani Index | ✓ | ✓ | Already done |
| LAB-03 Price snapshot cron | ✓ | ✗ | **Fire next.** Cron needs runway to accumulate snapshots before LAB-05 (Price Drop Board) has data. Time-sensitive. |
| LAB-04 Homepage strip + /lab index | ✓ | ✗ | Fire after LAB-03 has at least 1 day of data. Without /lab index, Biryani Index is orphaned. |
| LAB-02 Which Set quiz | ✓ | ✗ | Fire after LAB-04. Lower urgency — fun, not infrastructure. |

**Recommended new firing order:** LAB-03 (today) → LAB-04 (this week) → LAB-02 (next week)

---

## 5. The realistic re-assessment

Yesterday's audit treated the sprint as "broadly on track with one P0 (GEO-01) and assorted manual checks." That framing was too generous. Here's the real picture:

### What's gone right
- The big-ticket strategic items shipped: Voice Codex (the unique IP), GEO-01 server-side JSON-LD (the discoverability bet), catalogue fix (the foundational data layer), GitHub Actions migration (the cost-control pivot off Netlify build minutes). These are the items that mattered most.
- The master tracker discipline is working. One file, kept current, single source of truth.
- The architectural decisions are sound. Database-driven content + Cloudflare in front + GHA for cron is the right shape for this scale.

### What's gone wrong
1. **Sub-tracker hygiene collapsed.** Three of four sub-trackers haven't been updated in 8 days. Anyone reading them would get a 100% wrong picture of state. The master tracker has been carrying all the load alone.
2. **Briefs were written but not fired.** Four LAB briefs have been on disk since 2026-04-26. Three are still 🔴. That's 6 days of brief-but-no-execution.
3. **One brief is missing entirely.** CATALOG-04 v2 is referenced as if spec-ready; the brief file isn't there.
4. **PULSE work appears lost.** Two prototype HTML files claimed as Done are not in the working tree. Either uncommitted or deleted.
5. **Reviews = 0 has no owner and no due date.** This is the single biggest blocker for the RLFM differentiation story and nobody has scheduled the first three reviews.
6. **Lint gates are the silent critical path.** WEB-01 isn't loud, but RADAR-01 cannot ship without it, and RADAR-01 is what makes the content cadence sustainable. Without WEB-01, all content publishing remains manual.
7. **CF-CACHE-01 is cheap to fix and getting older every day.** The 2.3% cache rate is costing edge performance for Indian visitors (Cloudflare BOM is supposed to be doing more work). The fix is one PR adding `Cache-Control` headers in `next.config.mjs`.

### What this means for the next 7 days
**Highest leverage, in order:**
1. **Tracker hygiene pass (Artefact B)** — 30 minutes. Restores trust in the four sub-trackers. Without this, every future handover is fighting stale state.
2. **LAB-03 (price snapshot cron)** — fire today. Runway-critical. Brief is on disk.
3. **CF-CACHE-01** — one PR, an afternoon. Adds Cache-Control headers. Cheap, visible, helps Indian users immediately.
4. **First three reviews** — schedule and write. Unblocks GEO-01-FU1 and strengthens RLFM application. Codex is ready, format is locked, just needs execution.
5. **WEB-01 lint gates** — implement the 4 gates. Unblocks RADAR-01.
6. **CATALOG-04 v2 brief** — decide: rewrite the missing brief or remove the reference.
7. **PULSE files** — ask Abhinav, then either commit or downgrade tracker status.

### What can wait
- LAB-02 quiz (fun, low urgency)
- VOICE-01 ElevenLabs test (decision-only, not blocking shipping)
- BRIEF-01 morning email (nice-to-have)
- DATA-01 reconcile (technical debt, no current pain)
- LAB-05 onwards (deferred until LAB-03 has runway)

### The honest framing for the RLFM application
At the current rate, August submission is achievable but tight. The differentiation story (India's first LEGO RLFM, multi-platform, INR pricing, India Paragraph) holds — but only if reviews ≥ 3 by submission and content cadence is visible from the outside. Right now the cadence story is "39 pieces in roughly 4 weeks then it depends." That's defensible; it's not yet impressive.

---

## 6. Anomalies log (for the record)

1. `briefs/CATALOG-04-v2.md` referenced in tracker, file missing.
2. Three sub-trackers 8 days stale, still showing pre-sprint state.
3. PULSE prototype HTMLs claimed Done, not in working tree.
4. `/lab` 404s — no index page, only `/lab/biryani-index` reachable.
5. No Cache-Control headers anywhere in `next.config.mjs`.
6. INFRA-06 `scripts/test-env.mjs` flagged as untracked but now gitignored — should be closed.
7. WEB tracker Section G shows CATALOG-02/03 as "PR open" — branch was merged + deleted on 2026-04-26.
8. `reviews` table empty — `/reviews/[slug]` GEO verification cannot complete.
9. `DATA_SOURCES.md` exists (9 KB, updated 2026-04-26), wasn't part of audit task list but presumably current — confirm in next session.
10. CLAUDE.md operational rules are clean (16 lines, 6 rules) — no rot detected.

---

## 7. Files printed in AUDIT-01 (for traceability)

Master tracker, CLAUDE.md, four sub-trackers, four LAB briefs (first 30 lines each). Full evidence list in AUDIT-01 printout.

---

**This document supersedes the 2026-05-01 handover. New-Claude should read this first, then Artefact C (handover doc), then BOI_MASTER_TRACKER.md.**

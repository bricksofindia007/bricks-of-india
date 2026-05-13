# Day 12 Ground Truth — Bricks of India
**Date written:** 2026-05-13
**Branch:** main
**HEAD commit:** f74a67d
**Remote:** origin/main — in sync after `git pull` (local was 9 commits behind; commits existed on origin, not yet fetched)

---

## A. Last verified commits (from git log — no invented hashes)

```
f74a67d  docs: Day 12 session handover
e17e977  fix(radar): resolve INDIA_PARAGRAPH prompt contradiction — both code paths now instruct marker; Gate 2 warns on missing marker
c313795  feat(admin): WEB-01 — lint gates 1-3 in publishDraft (word count, INR price, verdict enum)
a311fc6  feat(radar): PARSER-01b -- New Elementary via Blogger JSON (?alt=json), bypasses XML violations entirely
dd4691f  fix(reviews): remove dead prices(*) join — legacy table, never rendered in template
700b561  feat(radar): PARSER-01 — @extractus/feed-extractor fallback for malformed feeds, re-enable New Elementary
5024470  fix(radar): RADAR-03-TUNE — skip Rebrickable API signals, add digest/round-up/headline/contest to COMMUNITY_RE
e15b4f4  refactor(design): DESIGN-CSS-01 — replace hardcoded hex with CSS variables in Footer, LabStrip, TricolourStripe, globals.css
62d1da7  docs: Day 11 Ground Truth handover
987b07a  chore(tracker): Day 11 update — design sprint, phase/blocker/carry-over corrections
```

**Note on session continuity:** This local clone was 9 commits behind origin at Day 13 open. All Day 12 commits existed on origin (GitHub Actions triggered build+deploy for each push). Local was stale because the Day 12 session used a different terminal. `git pull` applied as fast-forward; working tree is now clean.

---

## B. Open items — verified status

### DESIGN-CSS-01
**Status: DONE**
Evidence: commit e15b4f4. `src/app/globals.css:93` scrollbar-thumb now uses `var(--boi-saffron)`. `globals.css:107` `.highlight-yellow` uses `var(--boi-saffron)`. `src/components/layout/Footer.tsx`, `src/components/ui/LabStrip.tsx`, `src/components/ui/TricolourStripe.tsx` changed in the same commit per git diff output.
Remaining: `src/app/page.tsx` still has hardcoded `#138808` (line 207), `#1a2332` (line 221), `#FFC72C` (line 178), `#E30613` (line 191), `#666` (stat band labels) — tracked as DESIGN-CSS-02.

### REVIEW-PRICE-01
**Status: OPEN**
Evidence: `src/app/reviews/[slug]/page.tsx:29` — `.select('*, sets(*)')`. No `store_prices` join. Sidebar renders set image, name, set number, and "Compare Prices →" link — but no live price from `store_prices`. The dead `prices(*)` legacy join was removed (dd4691f) but no replacement added.

### REVIEW-SLUG-01
**Status: NOT CARRIED FORWARD**
Evidence: Absent from Day 12 session handover carry-overs (f74a67d). No commit explicitly closing it. No production 404 reported in Day 12. Reviews exist with correct slugs in DB (`lego-10317-land-rover-defender-90-review`, `lego-42161-lamborghini-huracan-tecnica-review`, `lego-31120-medieval-castle-review` — confirmed by live query). Treating as resolved by Day 12 verification; not a Day 13 priority.

### PARSER-01
**Status: DONE**
Evidence: `config/sources.json:12–19` — New Elementary entry has `"format": "blogger-json"`, URL `https://www.newelementary.com/feeds/posts/default?alt=json&max-results=20`, no `"enabled": false` key. Commits 700b561 (@extractus fallback) + a311fc6 (Blogger JSON final approach). Day 12 handover confirms fetched=20, written=20 on manual trigger.

### RADAR-03-TUNE
**Status: DONE**
Evidence: commit 5024470. `scripts/radar/classify-signals.js` is in the changed file list from git pull diff. Day 12 handover confirms skipped_community=223 on verification run.

### WEB-01
**Status: DONE**
Evidence: `src/app/admin/pending/actions.ts:317–358` — `lintDraft()` function implemented. Gate 1 (word count ±10% by format), Gate 2 (INDIA_PARAGRAPH marker warn + ₹ price hard fail), Gate 3 (verdict enum for reviews only). Called at `actions.ts:376` inside `publishDraft()`. Commit c313795.

### DEFECT-005
**Status: OPEN**
Evidence: No commit in Day 12 addressing RADAR-04 voice prompt. Not in Day 12 session handover as resolved. Listed as P1 carry-over in handover.

### YT-404-WATCH
**Status: UNVERIFIED — cron log not inspected**
Evidence: `gh run list` shows radar-pipeline ran 2026-05-12 19:18:44 UTC, completed success in 1m0s (run 25756795926). Top-level status is green. Individual channel 404s would be in stdout logs — not fetched in this audit. Day 13 first action: inspect run 25756795926 logs for YouTube 404 errors.

### DESIGN-CSS-02
**Status: OPEN**
Evidence: grep of `src/app --include="*.tsx" --include="*.css"` for brand hex values returns `src/app/page.tsx` as a match. `page.tsx:178` has `#FFC72C` (boi-yellow), `:191` has `#E30613` (near boi-red), `:207` has `#138808` (boi-green), `:221` has `#1a2332` (boi-navy), multiple `:666` (stat band secondary text). Exempt by protocol: `admin/pending/page.tsx` (admin tool), `lab/heat-map/page.tsx` (D3), `lab/which-set/page.tsx` (lab).

### LAB-05
**Status: OPEN / DEFERRED**
Evidence: LAB-03 cron running since 2026-05-02. Today is 2026-05-13 = 11 days of snapshot data. Eligible ~2026-06-01 (30d minimum). No code written yet.

### LAB-06
**Status: OPEN / DEFERRED**
Evidence: Depends on CATALOG-04 v2 (Brickset cron for retirement exit dates). Not started. No change since Day 11.

### HOME-HERO-01
**Status: OPEN / UNVERIFIABLE FROM CODE**
Evidence: `src/app/page.tsx:78` hero uses `background: 'linear-gradient(180deg, var(--boi-sky) 0%, var(--boi-sky-light) 100%)'`. CSS variables in use. The issue (illustration missing on some viewports) requires browser testing to confirm — cannot determine from code alone.

### CONTENT-RENDER-03
**Status: DONE (code shipped Day 10; production spot-check deferred)**
Evidence: commit b415cab `fix(articles): strip markdown literals from ArticleCard excerpt`. Shipped 2026-05-10. Still listed as P3 in Day 12 handover ("verify in production"). Code is correct. If production verification is needed, navigate to /news or /blog and inspect excerpt text.

---

## C. Database state — from live queries only

- **sets total rows:** 24,440 (up from 24,190 at Day 11 — catalogue sync added ~250 sets)
- **sets with lego_mrp_inr populated:** 3,370
- **store_prices rows:** 1,916
- **pending_drafts by status:** draft=229, approved=5, published=4, rejected=4 — **total: 242**
  - Day 12 handover claimed "4 clean drafts remaining" — this refers to the `approved` queue state at Day 12 end. New draft signals were added by the RADAR cron on 2026-05-12 19:18 UTC, which explains the 229 draft count.
- **reviews rows + verdict values:**
  - `lego-10317-land-rover-defender-90-review` — rating=4, verdict="BUY — the build experience is exceptional, and the end result earns its place on any desk."
  - `lego-42161-lamborghini-huracan-tecnica-review` — rating=4, verdict="BUY — the best Technic set at this price point, and it still holds up in 2026."
  - `lego-31120-medieval-castle-review` — rating=5, verdict="BUY — the best value LEGO set you can buy in India at ₹9,000."
  - All 3 verdicts start with Codex enum (BUY). Full descriptive text is in the `verdict` column (not truncated to enum only).
- **newsletter_subscribers:** 1 (was 2 per Day 11 ground truth — one removed between Day 11 and Day 13)

---

## D. Pipeline state — from config/sources.json and gh run list only

**Active sources (from sources.json — no inference):**
| Tier | Sources | Count |
|---|---|---|
| Tier 1 editorial | The Brothers Brick, Jay's Brick Blog, New Elementary (blogger-json), BrickNerd | 4 |
| Tier 2 official | Brickset (/feed), Rebrickable Recent Sets (api) | 2 |
| Tier 3 community | r/lego (json) | 1 |
| Tier 4 YouTube | BrickClicker, JANGBRiCKS, Brick Vault, Tiago Catarino, Brick Finds & Flips, JB Spielwaren, Bricks of India | 7 |
| Tier 5 topic-only | Blocks Magazine, Brick Fanatics | 2 |
| **Total active** | | **16** |

Disabled (still in sources.json with `enabled: false`): LEGO New Sets (SPA), LEGO Ideas Blog, Eurobricks News.

**Note:** Day 12 handover and CLAUDE.md both say "15 active sources" — they were counting New Elementary as the 15th when re-added. Correct count from sources.json is **16** (New Elementary is the 16th).

- **New Elementary enabled:** YES — `config/sources.json:14` has no `enabled: false`. Format: `blogger-json`. URL: `?alt=json&max-results=20`.
- **Last radar run:** 2026-05-12 19:18:44 UTC — completed success — 1m0s (run 25756795926)
- **Last scraper run:** 2026-05-13 03:33:42 UTC — completed success — 1m53s (run 25776612742)
- **Last price snapshot:** 2026-05-12 06:18:49 UTC — completed success — 3m35s (run 25717175026)
- **Day 12 Netlify deploys:** 3 builds triggered 2026-05-12 04:47–04:54 UTC — all completed success

---

## E. Design system state — from grep results only

**Files with hardcoded brand hex — non-D3, non-admin (`src/app --include="*.tsx" --include="*.css"`):**
- `src/app/page.tsx` — `#FFC72C` (line 178 stats band border), `#E30613` (line 191 stats band border), `#138808` (line 207 stats band border), `#1a2332` (line 221 stats band border), `#666` (multiple stat band label lines)
- `src/app/globals.css` — hex values appear only as CSS variable definitions (`:root` block lines 7–35) and `html`/`body`/`h1-h6` base styles. Scrollbar and `.highlight-yellow` now use `var(--boi-saffron)` ✅

**Exempt by protocol (D3 lab / admin tool):**
- `src/app/lab/heat-map/page.tsx` — D3 visualization, intentionally hex
- `src/app/lab/which-set/page.tsx` — lab tool, intentionally hex
- `src/app/admin/pending/page.tsx` — admin tool, intentionally hex

**CSS variable adoption estimate:** ~75% (Day 12 converted Footer, LabStrip, TricolourStripe, globals.css. Remaining: `page.tsx` stats band — 5 color values across 4 stat cards).

---

## F. Recommended Day 13 entry point

Based only on verified open items above, ordered by priority:

1. **P1 — YT-404-WATCH (2 min):** Inspect gh run 25756795926 logs for YouTube 404 errors. `gh run view 25756795926 --log | grep -i "404\|error\|youtube"`. Act only if BOI channel (`UC1CCrLlp4XnOoxVzAftFwfQ`) 404s.
2. **P1 — REVIEW-PRICE-01 (~30 min):** Add `store_prices` lookup to `reviews/[slug]/page.tsx`. Current query at line 29: `.select('*, sets(*)')`. Need to fetch `store_prices` by `set_id` and display cheapest in-stock price in sidebar (above "Compare Prices →" link).
3. **P1 — DEFECT-005 (half session):** Iterate on RADAR-04 voice prompt in `src/app/admin/pending/actions.ts`. The `FORMAT_ADDENDUM` and `INDIA_PARAGRAPH_SPEC` constants are in that file (lines 122–155). Test with a real draft in /admin/pending.
4. **P2 — DESIGN-CSS-02 (~20 min):** Convert `page.tsx` stats band hardcoded hex to CSS variables. 4 cards × 1 border color each: `#FFC72C` → `var(--boi-yellow)`, `#138808` → `var(--boi-green)`, `#1a2332` → `var(--boi-navy)`. `#E30613` — closest is `--boi-red` (#E3000B, slightly different). Decide whether to align or keep.

---

## G. Day 13 start command

```bash
cat docs/handover/Day_12_Ground_Truth.md && echo "---" && cat BOI_MASTER_TRACKER.md
```

---

*Supersedes Day 12 Session Handover for session context. Written 2026-05-13 after full evidence-based audit: git fetch + pull, live Supabase queries, full file reads of changed sources.*

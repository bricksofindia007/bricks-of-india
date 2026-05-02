# BRIEF: Tracker Hygiene Pass (TRACK-HYGIENE-01)

**For:** Claude Code (terminal)
**Mode:** Read-write
**Estimated time:** 30 minutes
**Single commit at end:** Yes
**Branch:** `chore/tracker-hygiene-2026-05-02`

---

## Why this brief exists

The Sprint Reality Audit (2026-05-02) found that three of the four sub-trackers (Web, Content, Video, Social) have not been updated in 8 days and still reflect pre-sprint state. The master tracker has been carrying all the load alone. This brief brings the four sub-trackers to current state in a single hygiene pass.

**This is not a feature commit.** No code changes. Tracker files only. Plus removal of one stale reference and creation of one placeholder.

---

## Pre-flight

```bash
cat BOI_MASTER_TRACKER.md | head -50
git status
git checkout -b chore/tracker-hygiene-2026-05-02
```

If the working tree is dirty, stop. Stash or commit existing work before starting.

---

## Task list (do in order)

### Task 1 — BOI_WEB_TRACKER.md updates

Open `BOI_WEB_TRACKER.md`. Make these edits:

**1a. Update header timestamp**
- Find the "Last updated" line (currently 2026-04-25)
- Change to `2026-05-02`

**1b. Section G — CATALOG-02 / CATALOG-03**
- Currently shows "PR open" on `fix/catalog-search` branch
- Reality: merged on 2026-04-26, commit `d19625d`, branch deleted
- Change status from "🟡 PR open" to "✅ Done — merged 2026-04-26 (d19625d)"
- Add one-line note: "Catalogue: 16,888 rows, 99.4% image coverage. Sync time 6.5 min (was 3+ hours)."

**1c. Section H — DATA-01 store_prices ↔ prices reconcile**
- Leave as 🔴 not started
- Add note: "Carried over to 2026-05 sprint. Not yet scheduled."

**1d. Section E — PULSE prototypes**
- Currently shows `bricks-globe-preview.html` and `lego-search-pulse.html` as ✅ Done
- File evidence: neither file exists in working tree
- Change status to "🟡 Status uncertain — files not in working tree as of 2026-05-02 audit. Confirm with Abhinav whether files exist locally."
- Do NOT delete the section — the work may still exist on Abhinav's machine.

**1e. INFRA-06 scripts/test-env.mjs**
- Currently flagged as "untracked file from audit run"
- Reality: now gitignored
- Change to "✅ Resolved — gitignored 2026-04-26"

**1f. Add new section at top: "Active Sprint State (as of 2026-05-02)"**
Include this block verbatim under the header:

```markdown
## Active Sprint State (as of 2026-05-02)

This sub-tracker is a detail view. The canonical state lives in `BOI_MASTER_TRACKER.md`.

**Shipped this sprint:**
- ✅ GEO-01 server-side JSON-LD (verification pending — see GEO-01-FU1 below)
- ✅ ROBOTS-01 (verification pending)
- ✅ CATALOG-02, CATALOG-03 (merged 2026-04-26, d19625d)
- ✅ INFRA-03 GitHub Actions deploy (3×/day scrapers, 100% success)
- ✅ Voice Codex v2 → see Content tracker
- ✅ LAB-01 Biryani Index → see Content tracker
- ✅ Markdown rendering fixes on /news/[slug] (CONTENT-RENDER-01)

**Open carry-overs:**
- 🔴 CF-CACHE-01 (P1, Day 3) — root cause: no Cache-Control headers in next.config.mjs
- 🔴 WEB-01 4 lint gates (spec at Codex Page 20)
- 🔴 GEO-01-FU1 (blocked by reviews=0)
- 🔴 CONTENT-RENDER-02 (markdown fix to /blog)
- 🔴 CONTENT-RENDER-03 (ArticleCard excerpt markdown leakage)
- 🔴 BLOG-RECON-01 (audit /blog vs /news redundancy)
- 🟡 PULSE prototypes — file existence uncertain
- 🟡 CATALOG-04 v2 — referenced brief `briefs/CATALOG-04-v2.md` is missing from repo

**No Cache-Control fix details:**
- next.config.mjs `headers()` currently sets only X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- ISR `revalidate` exists in deals/page.tsx + rebrickable.ts (Next.js data cache, not HTTP cache)
- Required: add `Cache-Control: public, s-maxage=...` per route type
```

---

### Task 2 — BOI_CONTENT_TRACKER.md updates

Open `BOI_CONTENT_TRACKER.md`. Make these edits:

**2a. Update header timestamp** to `2026-05-02`.

**2b. Phase 1 — Voice Codex**
- Currently: 🔴 Not started
- Reality: ✅ Done 2026-05-01 — `docs/codex/BOI_Codex_v2.md` and `docs/codex/BOI_Codex_v2.docx`, 21 pages, Sections 1+2
- Change status to ✅ Done
- Add note: "Verdict vocabulary locked: BUY / WAIT FOR SALE / IMPORT ONLY / SKIP. India Paragraph spec written. Length rules: news 300–400, reviews 500–700, opinion 400–500, weekly digest 350–400."

**2c. CONTENT-RENDER-01 markdown fix on /news/[slug]**
- Add as ✅ Done if not present
- Note: "react-markdown applied. Asterisks no longer render as literal **text**."

**2d. Add new items as 🔴 Not started:**
- CONTENT-RENDER-02 — apply markdown fix to /blog
- CONTENT-RENDER-03 — ArticleCard excerpt markdown leakage
- CONTENT-02 — Claude Project workbench setup (manual, ~30 min, unblocked)
- REVIEWS-FIRST-3 — write 3 reviews to unblock GEO-01-FU1 and RLFM application

**2e. Add Content Inventory section:**

```markdown
## Content Inventory (as of 2026-05-02)

| Type | Published | Source |
|---|---|---|
| News articles | 20 | news_articles table |
| Blog posts | 19 | blog_posts table |
| Reviews | 0 | reviews table — **empty, blocks GEO-01-FU1 and RLFM** |
| Voice Codex | 1 (v2) | docs/codex/ |

Content is 100% database-driven. No markdown-on-disk publishing workflow.
GA4 wired in src/app/layout.tsx via gtag (NEXT_PUBLIC_GA_MEASUREMENT_ID).
```

---

### Task 3 — BOI_VIDEO_TRACKER.md updates

Open `BOI_VIDEO_TRACKER.md`. Make these edits:

**3a. Update header timestamp** to `2026-05-02`.

**3b. Add stale notice at top:**

```markdown
> **Note (2026-05-02):** This tracker has been refreshed with current state. The Voice Codex v2 (CONTENT-01) shipped on 2026-05-01 and applies to video scripts as well as written content. All future scripts must follow Codex Section 2 verdict vocabulary and India Paragraph rules.
```

**3c. ElevenLabs decision (VOICE-01)**
- Status: 🔴 Not started
- Add note: "Decision still open — free-tier test pending to assess whether clone preserves Clarkson dry-sarcastic delivery. CapCut confirmed banned in India; DaVinci Resolve (free) confirmed as editor."

**3d. If the tracker has a "scripts written" count, update to 16 (the actual scripts analysed for Codex v2).**

---

### Task 4 — BOI_SOCIAL_TRACKER.md updates

Open `BOI_SOCIAL_TRACKER.md`. Make these edits:

**4a. Update header timestamp** to `2026-05-02`.

**4b. Add stale notice at top:**

```markdown
> **Note (2026-05-02):** This tracker has been refreshed. Voice Codex v2 (2026-05-01) applies to social posts. Instagram and YouTube community posts must use Codex-locked sign-offs ("On that bombshell…" for opinion, "Bubyee" for YouTube) and the locked opener "lets gooooo".
```

**4c. If platform handles are listed, confirm:**
- YouTube: @BricksofIndia
- Instagram: @bricksofindia
- (No other platforms confirmed in current strategy)

---

### Task 5 — Resolve the missing CATALOG-04 v2 brief

The master tracker references `briefs/CATALOG-04-v2.md` but the file doesn't exist.

**Option A (recommended):** Create a placeholder brief that flags the gap.

Create `briefs/CATALOG-04-v2-PLACEHOLDER.md` with:

```markdown
# CATALOG-04 v2 — USD MSRP Ingest (PLACEHOLDER)

**Status:** Brief not yet written. Referenced in BOI_MASTER_TRACKER.md as `briefs/CATALOG-04-v2.md` but that file does not exist in the repo as of 2026-05-02.

**Action required:** Either rewrite the brief at the canonical path `briefs/CATALOG-04-v2.md`, or remove the reference from the master tracker.

**Known context (from prior planning):**
- Brickset is the sole price source. Rebrickable carries no USD MSRP.
- Prices are stored in `set_prices` table.
- Joined to sets via `v_set_current_price` view.

**Decision needed:** rewrite or remove the reference.
```

**Option B (faster but less informative):** Remove the line `Brief at briefs/CATALOG-04-v2.md` from the master tracker carry-overs table.

Pick Option A unless instructed otherwise. Option A leaves a breadcrumb for the next session.

---

### Task 6 — Update BOI_MASTER_TRACKER.md (light touch)

Open `BOI_MASTER_TRACKER.md`. Make these edits only:

**6a. Update the "Last updated" line** to `2026-05-02 (post-hygiene pass)`.

**6b. Add a one-line note at the top:**

```markdown
> Sub-trackers (Web, Content, Video, Social) refreshed 2026-05-02 to current state via TRACK-HYGIENE-01.
```

**6c. If the carry-overs table has a row for `briefs/CATALOG-04-v2.md`,** update it to point to `briefs/CATALOG-04-v2-PLACEHOLDER.md` and add the note "(brief missing — placeholder created 2026-05-02)".

**Do NOT** rewrite or restructure the master tracker. It is canonical and current. The hygiene pass is for the sub-trackers, not the master.

---

### Task 7 — Verify nothing else changed

```bash
git status
git diff --stat
```

Expected change set:
- `BOI_MASTER_TRACKER.md` — small edits
- `BOI_WEB_TRACKER.md` — moderate edits
- `BOI_CONTENT_TRACKER.md` — moderate edits
- `BOI_VIDEO_TRACKER.md` — small edits
- `BOI_SOCIAL_TRACKER.md` — small edits
- `briefs/CATALOG-04-v2-PLACEHOLDER.md` — new file

No other files should change. If anything in `src/`, `public/`, `.github/`, `next.config.mjs`, or any other code path appears in the diff, **stop and ask** before committing.

---

### Task 8 — Commit

Single commit, single message:

```bash
git add BOI_MASTER_TRACKER.md BOI_WEB_TRACKER.md BOI_CONTENT_TRACKER.md \
        BOI_VIDEO_TRACKER.md BOI_SOCIAL_TRACKER.md \
        briefs/CATALOG-04-v2-PLACEHOLDER.md
git commit -m "chore(trackers): hygiene pass — refresh four sub-trackers to current state

- BOI_WEB_TRACKER.md: close CATALOG-02/03 (merged d19625d), flag PULSE
  files as uncertain, close INFRA-06, add active sprint state header
- BOI_CONTENT_TRACKER.md: close Voice Codex v2, add CONTENT-RENDER-01,
  add CONTENT-RENDER-02/03/CONTENT-02/REVIEWS-FIRST-3 as open, add
  content inventory (20 news, 19 blog, 0 reviews)
- BOI_VIDEO_TRACKER.md: refresh, link Codex v2, note VOICE-01 decision
- BOI_SOCIAL_TRACKER.md: refresh, link Codex v2 sign-offs
- briefs/CATALOG-04-v2-PLACEHOLDER.md: new — flags missing brief
- BOI_MASTER_TRACKER.md: timestamp + sub-tracker refresh note

No code changes. Sub-trackers were 8 days stale; master remains canonical.

Refs: TRACK-HYGIENE-01"
```

Do NOT push. Print git log -1 and stop. Abhinav reviews before push.

---

## Stop conditions

Stop and surface to Abhinav if:
- Working tree is dirty before starting
- Any code file appears in the diff
- A sub-tracker has structural sections this brief doesn't anticipate (e.g. unrelated open items not covered above) — list them and ask
- The master tracker carry-overs table doesn't have a row for `briefs/CATALOG-04-v2.md` (means the reference is somewhere else; find it)

---

## Done when

- [ ] All four sub-trackers timestamp = 2026-05-02
- [ ] Voice Codex shows ✅ in Content tracker
- [ ] CATALOG-02/03 show ✅ in Web tracker
- [ ] PULSE prototypes show 🟡 with explanation
- [ ] INFRA-06 closed
- [ ] briefs/CATALOG-04-v2-PLACEHOLDER.md exists
- [ ] Master tracker has the one-line refresh note
- [ ] Single commit on `chore/tracker-hygiene-2026-05-02` branch
- [ ] No push, awaiting Abhinav review

---

**Brief author:** Claude (strategic chat layer), 2026-05-02
**Executor:** Claude Code (terminal)
**Review gate:** Abhinav approves before push

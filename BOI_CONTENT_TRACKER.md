# BOI Content Tracker

> Voice Codex, RSS ingestion, article publishing operations, morning brief.
>
> **Last updated:** 2026-04-24

---

## Section A — Voice Codex (Phase 1)

**Status:** 🔴 Not started. This is the critical blocker for content automation.

**Why it matters:** Without the Codex, WEB-01→04 article lint gates can't validate "India Paragraph present" or verdict format. Every article still needs manual voice-checking. Once the Codex exists, Claude Project (Phase 2) and article pipeline (WEB-01→04) unlock.

### A.1 — Source material (already identified)

- 25 existing BOI scripts (tonal reference)
- Jeremy Clarkson reference material (positive anchor)
- Anti-examples — LEGO press release language, generic influencer style (negative anchor)

### A.2 — Codex contents (8–12 pages)

| Section | Content | Status |
|---------|---------|--------|
| CODEX-01 | Voice one-liner — "Jeremy Clarkson meets Indian wallet anxiety" | 🔴 |
| CODEX-02 | Sentence rhythm rules — long sentence followed by short. For impact. | 🔴 |
| CODEX-03 | Vocabulary whitelist (EMI, chai, traffic, wallet, etc.) | 🔴 |
| CODEX-04 | Vocabulary blacklist (press-release words: "thrilled to announce", "unveils", "stunning new") | 🔴 |
| CODEX-05 | Per-format templates — news 300–400w, review 500–700w, opinion 400–500w, digest 350–400w | 🔴 |
| CODEX-06 | **India Paragraph spec** — INR price (MSRP × 1.35 × USD/INR), stores, 4–6 week lag, verdict, relatable comparison | 🔴 |
| CODEX-07 | Hook library — opens with Indian context (chai/traffic/EMI), pivots to LEGO in 2 sentences | 🔴 |
| CODEX-08 | Sign-off library — "On that bombshell..." (opinion), "Bubyee" (YouTube) | 🔴 |
| CODEX-09 | Title conventions — news = set# + "India", review = "Worth ₹X in India?" | 🔴 |
| CODEX-10 | Verdict vocabulary — Buy now / Wait / Import only / Avoid (no hedging) | 🔴 |
| CODEX-11 | Precise hyperbole examples — "₹6,499 = 11kg mangoes or 4 months Spotify Premium" | 🔴 |
| CODEX-12 | Never explain the joke — failure modes + example rewrites | 🔴 |

### A.3 — Delivery

| ID | Task | Status |
|----|------|--------|
| CODEX-DOC-01 | Write Codex as `VOICE_CODEX.md` at project root | 🔴 |
| CODEX-DOC-02 | Load into Claude Project knowledge (Phase 2) | 🔴 |
| CODEX-DOC-03 | Convert rules to machine-checkable lint regexes where possible | 🔴 |

---

## Section B — Claude Project workbench (Phase 2)

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
| RADAR-01 | GitHub Action: hourly RSS fetch from all sources | 🔴 | — |
| RADAR-02 | De-dup across sources (same story, multiple outlets) | 🔴 | RADAR-01 |
| RADAR-03 | Classify: news / review / opinion / set-release / community | 🔴 | RADAR-02 |
| RADAR-04 | Claude API call to draft in BOI voice | 🔴 | WORKBENCH-05 |
| RADAR-05 | Write drafts to `/admin/pending` (not published) | 🔴 | RADAR-04 |
| RADAR-06 | Email morning brief at 08:00 IST | 🔴 | RADAR-05 |
| RADAR-07 | Lock full radar run to 23:00 IST daily | 🔴 | All above |

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

---

## Section E — Morning brief (08:00 IST email)

| ID | Task | Status |
|----|------|--------|
| BRIEF-01 | Email template — top stories, classifier buckets, suggested angles | 🔴 |
| BRIEF-02 | Sender infrastructure (SMTP / Resend / similar) | 🔴 |
| BRIEF-03 | Unsubscribe / delivery compliance | 🔴 (only needed if list expands) |

---

## Legend

- ✅ Done
- 🟡 In progress / partial
- 🔴 Not started / blocked

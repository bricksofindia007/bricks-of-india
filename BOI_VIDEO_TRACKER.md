# BOI Video Tracker

> YouTube long-form, Shorts / Reels, DaVinci Resolve workflow, ElevenLabs voice clone, script-to-video pipeline.
>
> **Last updated:** 2026-05-02

---

> **Note (2026-05-02):** This tracker has been refreshed with current state. The Voice Codex v2 (CONTENT-01) shipped on 2026-05-01 and applies to video scripts as well as written content. All future scripts must follow Codex Section 2 verdict vocabulary and India Paragraph rules.

---

## Section A — Production stack

| Tool | Purpose | Status |
|------|---------|--------|
| DaVinci Resolve | Editing (CapCut banned in India — confirmed) | ✅ Confirmed stack |
| ElevenLabs | Voice clone for narration | 🟡 Free-tier test pending |
| OBS / similar | Screen capture for news videos | 🔴 Not decided |
| Camera / mic | Self-record talking head | 🔴 Workflow TBD |

---

## Section B — ElevenLabs test (Phase 4 gate)

**Why this matters:** Outcome of free-tier test determines the entire video workflow — hybrid (AI narration + self-record inserts) vs full self-record. Do this first.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| EL-01 | Create ElevenLabs free-tier account | 🔴 | — |
| EL-02 | Record 3-min voice sample for cloning | 🔴 | — |
| EL-03 | Generate 1 test news script in cloned voice | 🔴 | — |
| EL-04 | A/B test — cloned voice vs self-record on same script | 🔴 | — |
| EL-05 | Decision: hybrid vs self-record | 🔴 Not started | Decision still open — free-tier test pending to assess whether clone preserves Clarkson dry-sarcastic delivery. CapCut confirmed banned in India; DaVinci Resolve (free) confirmed as editor. |

---

## Section C — YouTube long-form (Bricks of India channel)

### C.1 — Cadence target

| Format | Weekly | Current state |
|--------|--------|---------------|
| Long-form | 1 | Pre-pipeline, manual |
| News videos | 2 | Pre-pipeline, manual |

### C.2 — Pipeline tasks

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| YT-01 | Script template aligned to Voice Codex | 🔴 | CODEX-DOC-01 |
| YT-02 | Thumbnail template (India-first visual language) | 🔴 | — |
| YT-03 | End-screen / card conventions | 🔴 | — |
| YT-04 | Description template with India Paragraph + store links | 🔴 | CODEX-06 |
| YT-05 | Tag + chapter conventions | 🔴 | — |

---

## Section D — Shorts / Reels (Phase 4)

### D.1 — Cadence target

| Format | Weekly | Current state |
|--------|--------|---------------|
| Shorts | 3 | Pre-pipeline |
| Reels (IG) | Same content cross-posted | Pre-pipeline |

### D.2 — Pipeline tasks

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| SHORT-01 | 60-second script template in BOI voice | 🔴 | CODEX-DOC-01 |
| SHORT-02 | DaVinci template (vertical 9:16, caption style, brand bumper) | 🔴 | EL-05 |
| SHORT-03 | Hook-in-first-3-seconds structural rule | 🔴 | — |
| SHORT-04 | Cross-post workflow — YouTube Shorts → IG Reels | 🔴 | — |

---

## Section E — Script-to-video flow

**Goal:** one script produces long-form, short, and social carousel from the same source of truth.

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| FLOW-01 | Master script template with cut-markers for short version | 🔴 | CODEX-DOC-01 |
| FLOW-02 | Auto-extract short script from long script | 🔴 | FLOW-01 |
| FLOW-03 | Auto-extract carousel text from script | 🔴 | FLOW-01, see Social tracker |
| FLOW-04 | Single-source publishing checklist | 🔴 | All above |

---

## Section F — Equipment + setup

| ID | Task | Status |
|----|------|--------|
| EQUIP-01 | Mic setup for self-record | 🔴 |
| EQUIP-02 | Lighting setup | 🔴 |
| EQUIP-03 | Background / set — LEGO display shelf | 🔴 |
| EQUIP-04 | Recording environment noise baseline | 🔴 |

---

## Legend

- ✅ Done
- 🟡 In progress / partial
- 🔴 Not started / blocked

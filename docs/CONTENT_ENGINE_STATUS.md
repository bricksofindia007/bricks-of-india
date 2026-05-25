# Content Engine — Status

**Last updated:** 2026-05-25  
**Fan CoLab deadline:** August 2026 (~12 weeks)

---

## Overview

The Content Engine (CE) is the long-form + community + social content layer that differentiates BOI from a pure price tracker. All items are currently NOT STARTED. Fan CoLab application requires specific CE items to be live by the application date.

---

## All items

| ID | Name | Format | Cadence | Status | Fan CoLab dep? |
|----|------|--------|---------|--------|----------------|
| CE-01 | Indian Builder Spotlight | IG post + `/community` archive | Monthly | 🔴 Not started | ✅ Yes — 2+ live |
| CE-02 | LEGO 101 India | Evergreen article at `/guides` | 8 articles by Aug 2026 | 🔴 Not started | ✅ Yes — 8 live |
| CE-03 | Build Debate | Opinion at `/opinion` | Monthly | 🔴 Not started | No |
| CE-04 | Blind Bag Reel | IG Reel + YouTube Short | Bi-monthly | 🔴 Not started | No |
| CE-05 | History of LEGO in India | Flagship `/guides` piece | One-time | 🔴 Not started | ✅ Yes — must be live |
| CE-06 | Deals Alert IG Story | IG Story (Canva) | Weekly | 🔴 Not started | No — but blocked by LAB-06 |

---

## Detail

### CE-01: Indian Builder Spotlight
**Route:** IG post + `/community` archive page  
**Cadence:** Monthly  
**Fan CoLab requirement:** 2+ spotlights live at `/community`  
**Description:** Feature an Indian LEGO builder — MOC photos, their LEGO journey, what building means to them. Indian-first content that no other LEGO platform creates. Builds community and demonstrates editorial voice beyond price tracking.  
**Blockers:** `/community` route + layout not yet built (WEB-06). Need to identify first subject.  
**Effort estimate:** 1 session (page) + 1–2h sourcing + writing per spotlight.

### CE-02: LEGO 101 India
**Route:** `/guides`  
**Cadence:** 8 articles by August 2026 (1 every ~11 days from June 1)  
**Fan CoLab requirement:** 8 articles live at `/guides`  
**Description:** Evergreen beginner guides for Indian buyers. Examples:
- "How to buy LEGO in India: a complete guide"
- "LEGO themes explained for Indian buyers"
- "LEGO vs LEGO-compatible: what's worth buying in India"
- "How to store and display LEGO sets"
- "LEGO investing in India: sets that hold value"
- "Understanding LEGO pricing in India vs global"
- "Best LEGO sets under ₹2,000 in India"
- "When does LEGO go on sale in India?"

**SEO priority** — evergreen, high search intent, long tail.  
**Blockers:** `/guides` route + layout not yet built (WEB-05).  
**Effort estimate:** `/guides` page = 1 session. Each article = 30–60min with Gemini assist + Codex compliance check.

### CE-03: Build Debate
**Route:** `/opinion`  
**Cadence:** Monthly  
**Fan CoLab requirement:** None  
**Description:** Monthly opinion piece. Provocative take on LEGO topics — "Are Technic sets worth it?", "Has LEGO lost its creativity?", "Why Indian prices are a feature, not a bug". Establishes editorial voice.  
**Blockers:** `/opinion` route needed (WEB-07 — can be a tag/category on blog, not a full route).  
**Effort estimate:** 1–2h writing per piece once route exists.

### CE-04: Blind Bag Reel
**Route:** IG Reel + YouTube Short  
**Cadence:** Bi-monthly  
**Fan CoLab requirement:** None  
**Description:** Film at Toycra (Mumbai) or similar retailer — live Brickify app scanner mechanic (scan set, get price comparison). Demonstrates product utility in real-world Indian retail context.  
**Blockers:** Filming logistics (travel to retailer). Brickify app integration or manual demo.  
**Effort estimate:** 1 day filming + 2h editing per video.

### CE-05: History of LEGO in India
**Route:** `/guides/history-of-lego-india`  
**Cadence:** One-time flagship  
**Fan CoLab requirement:** Must be live before application  
**Description:** The definitive reference piece. When did LEGO officially enter India? First authorised retailers. Price history. Cultural reception. Why it remained a luxury vs. global affordability. This piece is the editorial anchor — demonstrates depth and research that RLFM expects.  
**Blockers:** Research required (Wayback Machine, Brickset forum archives, retailer interviews optional). WEB-05 route needed.  
**Effort estimate:** 4–6h research + writing. High ROI — single most important content piece for Fan CoLab.

### CE-06: Deals Alert IG Story
**Route:** Instagram Story (Canva-templated)  
**Cadence:** Weekly (every Monday)  
**Fan CoLab requirement:** None direct — but demonstrates content consistency and utility  
**Description:** Weekly IG Story showing top 3–5 LEGO deals available right now in India. Pulled from `/lab/deals` (LAB-06). Canva template with BOI branding.  
**Blockers:** LAB-06 frontend must be live first.  
**Effort estimate:** 30min/week once template and data source are live.

---

## Fan CoLab dependency timeline

**Application deadline: August 2026 (~12 weeks from 2026-05-25)**

| Item | Requirement | Weeks available | Effort |
|------|-------------|-----------------|--------|
| WEB-05 `/guides` route | Must exist before CE-02 | 13 | 0.5 session |
| WEB-06 `/community` route | Must exist before CE-01 | 13 | 0.5 session |
| CE-02: 8 `/guides` articles | 8 articles live | Start June 1 — 11 weeks, 1 article/11 days | Medium |
| CE-05: History piece | Must be live | Start by July 1 — 4 weeks | High |
| CE-01: 2 Builder Spotlights | 2 live | 13 weeks, need 2 subjects | Medium |
| LAB-06 `/lab/deals` | Unblocks CE-06 | 1 session — build ASAP | Low |

**Critical path:** WEB-05 → CE-02 (starts June 1) → CE-05 (July 1 hard deadline)

---

## Recommended start order

1. Build WEB-05 `/guides` route + WEB-06 `/community` route (1 session, unblocks CE-01 and CE-02)
2. Build LAB-06 `/lab/deals` frontend (1 session, unblocks CE-06)
3. Write CE-02 article 1 of 8 (establish template, ~45min)
4. Research + write CE-05 History piece (book a focused 4–6h session)
5. Identify subject for CE-01 Builder Spotlight 1 (reach out to Indian AFOL community)

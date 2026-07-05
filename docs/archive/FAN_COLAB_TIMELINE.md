# Fan CoLab Application — Timeline Tracker

**Application deadline:** August 2026 (~9 weeks from 2026-05-30)  
**Last updated:** 2026-05-30  
**Risk level:** LOW — 4 of 5 required items DONE. Only CE-01 Builder Spotlights remain (outreach done 2026-05-29, awaiting respondents).

---

## What is Fan CoLab?

LEGO Fan CoLab (RLFM — Recognised LEGO Fan Media) is the formal designation that grants:
- Media access at LEGO events + Fan Weekend invitations
- Advance set review access
- LEGO press kit eligibility
- Legitimacy signal for affiliate + partnership conversations

BOI's application target: August 2026. Requirements are inferred from RLFM guidelines — Abhinav has read them. The items below are what's needed to present a compelling application.

---

## Required items

| # | Item | Route | Status | Due |
|---|------|-------|--------|-----|
| 1 | `/guides` route — must exist | WEB-05 | ✅ DONE — Day 25 (2026-05-25), commit `eb8a049` | June 7 |
| 2 | 9 guides live at `/guides` (8 LEGO 101 + History) | CE-02 + CE-05 | ✅ DONE — Day 28 (2026-05-28). IDs 1–9. All Codex-compliant. | July 25 |
| 3 | History of LEGO in India — flagship piece | CE-05 | ✅ DONE — Day 28 (2026-05-28). Slug: `history-of-lego-in-india`, ID 9. | July 1 (hard) |
| 4 | 2 Indian Builder Spotlights live at `/community` | CE-01 | 🟡 Outreach done 2026-05-29 (r/IndiaLEGO + AFOL India FB). Awaiting respondents. | July 15 |
| 5 | `/community` route — must exist | WEB-06 | ✅ DONE — Day 25 (2026-05-25), commit `2cda45a` | June 7 |

**Social automation (SOC-AUTO-01):** ✅ Already live. Daily posting across IG Feed, IG Reels, YouTube Shorts — demonstrates consistent publishing cadence. (Brief outage May 29–30 due to apt mirror issue — fixed commit `21e0de2`.)

---

## Critical path

```
2026-05-25 NOW
    │
    ▼
2026-06-07 ──► WEB-05 /guides route SHIPPED
    │        ──► WEB-06 /community route SHIPPED
    │            (2 weeks, one session each)
    │
    ▼
2026-06-08 ──► CE-02 Article 1 of 8 published
    │            Cadence: 1 article every ~11 days
    │
    ▼
2026-07-01 ──► CE-05 "History of LEGO in India" live (HARD DEADLINE)
    │            Requires: Wayback Machine research, Brickset forum archives
    │            Effort: 4–6h focused session
    │
    ▼
2026-07-15 ──► CE-01 Builder Spotlight #1 live
    │            CE-01 Builder Spotlight #2 live
    │            (need to identify 2 Indian AFOL subjects by June 1)
    │
    ▼
2026-07-25 ──► CE-02 Article 8 of 8 live (8 guides completed)
    │
    ▼
2026-08-01 ──► APPLICATION SUBMITTED
```

---

## Week-by-week targets

| Weeks | Window | Target |
|-------|--------|--------|
| Weeks 1–2 | May 25 – Jun 7 | Build WEB-05 + WEB-06 (1 session); find CE-01 subjects (outreach to Indian AFOL community) |
| Weeks 3–5 | Jun 8 – Jun 28 | CE-02 Articles 1–3; research CE-05 (Wayback Machine, retailer archives) |
| Week 6 | Jun 29 – Jul 5 | CE-05 write + publish (flagship — book a focused 4–6h session) |
| Weeks 7–8 | Jul 6 – Jul 19 | CE-01 Spotlights 1 + 2 (interview + write + photograph); CE-02 Articles 4–6 |
| Weeks 9–10 | Jul 20 – Aug 1 | CE-02 Articles 7–8; final review of all items; application prep |

---

## Dependencies (blocking chain)

- WEB-05 `/guides` route **must exist** before any CE-02 article can be published → WEB-05 by June 7
- WEB-06 `/community` route **must exist** before CE-01 spotlights can go live → WEB-06 by June 7
- CE-05 is the single hardest item (research-heavy) — must start no later than June 8
- LAB-06 `/lab/deals` unblocks CE-06 (Deals Alert IG Story) — not a hard Fan CoLab requirement but demonstrates monetisation content model

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| CE-05 research takes longer than 6h | High | High | Start immediately; can use Wayback Machine + Brickset forum archives |
| Can't find 2 Indian AFOL subjects in time | Medium | High | Post in r/IndiaLEGO + AFOL India FB group; reach out to Toycra/Jaiman staff |
| CE-02 guides feel templated/low-effort | Medium | High | Use Gemini assist but write in Codex voice; Clarkson-register opening |
| WEB-05/06 delayed beyond June 7 | Low | Critical | Both are 1-session frontend tasks; book sessions now |

---

## Non-requirements (won't block application)

- CE-03 Build Debate (opinion) — no Fan CoLab requirement
- CE-04 Blind Bag Reel — no Fan CoLab requirement
- CE-06 Deals Alert — not required, but helps demonstrate content breadth
- RADAR-08 automated reviews — not required

---

## Application checklist (submit August 2026)

- [x] WEB-05 `/guides` route live ✅ Day 25
- [x] 9 guides at `/guides` (CE-02 × 8 + CE-05 × 1) — all Codex-compliant ✅ Day 28
- [x] CE-05 "History of LEGO in India" at `/guides/history-of-lego-india` ✅ Day 28
- [x] WEB-06 `/community` route live ✅ Day 25
- [ ] CE-01 Builder Spotlight #1 and #2 at `/community` — with photos + quotes (outreach done 2026-05-29)
- [ ] SOC-AUTO-01 proof — **reframed 2026-07-05, was "screenshot 30+ consecutive daily posts on IG + YouTube":** complete automated coverage of every eligible LEGO.com India-relevant preview since launch — N posts, zero eligible sets missed (N=26 as of 2026-07-05, re-query `posted_sets` at capture time). Capture by July 25 unchanged. See `BOI_MASTER_TRACKER.md` FAN-COLAB-PROOF-01 for the full rationale (posting is a gallery-image eligibility gate, not a daily-cadence guarantee).
- [x] reviews page — 3+ Codex-compliant reviews live ✅
- [ ] bricksofindia.com uptime — all pages returning 200 (verify week before application)

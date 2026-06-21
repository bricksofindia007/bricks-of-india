# BOI Social Tracker

> Instagram carousel engine, cross-posting, LAN RLFM runway, community.
>
> **Last updated:** 2026-05-02
>
> **Addendum 2026-06-21 (consolidation audit):** SOC-AUTO-01 shipped Day 24 (2026-05-24) — see BOI_MASTER_TRACKER.md §Day 24. Social heartbeat table added 2026-06-17 (migration `20260617000000_social_automation_heartbeat.sql`). YouTube Shorts skipped gracefully since Day 34 (OAuth re-auth blocked on Google review). IG Feed + Reels posting daily. This sub-tracker reflects pre-automation state; items below marked 🔴 for the Canva/manual pipeline that was superseded by the automated Python pipeline.

---

> **Note (2026-05-02):** This tracker has been refreshed. Voice Codex v2 (2026-05-01) applies to social posts. Instagram and YouTube community posts must use Codex-locked sign-offs ("On that bombshell…" for opinion, "Bubyee" for YouTube) and the locked opener "lets gooooo".

---

## Section A — Instagram carousel engine (Phase 5)

### A.1 — Format (locked)

- **7-slide Canva carousel** as workhorse format
- **3× per week** cadence
- Content sources: news articles, review summaries, price drops, opinion takes

### A.2 — Pipeline tasks

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| IG-01 | Canva template — 7-slide brand frame (tricolour, Fredoka, Inter) | 🔴 | — |
| IG-02 | Cover slide template — hook-first headline | 🔴 | IG-01 |
| IG-03 | India Paragraph slide (INR + verdict) | 🔴 | CODEX-06 |
| IG-04 | CTA slide — link in bio / save / share | 🔴 | IG-01 |
| IG-05 | Caption template with hashtag set | 🔴 | — |
| IG-06 | Script-to-carousel extraction rule | 🔴 | FLOW-03 in Video tracker |
| IG-07 | Weekly carousel queue — 3 per week | 🔴 | All above |

---

## Section B — Cross-posting

| Platform | Content type | Status |
|----------|--------------|--------|
| Instagram feed | 8-image carousel (Brickset gallery) | ✅ Live — automated via `social-automation/pipeline.py`, daily 06:30 UTC. First live run 2026-05-24 (76342 Daily Bugle). |
| Instagram Reels | 8s video | ✅ Live — automated, same pipeline. |
| YouTube Shorts | 45s video | 🟡 Degraded — pipeline skips gracefully since Day 34; YouTube OAuth `invalid_grant`. Blocked on Google review (submitted 2026-06-02). |
| YouTube long-form | Native | 🔴 Not started |
| LinkedIn | Humorous personal storytelling | 🔴 Ad hoc, no cadence |
| Twitter / X | TBD | 🔴 Not scoped |

### B.1 — Cross-post tasks

| ID | Task | Status |
|----|------|--------|
| XPOST-01 | Single-source-of-truth publishing checklist | 🔴 |
| XPOST-02 | Per-platform format adaptation rules | 🔴 |
| XPOST-03 | Tracking sheet — what published where | 🔴 |

---

## Section C — LEGO Ambassador Network RLFM runway

**Goal:** India's first LAN RLFM recognition for Bricks of India.

### C.1 — Current state

| Metric | Value |
|--------|-------|
| Brand age | 6–12 months |
| YouTube subscribers | <500 |
| Instagram followers | TBD |
| Timeline to application | 3–6 months runway, apply at 1-year mark |

### C.2 — Application angles

- India's first LAN RLFM
- Multi-platform presence (YouTube + IG + website)
- Unique India market positioning (nobody else owns this)

### C.3 — Runway tasks

| ID | Task | Status |
|----|------|--------|
| LAN-01 | Monthly stats snapshot — subs, followers, views, site traffic | 🔴 |
| LAN-02 | Build case portfolio — top 10 content pieces | 🔴 |
| LAN-03 | Draft application text (prepare at 9-month mark) | 🔴 |
| LAN-04 | Submit application at 12-month mark | 🔴 |

---

## Section D — Community

### D.1 — Current channels

| Channel | Purpose | Status |
|---------|---------|--------|
| YouTube (@BricksofIndia) | Long-form + Shorts | ✅ Live, <500 subs |
| Instagram (@bricksofindia) | Carousels + Reels | ✅ Live |
| Website comments / contact | Reader engagement | 🔴 Not scoped |
| Newsletter | — | 🔴 Not scoped |

### D.2 — Community tasks

| ID | Task | Status |
|----|------|--------|
| COMM-01 | Decide on newsletter (Substack / Buttondown / ConvertKit) | 🔴 |
| COMM-02 | Build in-channel Q&A / AMA format for engagement | 🔴 |
| COMM-03 | Respond cadence — comments + DMs | 🔴 No formal policy |

---

## Section E — LEGO Insider account issue

**Status:** Open. Member #811205769 not recognised at POS globally despite verified 100+ set order history. Escalation drafted; awaiting response.

| ID | Task | Status |
|----|------|--------|
| INSIDER-01 | Send escalation email via drafted version | 🟡 Drafted, check send status |
| INSIDER-02 | Follow up via US customer service number | 🔴 |
| INSIDER-03 | Document as content angle — "LEGO Insider India broken" piece | 🟡 Optional — if resolution takes too long, this becomes a news angle |

---

## Legend

- ✅ Done
- 🟡 In progress / partial
- 🔴 Not started / blocked

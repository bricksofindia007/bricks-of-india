# BOI Master Tracker

> **Purpose:** One-page index of phase status, blockers, and deadlines. Task-level detail lives in the four sub-trackers below.
>
> **Last updated:** 2026-04-24 (post-audit)
> **Audit log:** `audit-block1.log`

---

## Sub-trackers

| Tracker | Scope | File |
|---------|-------|------|
| Web | Infra, site integrity, scrapers, GEO, deploys, WEB-01→04 pipeline, PULSE-01→N | `BOI_WEB_TRACKER.md` |
| Content | RSS pipeline, article ops, morning brief, Voice Codex | `BOI_CONTENT_TRACKER.md` |
| Video | YouTube long-form, Shorts, DaVinci, ElevenLabs, script-to-video flow | `BOI_VIDEO_TRACKER.md` |
| Social | Instagram engine, cross-posting, LAN RLFM runway | `BOI_SOCIAL_TRACKER.md` |

---

## Phase status

| Phase | Name | Status | Tracker |
|-------|------|--------|---------|
| Phase 0 | Launch + post-launch P0 fixes | ✅ Done | WEB |
| Phase 1 | Voice Codex | 🔴 Not started | CONTENT |
| Phase 2 | Claude Project workbench | 🔴 Blocked on Phase 1 | CONTENT |
| Phase 3 | Topical Radar (RSS ingestion) | 🔴 Not started | CONTENT |
| Phase 4 | Shorts / Reels workflow (DaVinci + ElevenLabs) | 🔴 Not started | VIDEO |
| Phase 5 | Instagram carousel engine | 🔴 Not started | SOCIAL |
| Phase 8 | LEGO Search Pulse | 🟡 Prototypes done, integration pending | WEB (PULSE-01→N) |

---

## Infrastructure status

| Item | Status | Evidence |
|------|--------|----------|
| Netlify → GitHub Actions migration | ✅ Done | Commit `8992aef` + `.github/workflows/deploy.yml` |
| Scraper workflow on GitHub Actions | ✅ Running | `scrape-prices.yml` + 492 rows scraped today |
| GEO/AI readiness (llms.txt, sitemap, JSON-LD) | ✅ Live | All 200, schemas present |
| Supabase (store_prices, price_history) | ✅ Healthy | 492 current rows, 9,142 historical |
| Site integrity | 🟡 One known 404 | `/sets` needs fix |

---

## Current blockers (top 3)

1. **Voice Codex not started** — blocks WEB-01→04 lint gate pipeline, blocks Phase 2 Claude Project workbench, blocks all content automation.
2. **`/sets` route returns 404** — live site bug, needs fix.
3. **Review + Product JSON-LD missing** on `/reviews` and `/sets` — GEO regression from Deploy 2.

---

## Deadlines

| Date | Item | Status |
|------|------|--------|
| ~~Pre-May 11, 2026~~ | ~~Netlify quota exhaustion~~ | ✅ Neutralised — off Netlify builds |
| TBD | Voice Codex v1 | Not scheduled |
| TBD | Article pipeline (WEB-01→04) v1 | Blocked on Codex |
| TBD | PULSE-01 data layer | Not scheduled |

---

## Recent deploys

| Deploy | Date | Commit | Contents |
|--------|------|--------|----------|
| P0 batch 2 | 2026-04 | `d2b7339` | CopyLinkButton → Client Component (news fix root cause) |
| P0 batch 1 | 2026-04 | `70a9eb0` | /search redirect, /themes hub, SetCard price count |
| GHA canary | 2026-04 | `7be1205` | Verify GHA auto-deploy pipeline |
| INFRA-03 | 2026-04 | `8992aef` | Production build migrated to GitHub Actions |
| Deploy 2 | 2026-04 | `9476d03`, `896d8ba`, `24e3b21` | GEO/AI readiness, E-E-A-T, /about |
| Visual overhaul | 2026-04 | `8fde610`, `d8646c7` | Tricolour brand, header/footer, hero |

---

## Legend

- ✅ Done
- 🟡 In progress / partial
- 🔴 Not started / blocked
- ⚠️ Issue found, needs fix

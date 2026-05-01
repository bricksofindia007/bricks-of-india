# BOI Master Tracker

> **Purpose:** One-page index of phase status, blockers, and deadlines. Task-level detail lives in the four sub-trackers below.
>
> **Last updated:** 2026-05-01 (LAB-01 live; CONTENT-01 closed; ROBOTS-01 done — GEO-02 + robots.txt aligned)
> **Audit log:** `audit-block1.log`

---

## Auto-update protocol

**Source of truth hierarchy:** `BOI_MASTER_TRACKER.md` is the canonical source of truth.
`admin/dashboard.html` is a rendered view of the tracker. If the two ever conflict,
the tracker wins and the dashboard must be reconciled to match.

**Atomic update rule:** Any change to project state — bug closed, fix deployed, pipeline
status moved, audit run, KPI changed, new tool added, cadence modified — MUST update
both files in the same commit. Never one without the other.

**Triggering events that require dashboard update:**
1. A bug is closed (update `issues[].status` → `closed`, set `deployedOn`)
2. A new bug is filed (add to `issues[]` with next BUG-NNN ID)
3. A pipeline item changes status (update `pipeline[].status`)
4. A new pipeline item is created (add to `pipeline[]`)
5. A dependency is satisfied (update `pipeline[].depsBlock` and re-evaluate `blocked` items)
6. A deploy happens (update `kpis.lastDeployDate`, recompute `daysSinceLastDeploy`)
7. Netlify minutes change materially (update `kpis.netlifyMinutesLeft`)
8. An audit is run (update `kpis.lastAuditDate`, `kpis.nextAuditDate`, and relevant
   `auditChecklist[].items[].status`)
9. A new tool/API is integrated (add to `stack[]`)
10. A cron schedule is added or changed (update `cadence[]`)
11. The GEO score is re-measured (update `kpis.geoScore`)
12. The voice test resolves (update `kpis.voiceTestStatus`)

**Workflow at task end:**
Before declaring any task complete, run this checklist:
- [ ] Did this task close a bug? → update `issues[]` in dashboard
- [ ] Did this task move a pipeline item? → update `pipeline[]` in dashboard
- [ ] Did this task deploy code? → update `kpis.lastDeployDate`
- [ ] Did this task change anything in the tracker's "Top of mind" section? → reconcile
- [ ] Run JSON validation on the dashboard
- [ ] Stage both files together: `git add BOI_MASTER_TRACKER.md admin/dashboard.html`
- [ ] Commit with a message that names what changed

**Health score recomputation:**
After any update, recompute `kpis.healthScore` (0–100) using this rough formula:
- Start at 100
- Subtract 20 per open P0 issue
- Subtract 10 per open P1 issue
- Subtract 5 if Netlify minutes < 100
- Subtract 5 if last audit > 30 days ago or never run
- Subtract 5 if voice test still pending after 14 days
- Subtract 5 if GEO score < 50
- Subtract 5 if any blocked pipeline item is P0 or P1
- Floor at 0, ceiling at 100
Then update `kpis.healthScoreNote` to a one-line summary of the dominant factor.

**Session start:**
At the start of every session, after reading the tracker, also verify the dashboard
JSON parses. If it doesn't, fix before doing anything else.

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
| Phase 1 | Voice Codex | ✅ Done — `docs/codex/BOI_Codex_v2.docx` committed 2026-05-01 | CONTENT |
| Phase 2 | Claude Project workbench | 🟡 Unblocked — pending setup | CONTENT |
| Phase 3 | Topical Radar (RSS ingestion) | 🔴 Not started | CONTENT |
| Phase 4 | Shorts / Reels workflow (DaVinci + ElevenLabs) | 🔴 Not started | VIDEO |
| Phase 5 | Instagram carousel engine | 🔴 Not started | SOCIAL |
| Phase 8 | LEGO Search Pulse | 🟡 Prototypes done, integration pending | WEB (PULSE-01→N) |

---

## Infrastructure status

| Item | Status | Evidence |
|------|--------|----------|
| DNS authority | ✅ Confirmed | Cloudflare (kira.ns.cloudflare.com, yadiel.ns.cloudflare.com). Origin: Netlify. Email MX: ImprovMX (unchanged). |
| Netlify → GitHub Actions migration | ✅ Done | Commit `8992aef` + `.github/workflows/deploy.yml` |
| Scraper workflow on GitHub Actions | ✅ Running | `scrape-prices.yml` + 492 rows scraped today |
| GEO/AI readiness (llms.txt, sitemap, JSON-LD) | ✅ Live | All 200, schemas present |
| AI crawler policy (GEO-02 + ROBOTS-01) | ✅ Done 2026-05-01 | Cloudflare AI Crawl Control WAF (GEO-02, manual) + `src/app/robots.ts` declared policy (ROBOTS-01, commit `e1054e1`) now aligned. 9 crawlers allowed (referral-traffic); 13 blocked (training-only). |
| Supabase (store_prices, price_history) | ✅ Healthy | 492 current rows, 9,142 historical |
| Site integrity | ✅ All 200 | `/sets` fixed (SETS-01, commit `20474c2`). All core pages healthy. |
| Catalogue sync (sets table) | ✅ Scheduled | `sync-catalogue.yml` weekly Sun 02:00 UTC. ~26k Rebrickable entries → ~10k unique rows after dedup. 16,888 rows, 99.4% image coverage. Assertion threshold: ≥ 8,000 rows. |
| Voice Codex | ✅ Done 2026-05-01 | `docs/codex/BOI_Codex_v2.docx` (commit `3190596`). 21 pages, Section 1 + 2. India Paragraph spec Page 12, verdict enum Page 13, lint gate spec Page 20. Unblocks CONTENT-02, RADAR-01, WEB-01. |
| CATALOG-FIX-01 v2 | ✅ Done 2026-04-26 | PR `fix/catalog-search`, merge commit `d19625d`. Restores Rebrickable-first search, theme ilike fix, audit + sync crons, DATA_SOURCES.md. Verified live: Concorde search ✓, Star Wars browse ✓, price filter ✓. |

---

## Current blockers (top 3)

1. **BUG-013 / GEO-01 (P0)** — JSON-LD schemas still client-side; entire GEO/AI investment invisible to non-JS crawlers. Unblocks RLFM-01.
2. **Review + Product JSON-LD missing** on `/reviews` and `/sets` — GEO regression from Deploy 2.
3. **DATA-01 open** — `store_prices` (scraper writes) ↔ `prices` (frontend reads) disconnected; live scraper data not reaching `/compare`.

## Carry-overs

| ID | Task | Status | Notes |
|----|------|--------|-------|
| CATALOG-04 v2 | USD MSRP ingest from Brickset + INR derivation | 🔴 Not fired | Brief at `briefs/CATALOG-04-v2.md`. Next in queue after this tracker update. |
| CATALOG-05 | Theme backfill — older sets missing from theme pages | 🔴 Not started | Depends on full sync completing all 27 pages (Rebrickable daily quota currently limits one-shot runs). |
| DATA-01 | Reconcile `store_prices` (scraper) ↔ `prices` (frontend) | 🔴 Not started | Tracked in `BOI_WEB_TRACKER.md` Section H. 2–3 hours. Schedule after CATALOG-04. |

---

## THE LAB — 1 of 6 live

Experimental features. Each ships as a standalone page under `/lab/`. Brief files live in `briefs/`.

| ID | Name | Status | Depends on | Brief |
|----|------|--------|------------|-------|
| LAB-01 | Biryani Index | ✅ Live | — | `briefs/LAB-01-biryani-index.md` |
| LAB-02 | Which Set Are You? (quiz) | 🔴 Not fired | LAB-01 | `briefs/LAB-02-which-set-quiz.md` |
| LAB-03 | Daily price snapshot cron | 🔴 Not fired | — | `briefs/LAB-03-price-snapshot-cron.md` |
| LAB-04 | Lab homepage strip + nav + /lab directory | 🔴 Not fired | LAB-01, ideally LAB-02 | `briefs/LAB-04-homepage-strip.md` |
| LAB-05 | Price Drop Board | 🔴 Deferred | LAB-03 + 30 days of snapshot data | — |
| LAB-06 | Retirement Radar | 🔴 Deferred | CATALOG-04 v2 (Brickset cron) | — |
| LAB-07 | LEGO Heat Map | 🔴 Deferred | Google Trends API integration | — |
| LAB-08 | Brick Portfolio | 🔴 Deferred indefinitely | Auth strategy decision | — |

**Decisions made:**

- **User accounts — DEFERRED.** 5 of 6 Lab tools require no auth. Only Portfolio (LAB-08) needs it. Email capture also deferred — DPDP Act compliance overhead not justified without proven editorial cadence for a list. Revisit when LAB-08 is being scoped.

---

## Deadlines

| Date | Item | Status |
|------|------|--------|
| ~~Pre-May 11, 2026~~ | ~~Netlify quota exhaustion~~ | ✅ Neutralised — off Netlify builds |
| ~~2026-05-01~~ | ~~Voice Codex v1~~ | ✅ Done — `docs/codex/BOI_Codex_v2.docx` |
| TBD | Article pipeline (WEB-01→04) v1 | Spec-ready — WEB-01 pending build |
| TBD | PULSE-01 data layer | Not scheduled |

---

## Recent deploys

| Deploy | Date | Commit | Contents |
|--------|------|--------|----------|
| ROBOTS-01 AI crawler policy | 2026-05-01 | `e1054e1` | `src/app/robots.ts` aligned with Cloudflare AI Crawl Control WAF — 9 allowed, 13 blocked |
| CONTENT-01 Voice Codex | 2026-05-01 | `3190596` | `docs/codex/BOI_Codex_v2.docx` committed — closes CONTENT-01, unblocks CONTENT-02 / RADAR-01 / WEB-01 |
| LAB-01 Biryani Index | 2026-05-01 | `be8f134` (merge) | `/lab/biryani-index` live — LEGO price → biryani/chai/petrol converter |
| CATALOG-FIX-01 v2 | 2026-04-26 | `d19625d` (merge) | Rebrickable-first search, theme filter fix, audit cron, DATA_SOURCES.md |
| P0 batch 2 | 2026-04 | `d2b7339` | CopyLinkButton → Client Component (news fix root cause) |
| P0 batch 1 | 2026-04 | `70a9eb0` | /search redirect, /themes hub, SetCard price count |
| GHA canary | 2026-04 | `7be1205` | Verify GHA auto-deploy pipeline |
| INFRA-03 | 2026-04 | `8992aef` | Production build migrated to GitHub Actions |
| Deploy 2 | 2026-04 | `9476d03`, `896d8ba`, `24e3b21` | GEO/AI readiness, E-E-A-T, /about |
| Visual overhaul | 2026-04 | `8fde610`, `d8646c7` | Tricolour brand, header/footer, hero |

---

## Sprint changelog

### Day 1 — 2026-05-01

Shipped:
- LAB-01 (Biryani Index) live at /lab/biryani-index
- CONTENT-01 — Voice Codex committed at docs/codex/BOI_Codex_v2.docx,
  with markdown export at .md and Node.js regeneration script at
  scripts/export-codex-md.js
- GEO-02 (manual) — Cloudflare AI Crawler per-crawler allow/block
  policy live at WAF; allows OAI-SearchBot, PerplexityBot,
  Claude-SearchBot, ChatGPT-User, Perplexity-User, Claude-User,
  MistralAI-User, DuckAssistBot, Manus Bot, Meta-ExternalFetcher,
  Applebot, BingBot, Googlebot, archive.org_bot, Cloudflare Crawler,
  Terracotta Bot; blocks GPTBot, ClaudeBot, CCBot, Bytespider,
  TikTok Spider, Meta-ExternalAgent, FacebookBot, Google-CloudVertexBot,
  Amazonbot, PetalBot, Novellum AI Crawl, ProRataInc, Timpibot,
  Anchor Browser
- ROBOTS-01 — app/robots.ts updated to match Cloudflare WAF policy;
  production robots.txt verified at bricksofindia.com/robots.txt
- Cloudflare 2FA enabled with recovery codes saved
- Cloudflare Leaked Credentials Mitigation activated
- Stale branches cleaned: feat/lab-biryani-index, fix/p0-batch-1,
  fix/catalog-search

Unblocked:
- CONTENT-02 (Claude Project workbench) — Codex now committed
- RADAR-01 (Topical Radar daily cron) — Codex now committed
- WEB-01 (4 lint gates) — spec sourced from Codex Page 20

Closed tickets:
- BLOG-RECON-01 — closed by Brief decision (news = curated, blog =
  long-form, reviews = set reviews)

Health score: 55 → 64 (+9)

Commits (7):
- be8f134 LAB-01 merge
- a9f94d5 LAB-01 tracker update
- 3190596 Codex commit (CONTENT-01)
- 28a1a4d CONTENT-01 tracker update
- e1054e1 ROBOTS-01 robots.ts update
- 77ff3d9 Codex export script
- 4dc5975 ROBOTS-01 tracker update

### Day 2 plan — 2026-05-02

Critical path (P0):
- GEO-01 — server-side JSON-LD migration (BUG-013 fix). Migrate
  SchemaLD.tsx from client-rendered to server-emitted via
  generateMetadata() or layout-level injection. Deploy. Verify
  schemas in initial HTML response via curl.

Day 2 secondary (P1):
- CF-CACHE-01 — diagnose 2.31% Cloudflare cache rate. Likely
  causes: missing Cache Rules, Cache-Control headers from Next.js
  preventing edge caching. Add Cache Rule for /_next/static/*,
  /images/*, fonts. Target: cache rate >40% within 24 hours.
- LAB-03 — start daily price snapshot cron. Silent accumulation
  begins; LAB-05 launch eligibility = day 2 + 30 = 2026-06-01.

Day 2 stretch (only if P0+P1 land before EOD):
- CONTENT-02 brief — write Claude Project workbench spec
- WEB-01 lint gate scaffold — start the 4 gates (word count,
  India Paragraph, verdict enum, image 200s)

---

## Legend

- ✅ Done
- 🟡 In progress / partial
- 🔴 Not started / blocked
- ⚠️ Issue found, needs fix

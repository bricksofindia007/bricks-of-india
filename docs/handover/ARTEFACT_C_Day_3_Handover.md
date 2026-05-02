# BOI Day 3 Handover
**For:** Next Claude session (strategic chat or Claude Code terminal)
**Date written:** 2026-05-02
**Date valid through:** 2026-05-09 (one week; refresh after that)

---

## Read this in order
1. **This doc** (5 minutes) — orientation, what's open, what to brief next
2. **ARTEFACT_A_Sprint_Reality_Audit.md** (10 minutes) — receipts, file evidence, realistic re-assessment
3. **BOI_MASTER_TRACKER.md** (skim) — canonical state, refreshed 2026-05-02
4. **CLAUDE.md** (1 minute) — operational rules, all 6 of them

Sub-trackers (Web, Content, Video, Social) are now current as of 2026-05-02 (TRACK-HYGIENE-01 commit). Read whichever is relevant to the current task; otherwise the master tracker is enough.

---

## What's true on 2026-05-02

### The sprint shipped its biggest items
- Voice Codex v2 — done, 21 pages, locked verdict vocab + India Paragraph spec + length rules
- GEO-01 server-side JSON-LD — claimed shipped (verification pending)
- Catalogue + search fix — merged 2026-04-26 (commit `d19625d`), 16,888 rows, 99.4% image coverage
- INFRA-03 GitHub Actions deploy — live, scrapers 3×/day at 100% success
- LAB-01 Biryani Index — live at /lab/biryani-index
- Markdown rendering fix on /news — shipped
- Sitemap dynamic — live at /sitemap.xml
- GA4 wired — live via gtag in src/app/layout.tsx

### The sprint accumulated debt
- Three sub-trackers went 8 days stale before TRACK-HYGIENE-01 fixed them
- Three of four LAB briefs (LAB-02, LAB-03, LAB-04) on disk but not fired
- One brief is missing entirely: `briefs/CATALOG-04-v2.md`
- PULSE prototype HTML files claimed Done but absent from working tree
- `/lab` returns 404 — no index page exists
- `next.config.mjs` has no Cache-Control headers (root cause of 2.3% Cloudflare cache rate)
- WEB-01 lint gates spec'd but not implemented
- `reviews` table is empty — blocks GEO-01-FU1 and weakens RLFM application

### Two manual checks still pending
- Cloudflare 2FA status
- SSL/TLS encryption mode (needs to be Full or Full Strict)

These are in Cloudflare dashboard, not code. Abhinav owns them.

---

## What to brief next (in priority order)

### Priority 1 — Time-sensitive

**LAB-03: Price snapshot cron**
- Brief on disk: `briefs/LAB-03-price-snapshot-cron.md` (10 KB, ready to fire)
- Why now: every day delayed pushes LAB-05 (Price Drop Board) launch. The cron needs runway to accumulate snapshot history before the board has anything to render.
- Brief Claude Code to implement straight from the existing brief. No additional spec needed.

**CF-CACHE-01: Cloudflare cache rate fix**
- Root cause confirmed: no Cache-Control headers in `next.config.mjs`
- Fix scope: one PR, add `Cache-Control: public, s-maxage=...` headers per route type in the `headers()` function
- Suggested values: `/sets/*` long (3600+), `/news` and `/blog` listings short (300), `/admin/*` no-store, `/sitemap.xml` medium
- After deploy, verify hit rate climbs in Cloudflare analytics over 24h
- Cheap, visible, helps Indian users immediately

### Priority 2 — Unblocks downstream work

**REVIEWS-FIRST-3: Write 3 reviews**
- Status: 🔴 Not started
- Why it matters: unblocks GEO-01-FU1 (cannot verify `/reviews/[slug]` JSON-LD with empty table) and strengthens RLFM differentiation story
- Codex is ready, format is locked (500–700 words, "Worth ₹X in India?" title format, locked verdict)
- Pick 3 sets from the catalogue with stable INR pricing on Toycra/MyBrickHouse. Suggest Abhinav nominates the 3, then either CONTENT-02 (Claude Project workbench) or this chat drafts.

**WEB-01: Four lint gates in CI**
- Spec: Codex Page 20 (in `docs/codex/BOI_Codex_v2.md`)
- Required gates: word count, India Paragraph presence, verdict enum match, image 200 check
- Currently `.eslintrc.json` is baseline only
- This is the silent critical path: RADAR-01 cannot ship without it. Without RADAR-01, all content publishing remains manual.
- Brief Claude Code with reference to Codex Page 20

**CONTENT-02: Claude Project workbench**
- Status: 🟡 Unblocked, ~30 minutes manual setup in Claude.ai
- Codex is done, so the workbench can be loaded with locked rules
- This is a manual task for Abhinav, not a Claude Code task
- Once done, every review draft starts from a Codex-aware project

### Priority 3 — Routine cleanup

**LAB-04: /lab index page + homepage strip**
- Brief on disk: `briefs/LAB-04-homepage-strip.md` (13 KB)
- Fire after LAB-03 has at least 1 day of snapshot data
- Side benefit: fixes the `/lab` 404 by giving the route an index

**GEO-01 verification**
- `curl https://bricksofindia.com/sets/<slug>` and grep for `<script type="application/ld+json">` in the rendered HTML, not in the React tree
- Repeat for /news/[slug], /blog/[slug]
- If JSON-LD appears in HTML at request time, GEO-01 is genuinely shipped. If still client-rendered, reopen.

**ROBOTS-01 verification**
- `curl https://bricksofindia.com/robots.txt`
- Confirm: ClaudeBot, GPTBot, PerplexityBot, GoogleBot, BingBot all allowed
- Confirm sitemap reference present

**CATALOG-04 v2 brief decision**
- Either rewrite `briefs/CATALOG-04-v2.md` properly, or remove the reference from the master tracker
- Placeholder file `briefs/CATALOG-04-v2-PLACEHOLDER.md` exists to flag the gap
- Pull Abhinav into this — the source data decision (Brickset, set_prices table, v_set_current_price view) is documented but the implementation brief is missing

**PULSE prototype files**
- Ask Abhinav: do `bricks-globe-preview.html` and `lego-search-pulse.html` exist on his local machine?
- If yes: commit them
- If no: change WEB tracker Section E status from 🟡 to 🔴 and note the work as lost

### Priority 4 — Defer

- **LAB-02 quiz** — fun, low urgency, fire after LAB-04
- **VOICE-01 ElevenLabs** — decision-only, free-tier test still pending; not blocking shipping
- **BRIEF-01 morning email** — nice-to-have, no infra in repo
- **DATA-01 reconcile** — technical debt, no current pain
- **LAB-05 onwards** — gated on LAB-03 runway

---

## Operating rules for new-Claude

These come from CLAUDE.md and are non-negotiable:

1. **Read `BOI_MASTER_TRACKER.md` via `cat` at start of every terminal session.** It is canonical. Memory is not.
2. **Sub-trackers are detail views, not source of truth.** Master wins ties.
3. **No auto-merges on PRs.** Abhinav reviews before push.
4. **Brief files live in `briefs/`.** Always check there before scoping new work.
5. **Data sources runbook is `DATA_SOURCES.md`** (9 KB, current as of 2026-04-26). Reference for any scraper/API question.
6. **Next.js middleware pattern is documented in CLAUDE.md.** Don't reinvent.
7. **Git staging discipline:** stage only the files relevant to the current commit. No `git add .` shortcuts.

---

## Voice and content rules (locked)

These are from Voice Codex v2 — apply to every piece of content, every script, every Instagram caption.

- **Voice:** Jeremy Clarkson meets Indian wallet anxiety. Dry, witty, self-deprecating, never mean.
- **Opener:** "lets gooooo" (lowercase, four o's)
- **Sign-offs:** "On that bombshell…" for opinion pieces. "Bubyee" for YouTube.
- **India Paragraph mandatory:** INR price (MSRP × 1.35 × USD/INR), stores, 4–6 week India lag, relatable comparison (e.g. ₹6,499 = "11kg mangoes or 4 months Spotify Premium"), EMI references for expensive sets.
- **Wallet is always a character.** Daughter-as-foil pattern in 6/16 reference scripts.
- **Verdict vocabulary (strict):** BUY / WAIT FOR SALE / IMPORT ONLY / SKIP — plus prose amplification.
- **Length budgets:** news 300–400 words, reviews 500–700, opinion 400–500, weekly digest 350–400.
- **Title formulas:** news titles include set number + "India". Review titles always "Worth ₹X in India?".
- **Never:** start with "LEGO has announced…", summarise other sites, pad with adjectives when a number works, explain the joke.

---

## Stack reference (one-liner)

Next.js App Router → Supabase (Postgres) → GitHub Actions (cron + deploy) → Netlify (hosting) → Cloudflare (DNS + proxy, Mumbai BOM edge). Rebrickable + Brickset APIs. Brand palette: saffron #F7A800, blue #006CB7, dark navy #0F2D6B. Fonts: Fredoka + Inter. GA4 wired.

---

## RLFM application timeline (reminder)

Target submission: August 2026. Today: 2026-05-02. **~13 weeks runway.**

What strengthens the application between now and then:
- Reviews ≥ 3 (currently 0)
- Visible publishing cadence (currently 39 pieces ≈ 4 weeks, then unclear)
- YouTube subscriber growth toward 500+ (currently <500)
- LEGO Insiders zero-points issue resolved or escalated (open credibility concern)
- Multi-platform consistency in voice (Codex enforces this — once cron + lint gates ship)

What doesn't matter for the application:
- LAB feature completion beyond LAB-01/LAB-04 (nice-to-have, not differentiation)
- ElevenLabs voice cloning (irrelevant to RLFM)
- Cloudflare cache rate (irrelevant to RLFM)

---

## Things new-Claude should not do

- Don't propose rewriting the master tracker. It is current and correct.
- Don't propose new LAB features. LAB-02 through LAB-08 already exist as planned items; ship the ones that have briefs first.
- Don't propose changing the voice. Codex v2 is locked.
- Don't propose adding analytics tools. GA4 is enough until there's a specific question GA4 can't answer.
- Don't propose new content categories. News, blog, reviews, weekly digest. That's the menu.
- Don't propose new platforms. YouTube + Instagram + website. RLFM track record needs depth on existing platforms before width on new ones.
- Don't volunteer to do the manual Cloudflare checks (2FA, SSL/TLS mode). Those need Abhinav in the dashboard.

---

## Open questions for Abhinav (when this comes up next)

1. Do the PULSE prototype HTML files exist locally? If yes, commit. If no, downgrade tracker.
2. CATALOG-04 v2 brief: rewrite or remove reference?
3. Which 3 sets get reviewed first to unblock GEO-01-FU1 and strengthen RLFM?
4. Has Cloudflare 2FA been enabled? SSL/TLS mode confirmed Full or Full Strict?
5. ElevenLabs free-tier test: still on the list, or dropped?
6. LEGO Insiders zero-points issue: any update from LEGO support?

---

## Status one-liner for any external comms

> Bricks of India: India's first LEGO price comparison and catalogue platform. Live since April 2026. 16,888 sets, 39 articles published, voice and content rules locked. Building toward RLFM application August 2026.

---

**Document author:** Claude (strategic chat layer)
**Companion docs:** ARTEFACT_A_Sprint_Reality_Audit.md, ARTEFACT_B_Tracker_Hygiene_Brief.md
**Next handover refresh:** 2026-05-09 or after next major shipment, whichever comes first

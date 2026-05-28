# Day 29 Ground Truth — 2026-05-29

## Health Score: 95
GEO score < 50 is the sole drag (-5). CQS v2 running daily and auto-fixing. Content quality system built and first run complete. 38 news articles live (was 26). CE-01 outreach done. Voice test passed (12 articles published).

## HEAD Commit: aa23579
Content Quality System v2: detect → auto-fix → verify → report loop
Branch: main. In sync with origin after Day 29 close push.

## All Pipelines: Green
radar.yml (RADAR-01→03): daily 23:00 IST ✅
social-automation: daily 12:00 IST ✅
scrape-prices.yml: every 6h ✅
price-snapshot (LAB-03): daily 08:30 IST ✅
sync-catalogue.yml: weekly Sunday 02:00 UTC ✅
catalogue-audit.yml: weekly Monday 03:30 UTC ✅
health-check.yml: daily 08:00 IST (11 checks) ✅
technical-hygiene.yml: weekly Monday 04:00 UTC ✅
brief.yml: daily 01:30 UTC (07:00 IST) ✅
retiring-soon.yml: weekly Sunday 02:00 UTC ✅
content-quality.yml: daily 03:00 UTC (08:30 IST) ✅ NEW — LIVE

---

## Session Start Protocol (Day 30)
1. `cat BOI_MASTER_TRACKER.md`
2. Read this file
3. Check BRIEF-01 email arrived at 07:00 IST
4. **Gemini quota resets at midnight Pacific (~12:30 IST).**
   Run generate + publish first thing:
   ```
   node --env-file=.env.local scripts/generate-approved-drafts.js --limit 15
   node --env-file=.env.local scripts/publish-drafts.mjs --limit 15
   ```
   Target: /news to 50+ articles (currently 38, need 12+ more)
5. Review CQS v2 email report (sent ~08:30 IST daily) before any batch publish
6. CE-01 DONE — responses may arrive in inbox; check for interested builders

---

## Completed This Session (Day 29)

### Content
- 12 articles published via publish-drafts.mjs ✅ — /news: 26 → 38 articles
- 69 content issues fixed (bold markdown, forbidden words, bad openers, missing verdicts, image gaps/duplicates) via fix-content-issues.mjs
- Images: 13 missing-image articles assigned unique Brickset images; 6 duplicate image groups broken up
- CE-01 outreach: posted r/IndiaLEGO + AFOL India Facebook ✅ (DEADLINE MET)

### Infrastructure
- **Content Quality System v2** (commit aa23579):
  - `scripts/content-linter.mjs`: 30+ checks, writes auto_fixable flag per issue
  - `scripts/content-auto-fixer.mjs`: 11 mechanical fix types, 20% body-length safety guard
  - `scripts/visual-renderer.mjs`: 14 Playwright checks at desktop (1280×800) + mobile (375×812)
  - `scripts/content-verify.mjs`: re-runs checks on auto-fixed articles, escalates failures to manual
  - `scripts/content-quality-report.mjs`: 6-section HTML email (BOI palette)
  - `.github/workflows/content-quality.yml`: linter → fixer → renderer → verify → reporter, daily 03:00 UTC
  - `supabase/migrations/20260529000000_content_quality_system_v2.sql`: content_quality_issues gains auto_fixable + fix_detail; new tables content_image_registry + content_fix_log
- `scripts/publish-drafts.mjs` (commit 8e30fcc): batch publishing terminal script
- `scripts/fix-content-issues.mjs` (commit 7c0a8ab): one-shot bulk content remediation (done — can archive)
- `technical-hygiene.mjs`: added `/opinion/certified-store-india-charges-too-much` to route checks

### First CQS v2 Run Results (2026-05-29)
- 58 articles checked (38 news, 8 opinion, 3 reviews, 9 guides)
- Issues before auto-fix: 86 (26 critical, 20 warning, 40 info)
- Auto-fixable: 3 → 2 applied (double_space + markdown_list) → 3 verified clean
- Issues remaining (real): 12 critical (missing verdict/india paragraph for community content + missing_signoff widespread)
- False positives closed: 14 (9 guides missing_image — guides use featured_image_url; 2 YouTube maxresdefault placeholder; 1 broken_image fixed; 2 placeholder_image)
- Email sent: Resend ID 26c25d6a

---

## P0 — FIRST THING TOMORROW (Day 30)

### 1. Generate + Publish next batch
Gemini quota reset (midnight Pacific / ~12:30 IST).
```bash
node --env-file=.env.local scripts/generate-approved-drafts.js --limit 15
```
Then spot-check one at /admin/pending, then:
```bash
node --env-file=.env.local scripts/publish-drafts.mjs --limit 15
```
Target: /news to 50+ (need 12+ articles from 38).
~274 approved drafts awaiting bodies.

### 2. Review CQS email report
Daily report arrives ~08:30 IST. Review before publishing.
Look for: new critical issues, auto-fix results, broken images.

---

## P1 — THIS WEEK

- /news to 50+ articles (batch generate + publish)
- Publish 10 RADAR-08 review drafts
- Visual renderer first live run: `node --env-file=.env.local scripts/visual-renderer.mjs`
- Re-add pending_drafts verdict constraint:
  ```sql
  ALTER TABLE pending_drafts ADD CONSTRAINT pending_drafts_draft_verdict_check
  CHECK (draft_verdict IN ('BUY NOW', 'WAIT', 'IMPORT ONLY', 'AVOID')) NOT VALID;
  ```
- CE-01 follow-up: check inbox for interested builders, DM responses on Reddit/FB

---

## Known Open Content Issues (real, not false positive)
- missing_verdict (8): community content articles with null verdict — by design
- missing_india_paragraph (6): community content + 5 legacy news articles without ₹
- missing_signoff widespread: "On that bombshell" — legacy articles don't have it. Consider dropping or making linter check optional for non-pipeline articles.
- word_count (41 info-level): not urgent

---

## Database State (2026-05-29)

| Table | Count | Notes |
|-------|-------|-------|
| sets | 24,559 | lego_mrp_inr: 45% (3,405/7,547 ≥2020) |
| sets.retirement_date | 3,039 | |
| sets.is_retiring_soon | 128 | |
| sets.retired | 2,202 | |
| store_prices | ~1,955 | |
| price_snapshots | 20,820+ | |
| news_articles | 38 | +12 published today |
| reviews | 3 | + 10 RADAR-08 drafts queued |
| blog_posts | 22 | 3 opinion + 19 legacy |
| pending_drafts (approved) | ~258 | Awaiting body generation |
| guides | 9 | |
| community_spotlights | 0 | CE-01 outreach sent — waiting for respondents |
| newsletter_subscribers | 1 | |
| content_quality_issues | 130 open | First CQS v2 run |
| content_image_registry | 49 rows | First run |
| content_fix_log | 2 rows | double_space + markdown_list auto-fixed |

---

## Automated Pipelines (all green as of 2026-05-29)

| Pipeline | Schedule | Status |
|----------|----------|--------|
| RADAR fetch→dedupe→classify | Daily 23:00 IST | ✅ Green |
| RADAR-08 reviews seeder | Daily 23:00 IST | ✅ Green |
| Social automation IG+YT | Daily 12:00 IST | ✅ Green |
| Scrape store prices | Every 6h | ✅ Green |
| Price snapshot (LAB-03) | Daily 08:30 IST | ✅ Green |
| Catalogue sync | Weekly Sunday 02:00 UTC | ✅ Green |
| Catalogue audit | Weekly Monday 03:30 UTC | ✅ Green |
| health-check.yml | Daily 08:00 IST (11 checks) | ✅ Green |
| technical-hygiene.yml | Weekly Monday 04:00 UTC | ✅ Green |
| generate-drafts.yml | On-demand dispatch | Manual only |
| brief.yml | Daily 01:30 UTC (07:00 IST) | ✅ Green |
| retiring-soon.yml | Weekly Sunday 02:00 UTC | ✅ Green |
| content-quality.yml | Daily 03:00 UTC (08:30 IST) | ✅ Green — NEW, first run 2026-05-29 |

---

## Fan CoLab Status
Deadline: August 1 2026 (63 days)

| Item | Status | Notes |
|------|--------|-------|
| /guides route | ✅ DONE | WEB-05, Day 25 |
| 8 LEGO 101 guides | ✅ DONE | CE-02, Day 28 |
| History of LEGO in India | ✅ DONE | CE-05, Day 28 |
| /community route | ✅ DONE | WEB-06, Day 25 |
| 2 Builder Spotlights | 🟡 OUTREACH SENT | CE-01 done 2026-05-29. Awaiting responses. Publish target: July 15. |
| Daily social automation | ✅ DONE | SOC-AUTO-01, Day 24 |
| 3+ Codex reviews | ✅ DONE | 3 live |
| Price comparison | ✅ DONE | Live since launch |
| 24,559 set catalogue | ✅ DONE | |
| Brickset listing | ✅ DONE | BRICKSET-01, Day 28, Huw Millington |

**Critical path to August 1:** CE-01 outreach DONE → interviews (June) → write + publish 2 spotlights (July 15) → done.

---

## Token Expiry Calendar

| Token | Expires | Action by |
|-------|---------|-----------|
| IG Access Token | ~2026-07-23 | Re-exchange by **2026-07-16** (HARD DEADLINE) |
| GH_DISPATCH_TOKEN PAT | 2027-05-27 | — |
| YouTube OAuth | Permanent | — |

---

## Known Issues

| Issue | Priority | Notes |
|-------|----------|-------|
| Gemini daily quota | P0 tomorrow | Reset midnight Pacific. Run generate + publish first thing Day 30. |
| blog_posts 19 legacy uncategorised (not Opinion) | P3 | Cleanup deferred |
| lego_mrp_inr NULL ~55% of sets | P2 | populate-mrp.js ran; limited by sets without US retail price |
| Store coverage 5.8% of catalogue | P2 | |
| HOME-HERO-01 missing some viewports | P3 | |
| PROCESS-RLS-02 9 tables unaudited | P2 | |
| INSIDERS-01 zero points #811205769 | P3 | |
| BUG-04 DK books in /compare | P3 | |
| missing_signoff check | P2 | "On that bombshell" — consider making optional or dropping from linter for non-pipeline articles |
| pending_drafts verdict constraint | P2 | Re-add: `ALTER TABLE pending_drafts ADD CONSTRAINT pending_drafts_draft_verdict_check CHECK (draft_verdict IN ('BUY NOW', 'WAIT', 'IMPORT ONLY', 'AVOID')) NOT VALID;` |

---

## External Recognition
Brickset App Directory:
brickset.com/article/131478
Listed by Huw Millington 2026-05-28
Response: "It looks great."

---

## Voice Codex Summary
BOI voice = smart Indian LEGO fan talking to another Indian LEGO fan over chai.
India hook in Para 1. ₹ price + store name. India Paragraph with <!-- INDIA_PARAGRAPH --> marker.
Verdict: BUY NOW / WAIT / IMPORT ONLY / AVOID. No hedging.
Forbidden: pinnacle, testament, enthusiasts, marvel, folks, hefty, delve, utilize, stunning, whimsical, etc.
Bad openers: "So,", "Okay", "Alright,", "Let's talk"
Generator: Gemini 2.5 Flash-Lite
Prompt files:
  scripts/generate-approved-drafts.js
  src/lib/generate-body.ts

---

## Stores and Affiliates
Toycra: ABHINAV12 (12% off ₹500+)
MyBrickHouse: certified store, primary price reference
Jaiman Toys: at/near MRP
Price hierarchy: MBH → Toycra → Jaiman

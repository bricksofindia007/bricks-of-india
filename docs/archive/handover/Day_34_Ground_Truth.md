# Day 34 Ground Truth — 2026-06-02
_Session close. UTC: 2026-06-02 ~19:00_

## HEAD
1debd26 — feat: pieces Supabase fallback + real India price on stats card

## Commit log (on top of dda36c0 Day 33 close)

| Commit | What |
|--------|------|
| `caaff6e` | fix: Day 33 P0 fixes — homepage deals, editorial CDN images, hygiene checks |
| `2110dce` | fix: pass BRICKSET_API_KEY to technical-hygiene.yml env block |
| `916fe60` | fix: inject live store prices into creator/ideas India Paragraphs; fix Love Birds verdict |
| `c7725fd` | fix: CQS warning sweep — Jaiman removal, duplicate hero, missing signoffs |
| `a515533` | security: npm audit fix — axios 1.16.0, basic-ftp, ws, brace-expansion |
| `432b830` | fix: CQS cleanup tail — Jaiman in blog_posts, forbidden words, febrovery signoff |
| `da9d605` | fix: extend 7 short articles to 300w+, rewrite 2 bad openers, fix summer-fun verdict |
| `0262dc0` | feat: three hardening systems — pre-publish gate, CQS auto-fixer, secrets manifest |
| `0ad0411` | feat: schedule publish-drafts at 3x daily cadence (45 articles/day max) |
| `e7289af` | fix: posted_sets.created_at -> posted_at in hygiene Check 15i |
| `655a185` | fix: social automation — theme-as-number + India filter selection starvation |
| `1debd26` | feat: pieces Supabase fallback + real India price on stats card (HEAD) |

---

## What shipped

### P0 fixes

**Homepage deal cards** (src/app/page.tsx)
- getHomepageData() rewritten: store_prices-first (in_stock=true) → best price per set → 8 newest sets (year DESC). Replaced broken MRP-first query that never overlapped with live stock.
- createServerClient() used for store_prices (anon client blocked by RLS).

**Editorial CDN blocklist** (scripts/publish-drafts.mjs)
- EDITORIAL_CDN_BLOCKLIST: Squarespace, Brothers Brick, Flickr, JBB. OG image from blocked domain → Rebrickable fallback.
- 27 at-risk articles backfilled: 1 Rebrickable, 26 null (MOC content).
- publish-drafts.yml: REBRICKABLE_API_KEY confirmed in env block.

**BRICKSET_API_KEY in technical-hygiene.yml** — was in Secrets, never forwarded to step env. One-line fix.

**251 null draft_titles** — fix-null-draft-titles.mjs: bulk set draft_title = source_title. All 251 updated.

**NHM review verdict** — DB patch: "WAIT FOR SALE" to "WAIT".

### CQS content sweep

- Jaiman Toys removed: 25 news_articles + 1 blog_post (fix-cqs-warnings-day33.mjs + follow-up inline fix). Netherlands train exact slug: lego-world-netherlands-train-builders-connect-for-massive-di.
- 16 signoffs added.
- Duplicate hero fixed: lego-sets-destroy-wallet-2026 → 10366 Tropical Aquarium.
- Forbidden words: testament → proof of (weapon-wednesday), whimsical → creative (febrovery). Febrovery signoff added.
- India Paragraph fixes: creator-2026 (278w→355w, real prices), ideas-2026 (315w→372w, Amazon removed), love-birds (Toycra + ABHINAV12 added, VERDICT:BUY → Verdict: BUY NOW.), mybrickhouse-arrivals (Has INR: false → true).
- 7 short articles extended to 300w+ with substantive additions. 2 bad openers rewritten.
- summer-fun: verdict WAIT FOR SALE→WAIT, signoff fixed.
- 4 "not found" slugs confirmed in guides table (not missing, wrong table queried).
- Batch run: 11 published (news: 73→84), 4 Gate 2 resets.

### Three hardening systems (commit 0262dc0)

System 1 — pre-publish gate (scripts/publish-drafts.mjs):
- prePublishAutoFix(body): strips markdown, Jaiman, 16 forbidden word subs, injects ABHINAV12, appends signoff.
- cqsHardCheck(body): rejects script injection/leaked markers → reset to approved.

System 2 — CQS auto-fixer extension:
- content-auto-fixer.mjs: jaiman_reference, forbidden_word, missing_signoff fix types added.
- content-linter.mjs: all three now auto_fixable=true. jaiman_reference check added.

System 3 — secrets manifest:
- .github/secrets-manifest.json: 16 secrets x 15 workflows, 65 references.
- scripts/audit-secrets-manifest.mjs: Check A (required_by) + Check B (undeclared). Exits 1 on drift.
- code-audit.yml: secrets step added. code-audit-notify.mjs: SECRETS_OUTCOME added.

### Scheduled publish (commit 0ad0411)

Three cron triggers: 00:30 IST (19:00 UTC), 13:00 IST (07:30 UTC), 18:00 IST (12:30 UTC).
15/run x 3 = 45/day max. Independent from radar.yml. workflow_dispatch preserved.
19 approved-with-body drafts flipped to draft for tonight's 00:30 IST run.

### npm security (commit a515533)

axios 1.16.0 (14 CVEs). basic-ftp, ws, brace-expansion, follow-redirects, ip-address patched.
5 remaining require next@16 (isSemVerMajor) — deferred to Next.js migration sprint.

### Social automation (commits 655a185, 1debd26, e7289af)

Root cause of 2-day miss: is_available_in_india() excluded sets in store_prices. With 648 tracked sets, all real 2026 candidates excluded. June 1 run: 1m29s, 0 candidates.

Fix 1 — theme-as-number (social-automation/scraper.py:491): str(theme_id) → ''. Brickset merge fills name.
Fix 2 — India filter removed (lines 684-687): posted_sets dedup is the only gate now.
Fix 3 — pieces Supabase fallback (social-automation/db.py): get_pieces_from_supabase() as 4th-tier. sets.pieces = 100% populated.
Fix 4 — real India price on stats card (db.py + media_processor.py): get_india_price() queries store_prices. Shows real INR price instead of always ??. Font scales 90→78pt for long prices.
Hygiene fix (technical-hygiene.mjs line 1228): created_at → posted_at. False Monday alert fixed.

---

## DB state at close (2026-06-02)

| Table | Count | Notes |
|-------|-------|-------|
| news_articles | 84 | +11 from session |
| blog_posts | 22 | — |
| reviews | 3 | all BUY NOW |
| guides | 9 | hero null — gradient fallback OK |
| store_prices | 2,600 | — |
| pending_drafts | ~484 | approved: ~321, draft: 0, published: ~51, rejected: 4 |
| sets | 24,633 | pieces: 100% coverage |

---

## All Pipelines: Green

| Pipeline | Schedule | Status |
|----------|----------|--------|
| radar.yml | Daily 23:00 IST | OK |
| social-automation.yml | Daily 12:00 IST | OK — fixed today |
| scrape-prices.yml | Every 6h | OK |
| price-snapshot | Daily 08:30 IST | OK |
| sync-catalogue.yml | Weekly Sun 02:00 UTC | OK |
| catalogue-audit.yml | Weekly Mon 03:30 UTC | OK |
| health-check.yml | Daily 08:00 IST | OK |
| technical-hygiene.yml | Weekly Mon 04:00 UTC | OK — BRICKSET_API_KEY fixed |
| code-audit.yml | Weekly Mon 05:00 UTC | OK — + secrets audit step |
| brief.yml | Daily 07:00 IST | OK |
| retiring-soon.yml | Weekly Sun 02:00 UTC | OK |
| content-quality.yml | Daily 08:30 IST | OK |
| generate-drafts.yml | On-demand | Manual only |
| publish-drafts.yml | 3x daily + on-demand | OK — NEW schedule |

---

## Known acceptable state

- guides.featured_image_url: 9/9 null — gradient fallback renders correctly
- news_articles.hero_image: 3 null (MOC) + 26 null (editorial CDN backfill) — generic fallback acceptable
- sets.lego_mrp_inr: 86% null — 2020+ sets only
- Review-format pending_drafts (107): publish to news_articles by design
- 5 npm audit vulns: all require next@16 major jump — acceptable, deferred

---

## Session start protocol (Day 35)

1. cat BOI_MASTER_TRACKER.md + read this file
2. Check BRIEF-01 (07:00 IST) + CQS (08:30 IST) emails
3. gh run list --workflow=publish-drafts.yml --limit 5 — verify 00:30 IST run
4. gh run list --workflow=social-automation.yml --limit 3 — verify 12:00 IST run, check posted_sets
5. node --env-file=.env.local scripts/generate-approved-drafts.js --limit 15
6. CE-01 — check Reddit/FB inbox for Builder Spotlight respondents

## Hard deadlines

| Deadline | Item |
|----------|------|
| 2026-07-16 | IG System User Token re-exchange (expires 2026-07-23) |
| 2026-07-15 | CE-01 Builder Spotlight x2 published at /community |
| 2026-08-01 | LEGO Fan CoLab application submitted |

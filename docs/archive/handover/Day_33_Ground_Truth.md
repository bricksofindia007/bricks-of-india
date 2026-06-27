# Day 33 Ground Truth — 2026-05-31
**HEAD:** dda36c0  
**Health score:** 97 (+1 vs Day 32 open, GSC verification removed -5 GEO drag)  
**Session closed:** evening IST

---

## Content counts (end of day)
| Table | Count | Delta vs Day 32 open |
|---|---|---|
| news_articles | 73 | +20 |
| blog_posts | 22 | — |
| guides | 9 | — |
| reviews | 3 | — |
| pending_drafts (approved, awaiting generation) | 341 | +7 (resets) |
| pending_drafts (draft bodies ready, unpublished) | 66 | −24 published |
| pending_drafts (published via pipeline) | 52 | +17 |

Pipeline note: 24 drafts processed — 17 published, 7 reset to approved after gate failures.
66 draft bodies staged — run publish-drafts.mjs --limit 66 at Day 34 open, no generation needed.
341 approved awaiting generation — tonight's cron (23:00 IST) will pick up the 7 reset drafts
with new prompt (300-word floor + mandatory ₹ formula).

---

## Commits this session (9 commits)
| Hash | Description |
|---|---|
| 7577508 | feat: ItemList schema on themes/[theme] + Bingbot to robots.ts |
| 654f801 | fix: openGraph on reviews/[slug] and themes/[theme] |
| 8bbc9df | feat: FAQPage schema + article image + Hamleys cleanup |
| 6c9c23a | fix: authorSchema sameAs + article url in all content schemas |
| 1e839c5 | feat: FAQPage schema on sets/[slug] — dynamic per-set |
| 6894ff5 | docs: Day 32 addendum — GEO sprint complete |
| 21ebdcb | fix: visual renderer networkidle→domcontentloaded + Check 20 audit |
| 7e0aad1 | feat: sitemap — add /compare, /themes, /community |
| 4a0f5ac | fix: Gemini prompt — 300-word hard floor + mandatory ₹ formula |
| 6f8fbc7 | docs: Day 32 Ground Truth |
| dda36c0 | docs: tracker update — health 97, news 73, addendum 11 |

---

## What shipped today

### SEO/AEO/GEO — complete
- Schema coverage: 100% across all route types
- GSC verified + sitemap submitted (DNS TXT via Cloudflare)
- /compare, /themes, /community added to sitemap
- FAQPage schema: news + blog + sets/[slug] (~24,000 entries)
- Article schema: image + url + author.sameAs (E-E-A-T signals)
- themes/[theme]: CollectionPage schema (last gap closed)
- OG metadata: reviews + themes fixed
- Bingbot added to robots.ts
- Hamleys purged from all crawlable FAQ content

### Content pipeline fixes
- Gate 1: Gemini prompt hard floor 300 words (was soft 225)
- Gate 2: Mandatory ₹ formula — USD × 1.35 × live_rate, or IMPORT ONLY fallback
- 7 gate-failed drafts reset to approved for regeneration tonight
- Visual renderer: networkidle → domcontentloaded + 30s timeout (fixes CDN-heavy page failures)
- Sitemap completeness: /compare was missing — highest commercial-intent page, now included

### DEFECT-015 — Blog/Opinion duplication ✅ Closed (8e1dce2)
- 3 opinion articles were accessible at both /blog/[slug] and /opinion/[slug] with conflicting self-canonicals
- Fix: blog/[slug] queries now filter `.neq('category', 'Opinion')` — opinion slugs 404 from /blog/
- Structural fix: pipeline routing unchanged, category='Opinion' is always set on opinion inserts
- GSC will drop /blog duplicates on next crawl — no further action needed
- Safe to publish opinion articles from Day 34

---

## Day 34 opening sequence
1. `node --env-file=.env.local scripts/publish-drafts.mjs --limit 66` — 66 bodies staged, publish immediately
2. `node --env-file=.env.local scripts/generate-approved-drafts.js --limit 15` — chip at 341 approved queue
3. Confirm 7 reset drafts regenerated correctly (check word count + ₹ presence)

---

## P1 open items
| Ticket | Task | Notes |
|---|---|---|
| GEO-05b | Gemini prompt: auto-link set mentions in articles | Stops article→set gap growing. Every publish from here adds to the debt |
| GEO-04 | India price data page — new route + cron | Highest LLM citability ROI on the board |
| LAB-06 | India Deals Today — UI completion | Backend exists |

## Deadlines
| Date | Item |
|---|---|
| Jun 15 | CE-01 inbox check — begin active outreach if zero responses |
| Jul 15 | CE-01: 2× Builder Spotlights published at /community |
| Jul 16 | IG System User Token re-exchange |
| Aug 2026 | LEGO Fan CoLab application submitted |

---

## Watch items
- GSC first crawl data: expect Coverage + Enhancements signals by Jun 2–3
- 341 approved drafts at 15/day Gemini quota = ~23 days to clear. Monitor whether quota ceiling can be raised
- article→set internal links: 73 news + 22 blog with zero set links. GEO-05b prompt fix is Day 34 P1 — gap grows with every publish
- CE-01: zero responses as of close. Mid-June is the escalation point

---

## Schema coverage (final)
| Route | Schema | Status |
|---|---|---|
| All pages | Organization + WebSite + Breadcrumb | ✅ |
| sets/[slug] | Product + FAQPage | ✅ |
| sets/page.tsx | ItemList | ✅ |
| themes/[theme] | CollectionPage/ItemList | ✅ |
| news/[slug] | NewsArticle + FAQPage | ✅ |
| blog/[slug] | Article + FAQPage | ✅ |
| opinion/[slug] | Article | ✅ |
| guides/[slug] | Article | ✅ |
| reviews/[slug] | Review + Product | ✅ |
| community/[slug] | Person | ✅ |
| about/page.tsx | Person | ✅ |

# SEO Baseline Audit

**Last updated:** 2026-05-24  
**Status:** Partial — technical foundations confirmed live; traffic/ranking metrics unknown

---

## Technical foundations (confirmed live)

| Item | Status | Evidence | Shipped |
|------|--------|----------|---------|
| JSON-LD schemas | ✅ Live | GEO-01 hardened Day 2 — Organization, BreadcrumbList, Review, Article schema on all key pages | 2026-05-02 |
| Sitemap | ✅ Live | Paginated, `createServerClient()` + range() loop. `/sitemap.xml` returns all sets + articles | 2026-05-10 |
| robots.txt | ✅ Live | ROBOTS-01 — allows search bots, blocks training scrapers | 2026-05-01 |
| Cloudflare edge | ✅ Live | Mumbai BOM edge node. Cache-Control headers: `/sets/*` 1h, `/lab` 4h, `/sitemap.xml` 1h | 2026-05-02 |
| AI crawler policy | ✅ Live | GEO-02 — 9 AI referral bots allowed, 13 training-only bots blocked | 2026-05-01 |
| llms.txt | ✅ Live | GEO-01 — AI-readable site description at `/llms.txt` | 2026-05-02 |

---

## Unknown — needs baseline measurement

| Metric | Why it matters | How to measure | Priority |
|--------|---------------|----------------|----------|
| Domain Authority (DA) | RLFM/Fan CoLab credibility signal | Moz or Ahrefs free tool | P2 |
| Google Search Console | Impressions, clicks, CTR, coverage errors | GSC dashboard (verify setup) | **P1** |
| Google Search Console verification | Are we even verified? | Check GSC — verify if not | **P1** |
| Organic search traffic % | How much traffic is SEO vs. direct | Google Analytics or Cloudflare Analytics | P1 |
| Keyword rankings | "LEGO India", "LEGO price India", "buy LEGO India", "LEGO price comparison India" | GSC Performance tab or Semrush free | **P1** |
| Backlink profile | Count, quality, anchor text diversity | Ahrefs Site Explorer or Moz Link Explorer | P2 |
| Core Web Vitals — mobile | LCP, CLS, FID/INP — Google ranking factor | PageSpeed Insights (mobile) | P1 |
| Core Web Vitals — desktop | LCP, CLS, FID/INP | PageSpeed Insights (desktop) | P2 |
| Indexed pages count | How many pages Google has crawled | GSC Coverage report | P1 |
| Crawl budget issues | Any 404/redirect chains at scale | GSC Coverage errors | P2 |

---

## Hypotheses (unverified)

Based on site age (~2 months) and content volume:

- **Domain Authority:** Likely 1–10. New domain, minimal backlinks. Not a concern for RLFM — they evaluate content quality, not DA.
- **Search Console verification:** Probably not set up. If not, zero visibility into organic performance.
- **Organic traffic:** Near zero. Search engines take 3–6 months to index and rank new domains meaningfully.
- **Target keywords:** "LEGO price India" — medium competition, commercial intent. "LEGO India" — high competition (official LEGO.in dominates). Long-tail like "buy LEGO Rivendell India" — winnable.
- **Core Web Vitals:** Next.js + Netlify/GHA deploy should be reasonable, but Supabase fetches on product pages may add LCP latency. `/sets` page with 26,000 sets needs testing.

---

## Action plan

### Immediate (this week)
1. **Verify Google Search Console** — check if site is verified. If not, verify via HTML meta tag or DNS record. Add to CLAUDE.md once confirmed.
2. **Check GSC Coverage report** — are pages being indexed? How many? Any crawl errors?
3. **Run PageSpeed Insights on key pages** — `/`, `/sets`, `/sets/[slug]`, `/news`, `/reviews/[slug]`

### Short term (June 2026)
4. **Baseline DA measurement** — run once, record, track monthly
5. **Keyword position snapshot** — pull GSC Performance report, record top 20 queries, position, impressions
6. **Backlink audit** — check if any organic backlinks exist (may be zero)
7. **Identify quick wins** — which pages have impressions but low CTR? (title/meta description optimisation)

### Ongoing
- Monthly: GSC impressions + clicks trend
- Monthly: DA trend
- Quarterly: Full Lighthouse audit across all page types

---

## SEO improvement opportunities (once baseline is known)

| Opportunity | Effort | Potential |
|-------------|--------|-----------|
| `/guides` articles targeting "LEGO [theme] India" queries | Medium | High — long-tail, low competition |
| CE-05 History piece — "LEGO in India history" exact match | Low (write once) | Medium |
| Set pages with Indian price data — "LEGO [set name] price India" | Zero (data exists) | High — existing pages just need GSC visibility |
| Reviews targeting "LEGO [set name] review" | Low (write) | Medium |
| Internal linking from sets to guides | Low | Medium — passes link equity |
| Schema markup on guide articles | Zero (reuse existing pattern) | Low-medium |

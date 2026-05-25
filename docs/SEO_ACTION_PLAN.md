# SEO Action Plan — Baseline Audit + Improvement Roadmap

**Audit date:** 2026-05-25  
**Domain:** bricksofindia.com  
**Site age:** ~5 weeks (launched April 2026)

---

## Baseline findings

### 1. Google indexing status — CRITICAL

**Finding:** `site:bricksofindia.com` returns **zero results** in Google search. The domain does not appear in any search results, including for its own unique branded term ("LEGO Biryani Index"). When searching `"bricksofindia.com" LEGO India`, no BOI results appear.

**Root cause:** New domain with no backlinks. Google is aware the site exists (sitemap is live, robots.txt allows crawling) but has not ranked it for any query yet. Normal for a 5-week-old site with zero referring domains.

**This is not a technical block** — robots.txt correctly allows Googlebot. The site serves real HTML. Cloudflare is not blocking Googlebot.

**Action required:** GSC verification + sitemap submission + link building (see Week 1 plan).

---

### 2. Sitemap status

| Item | Status |
|------|--------|
| XML validity | ✅ Valid (`<?xml version="1.0"?>`, correct namespace) |
| Total URLs | 1,025 (12 static + 25 theme pages + ~988 set detail pages) |
| /news | ✅ Included |
| /reviews | ✅ Included |
| /blog | ✅ Included |
| /sets | ✅ Included |
| /lab | ❌ **Missing** — fixed in commit (see below) |
| /lab/biryani-index | ❌ **Missing** — fixed |
| /lab/which-set | ❌ **Missing** — fixed |
| /lab/heat-map | ❌ **Missing** — fixed |
| Sitemap reference in robots.txt | ✅ `https://bricksofindia.com/sitemap.xml` |

**Fix applied (2026-05-25):** Added `/lab`, `/lab/biryani-index`, `/lab/which-set`, `/lab/heat-map` to `src/app/sitemap.ts` static pages array. Sitemap now covers all live routes.

---

### 3. Keyword rankings

| Keyword | BOI position | Top results |
|---------|-------------|-------------|
| "LEGO price India" | Not found | Toycra, FirstCry, Flipkart, Amazon, LEGO.com |
| "LEGO India deals" | Not found | AJIO, Amazon, Toycra, Flipkart, LEGO.com |
| "LEGO Biryani Index" | Not found (page not indexed yet) | BrickLink, Brickset unrelated results |
| "bricksofindia.com LEGO India" | Not found | Unrelated results |

**Assessment:** Rankings not meaningful yet — site is not indexed. Once indexed, "LEGO Biryani Index" should rank #1 immediately (zero competition for this branded term). "LEGO price India" and "LEGO India deals" face strong competition from established retailers.

---

### 4. Robots.txt

```
User-agent: Googlebot → Allow: / (except /admin/ and /api/)
User-agent: * → Allow: / (except /admin/ and /api/)
Sitemap: https://bricksofindia.com/sitemap.xml
```

✅ No indexing blocks. Googlebot can crawl all content pages.

---

### 5. Structured data

**Note:** WebFetch tool strips `<script>` tags during HTML→markdown conversion. GEO-01 (shipped 2026-05-02) confirmed schemas ARE server-rendered into initial HTML. Previous curl verification showed Organization, BreadcrumbList, Product, and NewsArticle JSON-LD present. This tool cannot test it — use Google's Rich Results Test manually at `https://search.google.com/test/rich-results`.

**Priority manual checks:**
- `https://bricksofindia.com/sets/42172-1-mclaren-p1` → expect Product schema
- `https://bricksofindia.com/reviews/lego-42172-mclaren-p1-review` → expect Review + Product schema
- `https://bricksofindia.com/news/[any-slug]` → expect NewsArticle schema

---

### 6. Page titles (confirmed good)

| Page | Title |
|------|-------|
| Homepage | "Bricks of India — LEGO Price Comparison & Reviews in India 2026" |
| Product page | "McLaren P1 (42172) Price in India 2026 \| Bricks of India" |
| Review page | "Worth ₹29,399 in India? LEGO Technic McLaren P1 42172" |

Titles are keyword-rich, include year and price signals. No changes needed.

---

### 7. Meta descriptions

Not verifiable via WebFetch (tool limitation). **Manual action required:** Check 5 pages in browser DevTools → View Source and confirm `<meta name="description">` is present. If missing, add to `layout.tsx` and `[slug]/page.tsx` metadata exports.

---

### 8. Page speed

PageSpeed Insights UI not accessible via WebFetch. **Manual action required:** Run `https://pagespeed.web.dev/` on:
- `bricksofindia.com` (homepage)
- `bricksofindia.com/sets/42172-1-mclaren-p1` (product page)

Target: Lighthouse performance ≥ 80 mobile. Known risk: /lab/heat-map uses D3.js + TopoJSON from CDN — may have render-blocking script penalty.

---

### 9. Backlinks

**Current backlinks:** ~0 (site not appearing in any search results or referring domain trackers). Ahrefs shows domain rating 0 for new domains.

---

## Action plan

### IMMEDIATE (Week 1 — before 2026-06-01)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | **Set up Google Search Console** — verify bricksofindia.com property (DNS TXT record via Cloudflare or HTML file method) | 30 min | Critical — enables all other SEO actions |
| 2 | **Submit sitemap** in GSC → Sitemaps → Add sitemap.xml | 5 min | High — signals all 1,025+ URLs to Google |
| 3 | **Request indexing** of 10 key pages via GSC URL Inspection tool (homepage, /sets, /reviews, /lab/biryani-index, 3 review pages, 2 news articles) | 30 min | High — jumpstarts crawl queue |
| 4 | **Sitemap /lab fix** deployed ✅ (done 2026-05-25) | Done | Medium |
| 5 | **Post on r/IndiaLEGO** — introduce BOI, link to Biryani Index | 20 min | High — first backlink + traffic |
| 6 | **Post on r/lego** (with India-specific angle) — link to Biryani Index or price comparison | 20 min | High — second backlink |
| 7 | **Run Rich Results Test** on 3 URLs to verify JSON-LD (manual, in browser) | 15 min | Medium — confirms GEO-01 is working |

---

### 30-DAY PLAN (by 2026-06-25)

**Backlink outreach:**
- Comment on Brickset forum threads about Indian prices — include BOI link naturally
- Post in AFOL India Facebook groups (AFOL India, LEGO India Community)
- Join AFOL Discord servers (find Indian channels) — share Biryani Index
- Reach out to Toycra, MyBrickHouse, Jaiman — offer to list their deals on BOI → may link back
- Post CE-05 "History of LEGO in India" (July 1 target) — natural link magnet for LEGO community

**Internal linking:**
- Every news article → link to relevant set page on /sets
- Every review → link to /sets product page + /lab/biryani-index (for price context)
- /lab/biryani-index → link to /reviews for editorial context
- Homepage → link to /lab/heat-map with anchor text "LEGO Search Trends in India"

**Meta descriptions audit:**
- Verify all pages have unique `<meta name="description">` — if using default from layout.ts, each slug page needs override
- Product pages: "Compare LEGO [Set Name] ([set_num]) prices across Indian stores. Best price: ₹X at [store]. Updated daily."
- Review pages: "[verdict] — [opening line from review body]. Read the full BOI Codex-compliant review."

**GSC data collection:**
After submission, allow 14 days for Google to crawl. By Week 4, GSC should show first impression and click data.

---

### 60-DAY PLAN (by 2026-07-25)

| Action | Why |
|--------|-----|
| CE-05 "History of LEGO in India" live | Single best link magnet — definitive piece no one else has written |
| CE-02 articles 1–4 live at /guides | Long-tail SEO: "how to buy LEGO in India", "LEGO storage tips India", etc. |
| Internal link audit: ensure every CE-02 article links to 3+ product pages | PageRank distribution |
| Brickset forum submission: add BOI to their "fan sites" list | Tier 1 LEGO backlink |
| Reddit AMA in r/IndiaLEGO: "I built India's only LEGO price tracker — AMA" | Community awareness + multiple backlinks |

---

### 90-DAY PLAN (Pre-August Fan CoLab)

| Metric | Baseline | Target |
|--------|----------|--------|
| Domain authority (Ahrefs DR) | 0 | 10+ |
| Referring domains | ~0 | 15+ |
| Indexed pages | ~0 | 500+ |
| Organic traffic share | ~0% | 15%+ |
| GSC impressions (30d) | 0 | 5,000+ |
| GSC clicks (30d) | 0 | 200+ |
| "LEGO Biryani Index" ranking | Not indexed | #1 |
| "LEGO price India" ranking | Not indexed | Top 20 |
| "LEGO India deals" ranking | Not indexed | Top 20 |

---

## Fan CoLab SEO angle

Fan CoLab reviewers will search "bricksofindia.com" to evaluate the site. By August 2026, the application will be stronger if:

1. Google can find the site (basic requirement — being worked on)
2. "LEGO Biryani Index" ranks #1 (unique concept = memorability)
3. CE-05 "History of LEGO in India" exists (demonstrates editorial depth)
4. 15+ referring domains (shows community acceptance)

The content calendar (8 CE-02 guides + CE-05 + CE-01 spotlights) will naturally build topical authority around "LEGO India" queries.

---

## Manual actions for Abhinav (cannot be automated)

1. **Google Search Console setup** — requires DNS TXT record in Cloudflare or uploading an HTML file to Netlify
2. **Sitemap submission** in GSC dashboard
3. **URL inspection + request indexing** for 10 key pages
4. **Rich Results Test** in browser for 3 URLs
5. **PageSpeed Insights** run on homepage + product page (report scores)
6. **Reddit/AFOL outreach** — post about BOI in relevant communities
7. **Brickset fan site listing** — submit at brickset.com/article/118093

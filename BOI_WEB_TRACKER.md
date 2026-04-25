# BOI Web Tracker

> Infra, site integrity, scrapers, GEO/AI readiness, deploys, article pipeline, LEGO Search Pulse.
>
> **Last updated:** 2026-04-24 (post-audit)

---

## Section A — Infrastructure

| ID | Task | Status | Notes |
|----|------|--------|-------|
| INFRA-01 | Audit Netlify build minute usage | ✅ Done | Moot — migrated off Netlify builds |
| INFRA-02 | Set up GitHub Actions build pipeline | ✅ Done | `.github/workflows/deploy.yml` |
| INFRA-03 | Migrate production build to GHA | ✅ Done | Commit `8992aef`, canary `7be1205` |
| INFRA-04 | Migrate scraper cron to GHA | ✅ Done | `.github/workflows/scrape-prices.yml` firing |
| INFRA-05 | Verify GHA scraper cron cadence (daily?) | 🟡 To check | 492 rows scraped 2026-04-24; confirm daily trigger, not one-off |
| INFRA-06 | Clean up stray `scripts/test-env.mjs` | ⚠️ Pending | Untracked file from audit run |

---

## Section B — Site integrity (live audit 2026-04-24)

### B.1 — Page status

| Page | Status | Action |
|------|--------|--------|
| `/` | ✅ 200 | — |
| `/news` | ✅ 200 | 20 articles live |
| `/reviews` | ✅ 200 | See B.2 for schema gap |
| `/sets` | ⚠️ **404** | **FIX REQUIRED — see Block 2 below** |
| `/themes` | ✅ 200 | — |
| `/about` | ✅ 200 | — |
| `/llms.txt` | ✅ 200 | — |
| `/robots.txt` | ✅ 200 | — |
| `/sitemap.xml` | ✅ 200 | — |
| `/favicon.ico` | ✅ 200 | — |

### B.2 — JSON-LD schema coverage

| Page | Schemas present | Missing | Action |
|------|-----------------|---------|--------|
| `/` | Organization, WebSite, Person, SearchAction | — | ✅ Correct |
| `/news` | + BreadcrumbList, ListItem | — | ✅ Correct |
| `/reviews` | + BreadcrumbList, ListItem | **Review, Product** | ⚠️ GEO gap — add per-item schema |
| `/sets` | + BreadcrumbList, ListItem (on 404 page) | **Product** | ⚠️ Fix 404 first, then verify |
| `/about` | + EducationalOrganization | — | ✅ Correct |

---

## Section C — Scrapers & data

### C.1 — Supabase state (as of audit)

| Table | Rows | Freshness | Key columns |
|-------|------|-----------|-------------|
| `store_prices` | 492 | 2026-04-24 (today) | `store_id`, `scraped_at` |
| `price_history` | 9,142 | Historical, ordered by `recorded_at` | (see sample row) |

### C.2 — Scraper sources

| Source | Method | Status |
|--------|--------|--------|
| Toycra | Shopify `products.json` | ✅ Live |
| MyBrickHouse | Shopify `products.json` | ✅ Live |
| Jaiman Toys | Shopify `products.json` | ✅ Live |
| Amazon | Search-link only | ✅ Live (no scrape) |
| Flipkart | Search-link only | ✅ Live (no scrape) |
| Hamleys | — | 🔴 Not scoped |
| MX Games | — | 🔴 Not scoped |
| FunCorp | — | 🔴 Not scoped |
| Maya Toys | — | 🔴 Not scoped |
| FirstCry | — | 🔴 Not scoped |

### C.3 — Scraper health tasks

| ID | Task | Status |
|----|------|--------|
| SCRAPE-01 | Verify ON CONFLICT dedupe logic still clean | ✅ Done (commit `3d96b87`) |
| SCRAPE-02 | Confirm daily GHA cron firing | 🟡 Verify via Actions run history |
| SCRAPE-03 | Add per-store row count monitoring | 🔴 Not started |
| SCRAPE-04 | Add Hamleys / FunCorp scrapers | 🔴 Scoped but not built |

---

## Section D — Article pipeline (WEB-01 → 04)

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| WEB-01 | Claude Code: script → article in BOI voice | 🔴 Not started | Voice Codex (Phase 1) |
| WEB-02 | Auto-PR + auto-merge on passing lint | 🔴 Not started | WEB-01 |
| WEB-03 | 4-gate linter: word count, India Paragraph, verdict, image HTTP 200 | 🔴 Not started | Voice Codex (defines India Paragraph) |
| WEB-04 | Failed lint = PR stays open + email alert | 🔴 Not started | WEB-02, WEB-03 |

**Note:** This entire section is blocked on Voice Codex. See `BOI_CONTENT_TRACKER.md` Section A.

---

## Section E — LEGO Search Pulse (Phase 8)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| PULSE-01 | UI prototype — 3D globe variant | ✅ Done | `bricks-globe-preview.html` |
| PULSE-02 | UI prototype — India flat map variant | ✅ Done | `lego-search-pulse.html` |
| PULSE-03 | Decide globe vs flat map vs both | 🔴 Not decided | Probably flat map on homepage module, globe on dedicated page |
| PULSE-04 | Google Trends ingestion layer | 🔴 Not started | Daily/weekly cron → cached JSON |
| PULSE-05 | Store search-interest data in Supabase | 🔴 Not started | New table: `search_pulse` |
| PULSE-06 | Build `/pulse` route in Next.js | 🔴 Not started | Depends on PULSE-03, 04 |
| PULSE-07 | Homepage module — compact flat map hero | 🔴 Not started | Depends on PULSE-06 |
| PULSE-08 | State-drilldown interaction | 🔴 Not started | Already in prototype |
| PULSE-09 | JSON-LD for `/pulse` | 🔴 Not started | Dataset schema |

**Key decisions pending:**
- Data refresh cadence (weekly seems right — Google Trends isn't high-frequency signal)
- Whether to use official Google Trends API or pytrends unofficial wrapper
- Whether world-level data is worth the scraping complexity (prototypes include WORLD_DATA)

---

## Section F — Deploys

| ID | Name | Status | Notes |
|----|------|--------|-------|
| Deploy 1 | Initial launch | ✅ Done | Commit `2f8d691` + earlier |
| Deploy 2 | Visual overhaul + GEO/AI | ✅ Done | `8fde610`, `d8646c7`, `9476d03` |
| Deploy 3 | (as-prepared handover doc) | 🟡 Review what's still pending | P0 batch may have absorbed some items |
| Deploy 4 | (as-prepared handover doc) | 🟡 Review what's still pending | Reconcile vs P0 batch |
| P0 batch 1 | Nav, hero, stat cards, /about | ✅ Done | Commit `b5c8d61` |
| P0 batch 2 | /search, /themes, SetCard | ✅ Done | Commit `70a9eb0` |
| P0 batch 3 | CopyLinkButton Client Component | ✅ Done | Commit `d2b7339` — fixed news articles |

---

## Block 2 — Immediate fixes

Ordered by blast radius. Execute in sequence.

### FIX-01 — Investigate `/sets` 404

```bash
# From project root
grep -r "sets" src/app/ --include="*.tsx" --include="*.ts" | grep -iE "(page|route)" | head
ls src/app/sets/ 2>/dev/null
```

Expected: either the route file is missing, or there's a catch-all causing the 404. Once diagnosed, fix routing and verify with:

```bash
curl -s -o /dev/null -w "%{http_code}" https://bricksofindia.com/sets
```

### FIX-02 — Add Review + Product JSON-LD

On `/reviews` listing page, add per-review `Review` schema with nested `Product`. Pattern:

```typescript
// Inside the reviews listing page component
const reviewsSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "itemListElement": reviews.map((r, i) => ({
    "@type": "Review",
    "position": i + 1,
    "itemReviewed": {
      "@type": "Product",
      "name": r.setName,
      "productID": r.setNumber,
      "brand": { "@type": "Brand", "name": "LEGO" }
    },
    "author": { "@type": "Person", "name": "Abhinav Bhargav" },
    "reviewRating": { "@type": "Rating", "ratingValue": r.rating, "bestRating": 5 },
    "reviewBody": r.summary
  }))
};
```

Verify with:
```bash
curl -s https://bricksofindia.com/reviews | grep -o '"@type":"[^"]*"' | sort -u
```
Should now include `"@type":"Review"` and `"@type":"Product"`.

### FIX-03 — Clean up stray untracked file

```bash
# Check what it is first
cat scripts/test-env.mjs
# If it's a throwaway from audit, delete:
rm scripts/test-env.mjs
# If worth keeping, commit:
git add scripts/test-env.mjs && git commit -m "chore: add env verification helper"
```

### FIX-04 — Verify scraper cron cadence

```bash
gh run list --workflow=scrape-prices.yml --limit 10
```

Expected: one run per day for the last several days. If not, inspect `.github/workflows/scrape-prices.yml` cron schedule.

---

## Section H — Data layer debt

| ID | Task | Status | Notes |
|----|------|--------|-------|
| DATA-01 | Reconcile store_prices (scraper writes) with prices (frontend reads). Currently disconnected — scraper output not reaching users. | 🔴 Not started | 2–3 hours; schedule after SETS-01. |
| DATA-02 | Audit sets table coverage. 756 rows vs expected 1,500–2,000 with 3yr retired cutoff. Backfill from Rebrickable if gap is material. | 🔴 Not started | Depends on DATA-01 decision. |
| WEB-TYPES-01 | Audit TypeScript types in src/lib/supabase.ts against actual Supabase schema. Price type describes prices correctly but Price is the only type we verified. | 🟡 Partial | Low priority. |

---

## Legend

- ✅ Done
- 🟡 In progress / partial / to verify
- 🔴 Not started / blocked
- ⚠️ Broken, needs fix

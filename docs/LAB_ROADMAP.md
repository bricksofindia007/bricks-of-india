# The Lab — Roadmap

**Last updated:** 2026-05-25  
**Live tools:** 4 of 8 (LAB-01, LAB-02, LAB-03/04, LAB-07)

---

## All tools

| ID | Name | Status | Priority | Blocks |
|----|------|--------|----------|--------|
| LAB-01 | Biryani Index | ✅ LIVE | — | — |
| LAB-02 | Which Set Are You? (quiz) | ✅ LIVE | — | — |
| LAB-03 | Daily price snapshot cron | ✅ LIVE | — | LAB-05 |
| LAB-04 | Lab homepage + nav + /lab directory | ✅ LIVE | — | — |
| LAB-05 | CMF Tracker | 🔴 Not started | P2 | — |
| LAB-06 | India Deals Today | 🟡 Backend live | **P1** | CE-06 |
| LAB-07 | Budget Calculator INR | 🔴 Not started | P2 | — |
| LAB-08 | Retiring Soon | 🔴 Not started | P3 | — |

---

## Live tools

### LAB-01: Biryani Index
**Route:** `/lab/biryani-index`  
Converts LEGO price to equivalent biryani plates / chai cups / petrol litres. Launched Day 1.

### LAB-02: Which Set Are You?
**Route:** `/lab/which-set`  
5-question personality quiz, 8 outcomes, store links with ABHINAV12 code. Launched Day 10.

### LAB-03: Daily Price Snapshot Cron
**Route:** N/A (background cron)  
Writes `price_snapshots` table daily at 08:30 IST. ~724 snapshots/day. Running since 2026-05-02 — 23 days of data as of 2026-05-25 (20,820 total snapshots). Eligible for price-drop analysis from ~2026-06-01. Unblocks LAB-05.

### LAB-04: Lab Homepage + Nav
**Route:** `/lab`  
Lab directory page, homepage strip, nav dropdown. All tools registered in `src/lib/lab-tools.ts`.

---

## In progress

### LAB-06: India Deals Today
**Route:** `/lab/deals`  
**Status:** 🟡 Backend live — frontend needed  
**Priority: P1** — blocks CE-06 (Deals Alert IG Story)

Backend: `store_prices` table populated daily by `scrape-prices.yml`. Price data available for all tracked stores (Toycra, MyBrickHouse, Jaiman Toys, LEGO.com India).

Frontend needed:
- Route: `src/app/lab/deals/page.tsx`
- Query: `store_prices` joined to `sets`, filter `in_stock = true`, order by `discount_pct` desc
- Layout: price card grid — set image, set name, store name, original price, current price, discount %, "Buy Now" CTA
- Register in `lab-tools.ts` (change `coming_soon: true` → remove flag)

Brief: TBD. Scope: ~1 session.

---

## Not started

### LAB-05: CMF Tracker
**Route:** `/lab/cmf`  
**Priority: P2**  

Track CMF (Collectible Minifigures) series availability and completeness across Indian stores. Requires: CMF series data source (Brickset API or manual), store availability data from `store_prices`.

### LAB-07: Budget Calculator INR
**Route:** `/lab/budget`  
**Priority: P2**  

"What can I buy with ₹X?" — input a budget in rupees, get a curated list of in-stock sets within that budget from Indian stores. Query: `store_prices` join `sets`, filter by price range, sort by value (parts per rupee).

### LAB-08: Retiring Soon
**Route:** `/lab/retiring`  
**Priority: P3**  

Shows sets with Brickset exit dates within the next 6 months, with price trends. Requires: CATALOG-04 v2 (Brickset exit date cron). LAB-03 snapshot data needed for price trend lines (30+ days).

---

## Archived / deferred

| ID | Original name | Disposition |
|----|--------------|-------------|
| LAB-07 (old) | LEGO Search Pulse / Heat Map | ✅ Shipped at `/lab/heat-map` (Day 10) |
| LAB-08 (old) | Brick Portfolio | 🔴 Deferred indefinitely — requires auth strategy decision (DPDP Act compliance) |

---

## Priority rationale

**LAB-06 first** because:
1. Backend (price data) already live — purely frontend work
2. Unblocks CE-06: Deals Alert IG Story (weekly Canva post pulling /lab/deals data)
3. CE-06 is a Fan CoLab dependency (demonstrates monetisation + utility content strategy)
4. Estimated effort: 1 session (~3–4 hours)

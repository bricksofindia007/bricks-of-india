# Theme Card Migration — Phase 1 Manifest (Evidence + Manifest)

**Date:** 2026-07-06
**Purpose:** Pre-migration evidence pass for replacing Rebrickable-sourced theme images with static local theme cards. Read-only — no application code, `public/`, or database rows were modified to produce this document.
**Evidence sources:**
- Repo grep (ripgrep), tagged `[repo-grep: path:line]` below.
- Live Supabase query, project `hqpaiarhmiocmjrzjhtw`, tagged `[live-db-query]` below.
- Direct file reads of the cited lines, not tracker text.

**Filenames in this manifest use `.webp`** per the migration's stated target format.

---

## Step 2 result first (it changes how to read the Step 1 inventory)

**There is no `themes` table.** `[live-db-query: information_schema.tables WHERE table_name ILIKE '%theme%']` returned zero rows. LEGO theme data exists in exactly one place in the database: a plain `text` column, `sets.theme`.

**Two different, non-overlapping "theme lists" exist in this codebase, and the migration needs to decide which one it's migrating:**

1. **`sets.theme`** (live DB column) — **300 distinct raw values**, `[live-db-query: SELECT theme, COUNT(*) FROM sets GROUP BY theme]`. This is the full, unfiltered Rebrickable theme taxonomy as synced — it includes genuine LEGO product themes (Technic, City, Star Wars) but also legacy/vintage splits (Pirates I/II/III, Space Police I/II/III, Series 1-29 Minifigures as 29 separate rows), non-buildable merchandise categories (Key Chain, Gear, Bag and Luggage Tags, Magnets, Bags/Totes/Luggage, Stationery and Office Supplies), and a literal `"Unknown"` bucket (174 sets). No `id` column, no `slug` column — it is free text with all the inconsistency that implies (see collisions below).

2. **`THEMES`** (hardcoded array, `src/lib/brand.ts:45-70`) — **25 curated entries**, each with `name`, `slug`, `emoji`, `image` (a `cdn.rebrickable.com` URL), and `accentColor`. This is a hand-picked subset of (1), chosen for the site's "Browse by Theme" UI. **This is the array every actual theme-card render site (Step 1) imports and displays** — none of the render sites query `sets.theme` directly for the card grid itself; they only use `sets.theme` afterward, to fetch the matching sets once a theme card is clicked.

**Recommendation, not a decision made on your behalf: this manifest's filename table (below) is built from list (2) — the 25 themes actually rendered as cards today — since that's what "theme card migration" concretely means right now.** List (1) is reported in full further down so you can decide whether the migration should also expand card coverage to any of those 300 raw values.

**Identifier used at the render→data join:** `sets.theme`, matched by **name**, via a fuzzy `ILIKE`, not a slug or numeric ID:
```
.ilike('theme', `%${theme.name}%`)
```
`[repo-grep: src/app/themes/[theme]/page.tsx:45]`. The `slug` field on the `THEMES` array is used only for **routing** (`/themes/<slug>` URL params), never for the DB lookup — confirmed at `[repo-grep: src/app/themes/[theme]/page.tsx:16,20,35]` (`THEMES.find(t => t.slug === params.theme)`).

No numeric Rebrickable theme ID is stored anywhere in Supabase. The only place numeric Rebrickable theme IDs appear is hardcoded inside the one-off script `scripts/fetch-theme-images.mjs` (see Step 1 inventory), used purely to query Rebrickable's API when that script was run manually.

---

## Step 1 — Render-site inventory

### Theme image render sites (visually display a theme card/image)

| Site | Evidence | What it does |
|---|---|---|
| Homepage "Browse by Theme" grid | `[repo-grep: src/app/page.tsx:329-344]` | Maps `THEMES`, renders `theme.image` via `ImageWithFallback` (fallback chain: `theme.image` → `images.brickset.com/sets/images/{slug}-1.jpg` → local placeholder). |
| `/themes` index page | `[repo-grep: src/app/themes/page.tsx:41,49-53]` | Same pattern: maps `THEMES`, `ImageWithFallback` with `theme.image` first, Brickset fallback second, local placeholder third. |
| `/themes/[theme]` individual theme page | `[repo-grep: src/app/themes/[theme]/page.tsx:29,113,141]` | THREE separate uses of `theme.image`: (a) OpenGraph/social meta image, (b) a 56×56px header thumbnail, (c) a 96×96px hero image. All via `ImageWithFallback`. |

### Sites that use `THEMES` but do NOT render `theme.image` (checked directly, confirmed no image usage)

| Site | Evidence | What it actually uses |
|---|---|---|
| `/compare` filter links | `[repo-grep: src/app/compare/page.tsx:237-241]` | `t.slug`, `t.name` only — a text filter link list, no image. |
| `/sets` fallback theme list | `[repo-grep: src/app/sets/page.tsx:78-81]` | `t.name` only, and only as a fallback if the `get_distinct_themes` RPC fails — own comment confirms: `// THEMES used as fallback only`. |
| `sitemap.xml` generation | `[repo-grep: src/app/sitemap.ts:37]` | `t.slug` only, for URL generation. No image. |

### `/lab/` surfaces

**None reference `THEMES` or theme images.** `[repo-grep: grep "THEMES|theme\.image|brand'" across src/app/lab/* — zero matches]`. The `/lab/` directory (`biryani-index`, `budget-calculator`, `cmf-tracker`, `deals`, `heat-map`, `price-drops`, `retiring-soon`, `which-set`) renders set-level images where relevant, never theme cards.

### Social automation pipeline (SOC-AUTO-01)

**Does not reference theme images.** Checked `social-automation/*.py` for `theme` + image-related terms:
- `[repo-grep: social-automation/media_processor.py:213-217]` — renders the theme as **text** (`theme.upper()`, drawn with `_draw_text_outlined`), not an image.
- `[repo-grep: social-automation/scraper.py:213]` — `theme` is a plain string field returned alongside `gallery_images` (which are **set** photos, not theme images).

No fetch, cache, or render of a theme *image* anywhere in this pipeline.

### Article generation / RADAR pipeline

**Does not reference theme images**, with one adjacent but distinct exception:
- `scripts/fix-youtube-hero-images.mjs` uses a "LEGO theme keyword extracted from title" as step 2 of a 3-step fallback chain for picking a **news article's hero image** (`[repo-grep: scripts/fix-youtube-hero-images.mjs:8-9]`) — this selects a *set* image via Rebrickable search using the theme name as a keyword. It is about `news_articles.hero_image`, not a theme card, and is out of scope for this migration, but is flagged here since it does involve "theme" + "image" together.
- `scripts/sync-rebrickable.js` fetches theme **names only** (via Rebrickable's `/themes/{id}/` metadata endpoint, to populate `sets.theme` text during set sync) — `[repo-grep: scripts/sync-rebrickable.js:69-86]`. No image involved.

### Supporting infrastructure (not a render site itself, but part of the chain)

| File | Evidence | Role |
|---|---|---|
| `src/lib/brand.ts:45-70` | `[repo-grep]` | Defines the canonical `THEMES` array — the actual migration target. |
| `src/components/ui/ImageWithFallback.tsx` | `[repo-grep: full file]` | Generic fallback-chain image component used by all three render sites above. Renders `srcs[0]`, advances to `srcs[1]`, etc. on load error, terminating at a local placeholder. |
| `next.config.mjs:19` | `[repo-grep]` | Allowlists `cdn.rebrickable.com` as a Next.js Image `remotePatterns` host — required for any of the above to load without a Next.js image-optimization error. |
| `src/app/api/img/route.ts:19` | `[repo-grep]` | A separate image-proxy API route that also allowlists `cdn.rebrickable.com` (alongside `images.brickset.com`, `i.ytimg.com`) — used for other Rebrickable-sourced images sitewide (sets, articles), not confirmed to be in the theme-card path specifically, but shares the same domain dependency. |
| `scripts/fetch-theme-images.mjs` | `[repo-grep: full file]` | A **manual, read-only, one-off diagnostic script** (its own header: "READ-ONLY — does not modify any files"). Given a hardcoded 25-theme list (matching `brand.ts` exactly, with Rebrickable `theme_id`s for the lookup), queries the Rebrickable API for a representative set image per theme and prints copy-paste-ready `brand.ts` lines for a human to apply manually. **Not called by any GitHub Actions workflow** `[repo-grep: grep "fetch-theme-images" .github/ — zero matches]` — confirms this is not part of any automated pipeline. This script is almost certainly how `brand.ts`'s current image URLs were originally sourced.

### Sets and articles — Rebrickable used, but NOT for theme images (noted to avoid conflation)

The broad repo grep for `rebrickable`/`cdn.rebrickable.com` surfaces many hits unrelated to theme cards — `src/components/sets/SetImage.tsx`, `src/app/sets/[slug]/page.tsx:168`, `src/app/reviews/[slug]/page.tsx:206`, `src/components/content/ArticleCard.tsx:82`, `src/lib/schemas.ts`, `scripts/seed-content.js` — these all construct or store **individual LEGO set** image URLs (`set.rebrickable_id`), a separate system from theme cards. Out of scope for this migration; listed here only so they aren't mistaken for theme-image render sites.

---

## Full render-site inventory (repeated for the closing section per the requested format)

1. `src/app/page.tsx:329-344` — homepage theme grid — renders `theme.image`.
2. `src/app/themes/page.tsx:41,49-53` — theme index page — renders `theme.image`.
3. `src/app/themes/[theme]/page.tsx:29,113,141` — individual theme page — renders `theme.image` 3×.
4. `src/app/compare/page.tsx:237` — uses `THEMES`, no image.
5. `src/app/sets/page.tsx:81` — uses `THEMES`, no image, fallback-only.
6. `src/app/sitemap.ts:37` — uses `THEMES`, no image.
7. `/lab/*` — zero references.
8. `social-automation/*` — zero image references (theme rendered as text only).
9. RADAR/article pipeline — zero theme-card references (one adjacent, out-of-scope hit: article hero-image fallback).

---

## Step 2 — Canonical theme list

### A. The 25 rendered theme cards (`src/lib/brand.ts:45-70`) — the primary migration table

No `id` column exists for this list — it is a TypeScript array, not a database table. `name` and `slug` are both already defined in code (no derivation needed, no collisions: all 25 slugs are unique).

| id | canonical name | slug | expected filename |
|---|---|---|---|
| — | Architecture | architecture | `architecture.webp` |
| — | Art | art | `art.webp` |
| — | BrickHeadz | brickheadz | `brickheadz.webp` |
| — | Botanical | botanical | `botanical.webp` |
| — | City | city | `city.webp` |
| — | Classic | classic | `classic.webp` |
| — | Creator | creator | `creator.webp` |
| — | DC | dc | `dc.webp` |
| — | Disney | disney | `disney.webp` |
| — | Dots | dots | `dots.webp` |
| — | Dreamzzz | dreamzzz | `dreamzzz.webp` |
| — | Duplo | duplo | `duplo.webp` |
| — | Friends | friends | `friends.webp` |
| — | Harry Potter | harry-potter | `harry-potter.webp` |
| — | Icons | icons | `icons.webp` |
| — | Ideas | ideas | `ideas.webp` |
| — | Jurassic World | jurassic-world | `jurassic-world.webp` |
| — | Marvel | marvel | `marvel.webp` |
| — | Minecraft | minecraft | `minecraft.webp` |
| — | Ninjago | ninjago | `ninjago.webp` |
| — | Seasonal | seasonal | `seasonal.webp` |
| — | Speed Champions | speed-champions | `speed-champions.webp` |
| — | Star Wars | star-wars | `star-wars.webp` |
| — | Super Mario | super-mario | `super-mario.webp` |
| — | Technic | technic | `technic.webp` |

**Total: 25 themes, sorted by name.**

### B. The raw `sets.theme` column — 300 distinct values, for your decision on scope

`[live-db-query: SELECT theme, COUNT(*) FROM sets WHERE theme IS NOT NULL AND theme <> '' GROUP BY theme ORDER BY theme]` — full result has 300 rows; not reproduced in full table form here (300 rows of `id=NULL, slug=NULL` would be mostly noise), but every value is captured in the query above and can be re-run at any time. Representative examples, **not exhaustive**:

- Clean matches to the 25 (case/whitespace differences only, `ILIKE` already handles these): `DOTS` (93 sets) vs. list-A `Dots`; `Brickheadz` (196 sets) vs. list-A `BrickHeadz`.
- **Prominent themes with real set counts that are NOT in list A at all** — flagged for your decision, not assumed: `Ultimate Collector Series` (50 sets), `Batman` (145 sets, separate from `DC`), `Avengers` (100 sets, separate from `Marvel`), `Spider-Man` (130 sets, separate from `Marvel`), `Trains`/`Train` (102 + 73 sets, two separate values), `Bionicle` (414 sets), `The Lord of the Rings` (18 sets).
- **Likely-duplicate/overlapping families that would need a rollup decision if list A were expanded**: `DC` (list A) vs. raw `DC Comics` (8), `DC Comics Super Heroes` (4), `DC Super Hero Girls` (12), `DC Super Heroes` (2), `Super Heroes DC` (27), `Justice League` (16), `Batman` (145), `The LEGO Batman Movie` (44 + two more Batman-movie splits) — at least 8 distinct raw values plausibly rolling into one "DC" umbrella card, or plausibly deserving their own cards. Similarly for `Marvel`: `Marvel` (16), `Marvel Series 1/2` (2+4), `Marvel Super Heroes` (4), `Super Heroes Marvel` (55), `Avengers` (100), `Spider-Man` (130 + a spin-off split), `The Infinity Saga` (58), `Guardians of the Galaxy` (16), `Iron Man` (+2 more splits), `Captain America` (9), `X-Men` (9).
- **A literal `"Unknown"` bucket** (174 sets) — not a real theme, would need explicit exclusion if list A were ever expanded from this raw column.
- **Non-buildable/merchandise categories** that almost certainly should never become theme cards even if list A expands: `Key Chain` (829), `Gear` (679), `Bags, Totes, & Luggage` (820), `Bag and Luggage Tags` (129), `Stationery and Office Supplies` (733), `Houseware` (550), `Magnets` (140), `Posters and Art Prints` (97), `Video Games and Accessories` (270), `Clocks and Watches` (222).

**No slugs were derived for list B and none were written back to the database** — per the task's explicit instruction, this is flagged for your decision on scope, not resolved here.

---

## Closing summary

- **Total theme count, primary list (rendered theme cards):** 25 (`src/lib/brand.ts`).
- **Total theme count, raw DB column:** 300 distinct `sets.theme` values, zero of which have an `id` or `slug` in the database.
- **No themes table exists** — confirmed via live `information_schema.tables` query, zero rows matching `%theme%`.
- **Slug collisions:** none within the 25-entry render list (all unique, already defined in code).
- **Ambiguous/flagged cases:** the DC and Marvel franchise families (8 and ~10 raw sub-theme values respectively) and several prominent raw themes absent from the current 25 (`Ultimate Collector Series`, `Batman`, `Avengers`, `Spider-Man`, `Bionicle`, `The Lord of the Rings`) — see Step 2B. These require an explicit decision before any filename is assigned to them; none is proposed here.
- **Render-site inventory:** 3 sites render theme images (homepage grid, `/themes` index, `/themes/[theme]` detail — 3 separate image usages on the last one); 3 sites use theme data without images (`/compare`, `/sets` fallback, sitemap); `/lab/*`, social automation, and the article/RADAR pipeline do not reference theme images at all (each confirmed with grep evidence above, including the negative results).

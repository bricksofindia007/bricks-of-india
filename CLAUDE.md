# BOI Agent Instructions

**Canonical reference:** `BOI_MASTER_TRACKER.md` — read this at the start of every session.

**Dashboard sync:** see `BOI_MASTER_TRACKER.md` § Auto-update protocol — every state change updates `admin/dashboard.html` in the same commit.

**Dashboard validation:** at session start, confirm `admin/dashboard.html` JSON parses cleanly before doing anything else. If it doesn't, fix first.

**Brief files:** task briefs live in `briefs/`. Read the relevant brief before executing any scoped task.

**Data sources runbook:** `DATA_SOURCES.md` — consult before touching any ingest script or Supabase schema.

**Defect log:** `docs/BRIEF_DEFECTS.md` — log every defect found during execution. Never reuse a defect ID.

**Handover docs:** `docs/handover/Day_N_Ground_Truth.md` — write at end of every session. Anchor every claim in verified terminal evidence.

---

## Git rules

**Git staging:** never `git add -A` or `git add .`. Always name files explicitly. Diagnostic files in the working tree have drifted into commits twice.

**Always push after commit.** Do not leave commits un-pushed at session end.

**Use PowerShell for `gh` commands** — the Bash tool does not inherit Windows PATH additions, so `gh` is not visible there. `gh run list`, `gh pr create`, `gh pr merge`, `gh workflow run`, `gh run watch` all go through the PowerShell tool.

**Never amend** unless the user explicitly asks. Create new commits instead.

---

## Next.js / Netlify rules

**Next.js middleware:** to expose request data to Server Components via `headers()`, use `NextResponse.next({ request: { headers } })`. `response.headers.set()` is browser-only and invisible to `headers()` — silent failure, no error thrown.

**Server Actions on Netlify:** use `redirect()` not `revalidatePath()`. Netlify does not support on-demand ISR revalidation the same way as Vercel — `revalidatePath` silently no-ops and the page stays stale. All mutating Server Actions must call `redirect(url)` to produce a visible page refresh.

**Netlify plugin:** `@netlify/plugin-nextjs: ^5.0.0` must be pinned in `package.json` devDependencies. Without it, Netlify may resolve to v4 which does not support Server Actions. The plugin is also declared in `netlify.toml [[plugins]]` — both are needed.

**Netlify env vars:** `NEXT_PUBLIC_*` vars must be set in Netlify's Environment Variables UI — they are NOT automatically inherited from GitHub Secrets. GitHub Secrets only flow into GitHub Actions jobs, not Netlify builds.

**`createClient` guard:** `@supabase/supabase-js` `createClient('', key)` throws synchronously at module load. Guard `createServerClient()` with an explicit URL check:
```ts
if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set — check Netlify environment variables');
```

---

## Supabase rules

**Service role key:** always use `createServerClient()` (service role key) for server-side writes and admin queries. The anon client (`supabase`) is for public reads only.

**PostgREST 1000-row cap:** Supabase hosted PostgREST returns at most 1000 rows per request regardless of `.limit()` or `.range()` overrides — these are silently capped server-side. For queries that must return full tables (e.g. loading all set numbers for matching), paginate in a loop with `.range(offset, offset + PAGE - 1)` until a page returns fewer than PAGE rows.

**RLS rule (PROCESS-RLS-01):** every new migration that creates a table MUST include `ENABLE ROW LEVEL SECURITY` and explicit policies. Default Supabase project setting is RLS off — omitting it means anonymous users have full read/write access. Verified: price_snapshots and pending_drafts were exposed for 3 days before fix (DEFECT-007).

**`pending_drafts` — source_url is NOT unique.** Migration `20260503120000_pending_drafts_iteration.sql` dropped the unique index to allow multiple iteration rows per source. Use plain `.insert()`, not `.upsert(onConflict: 'source_url')` — that throws `42P10` because the constraint no longer exists.

**`store_prices` conflict key:** `onConflict: 'set_id,store_id'` — one row per set per store.

---

## Price data rules

**Two price tables exist — do not confuse them:**
- `prices` — legacy table. Schema: `store_name`, `availability`, `is_active`, `buy_url`. No longer written to by active scrapers. Used as fallback on `/deals`.
- `store_prices` — active scraper table. Schema: `store_id`, `in_stock`, `product_url`, `scraped_at`. Written by `scripts/scrape-now.mjs` every 6h. All listing pages (`/sets`, `/sets/page/[page]`, `/compare`) read from this table.

When adding price display to any new page, always use `store_prices`, never `prices`.

---

## RADAR pipeline rules

**RADAR-04 is on-demand only — NOT in the nightly cron.** The `generateArticle()` Server Action in `/admin/pending` runs Gemini for one draft at a time when the operator clicks the amber "Generate Article" button. `generate-drafts.js` exists for manual bulk use only. Never re-add RADAR-04 to `radar.yml` without explicit operator instruction — auto-generation burns Gemini quota on every approved signal indiscriminately (DEFECT-012).

**Nightly cron (radar.yml) = RADAR-01 → RADAR-02 → RADAR-03 only.** Signals are fetched, deduped, and classified automatically. Generation and publishing are always operator-initiated.

**Pipeline order:** RADAR-01 (fetch) → RADAR-02 (dedupe) → RADAR-03 (classify → pending_drafts) → RADAR-04 (generate bodies for approved rows) → /admin/pending (manual operator review) → publish.

**Nothing auto-publishes.** Every draft requires explicit operator approval at `/admin/pending` before any article goes live.

**RADAR-03 qualifying threshold:** score ≥ 4 (Tier 1=5pts, Tier 2=4pts, Tier 3=3pts; has body +2pts; freshness +2/+1pts). Tier 4/5 almost never qualify unless they have body content.

**Gemini rate limit:** Gemini 2.5 Flash-Lite free tier = 10 RPM. Add 7s delay between calls in `generate-drafts.js`. On 429, stop immediately and do NOT retry.

**`sanitizeXml(xml)`** in `fetch-rss.js` strips bare HTML boolean attributes (`crossorigin`, `async`, etc.) and escapes unescaped `&` before rss-parser sees the XML. New Elementary's feed has a third cascading violation (mismatched tags) that requires a full parser swap to `@extractus/feed-extractor` — New Elementary stays `enabled: false` until that ships (PARSER-01).

---

## Admin UI rules

**`/admin/pending` auth:** cookie `boi_admin` set to the value of `ADMIN_PASSWORD` env var. 8-hour session, `httpOnly`, `sameSite: strict`, `/admin` path scope. `ADMIN_PASSWORD` must be set both in `.env.local` (local) and Netlify Environment Variables (production).

**`/admin/pending` filters:** status/format/source-domain chips are URL-driven (`searchParams`). `redirectTo` hidden input in every form preserves the current filter state after approve/reject/approveAll actions.

---

## Sources config

**Active sources as of Day 9:** 14 sources across 5 tiers. Tier 1: Brothers Brick, Jay's Brick Blog, BrickNerd (New Elementary disabled — PARSER-01). Tier 2: Brickset (`/feed`, not `/article/rss`), Rebrickable API (LEGO New Sets disabled — SPA). Tier 3: r/lego. Tier 4: 6 YouTube channels. Tier 5: Blocks Magazine (`blocksmag.com/news/`, no www), Brick Fanatics (others disabled — SCRAPE-01).

**Brickset correct URL:** `https://brickset.com/feed` — the old `/article/rss` endpoint returns an HTML page, not RSS.

**Blocks Magazine correct URL:** `https://blocksmag.com/news/` (no www, trailing slash) — the www version 301-redirects and the hostname mismatch filtered all links.

---

## Scraper rules

**`scrape-now.mjs` knownSets pagination:** loads `sets` table via paginated `.range()` loop (PAGE=1000) to bypass PostgREST 1000-row cap. Without this, only the first 1000 sets are matched and ~95% of store products are logged as "no DB match" (bug fixed 2026-05-09, commit `3a683f9`).

**MBH domain:** `lego.mybrickhouse.com` — the general `mybrickhouse.com` domain returns mixed inventory with low LEGO match rates.

**Variant selection:** use cheapest in-stock variant (filter `v.available === true`, sort by price asc). Fall back to cheapest overall if none in stock.

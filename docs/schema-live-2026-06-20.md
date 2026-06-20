# Live Schema Snapshot — 2026-06-20

> **Source of truth:** production Supabase DB, queried via `information_schema.columns`.  
> **Purpose:** PR-2b-3.6 schema drift audit. This file is the canonical A2 artifact.  
> **21 tables** in `public` schema as of this date.

---

## Drift legend

- **FILE_ONLY** — column/table exists in a migration file but not in live DB  
- **LIVE_ONLY** — column/table exists in live DB but has no migration file  
- **MISMATCH** — column exists in both but name or type differs between file and code  
- **ORPHANED** — table in live DB with no migration file AND no code references  

---

## blog_posts

Migration: `scripts/schema.sql`

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| title | text | NO | — |
| slug | text | NO | — |
| content | text | NO | — |
| category | text | NO | 'Buying Guides' |
| excerpt | text | NO | — |
| hero_image | text | YES | — |
| published_at | timestamptz | YES | now() |
| seo_title | text | YES | — |
| seo_description | text | YES | — |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

> `updated_at` added by `scripts/migrations/002_content_updated_at.sql`.

---

## cmf_figures

Migration: `supabase/migrations/20260531000000_cmf_figures.sql`

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| figure_number | text | NO | — |
| series_set_number | text | NO | — |
| name | text | NO | — |
| image_url | text | YES | — |
| series_name | text | NO | — |
| year | integer | YES | — |
| figure_index | integer | YES | — |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

---

## community_spotlights

Migration: `supabase/migrations/20260525120000_community_spotlights.sql`

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO | — |
| slug | text | NO | — |
| builder_name | text | NO | — |
| location | text | YES | — |
| bio | text | YES | — |
| photos | jsonb | NO | '[]'::jsonb |
| published_at | timestamptz | NO | now() |
| published | boolean | NO | false |

---

## content_fix_log

Migration: `supabase/migrations/20260529000000_content_quality_system_v2.sql`

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| fixed_at | timestamptz | YES | now() |
| article_slug | text | YES | — |
| section | text | YES | — |
| fix_type | text | YES | — |
| body_before | text | YES | — |
| body_after | text | YES | — |
| issue_id | uuid | YES | — |

---

## content_image_registry

Migration: `supabase/migrations/20260529000000_content_quality_system_v2.sql`

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| checked_at | timestamptz | YES | now() |
| article_slug | text | YES | — |
| section | text | YES | — |
| image_url | text | YES | — |
| http_status | integer | YES | — |
| is_duplicate | boolean | YES | false |
| duplicate_of | ARRAY | YES | — |

---

## content_quality_issues

Migration: `supabase/migrations/20260528120000_content_quality_issues.sql`

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| checked_at | timestamptz | YES | now() |
| article_id | uuid | YES | — |
| article_slug | text | YES | — |
| section | text | YES | — |
| check_name | text | YES | — |
| severity | text | YES | — |
| detail | text | YES | — |
| resolved | boolean | YES | false |
| resolved_at | timestamptz | YES | — |
| auto_fixable | boolean | YES | false |
| fix_detail | text | YES | — |

---

## generator_runs

Migration: `supabase/migrations/20260619000000_failover_infrastructure.sql` (file schema diverged — live wins)

| column | type | nullable | default | drift |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | — |
| started_at | timestamptz | NO | now() | — |
| ended_at | timestamptz | YES | — | **LIVE_ONLY** (file had `finished_at`) |
| trigger | text | NO | — | **LIVE_ONLY** (not in file) |
| drafts_attempted | integer | NO | 0 | **LIVE_ONLY** (file had `total_attempted`) |
| drafts_succeeded | integer | NO | 0 | **LIVE_ONLY** (not in file) |
| drafts_lint_failed | integer | NO | 0 | **LIVE_ONLY** (not in file) |
| drafts_deferred | integer | NO | 0 | **LIVE_ONLY** (not in file) |
| drafts_routed_to_review | integer | NO | 0 | **LIVE_ONLY** (not in file) |
| provider_stats | jsonb | YES | — | **LIVE_ONLY** (not in file) |
| notes | text | YES | — | — |

> Migration file had `total_attempted`, `gemini_ok`, `cerebras_ok`, `failed`, `skipped`, `finished_at`. All replaced in live DB. **Live wins — locked in PR-2b-3.5.** No migration needed.

---

## guides

Migration: `supabase/migrations/20260525000000_guides.sql`

| column | type | nullable | default | drift |
|---|---|---|---|---|
| id | bigint | NO | — | — |
| slug | text | NO | — | — |
| title | text | NO | — | — |
| excerpt | text | YES | — | — |
| content | text | YES | — | — |
| category | text | YES | — | — |
| featured_image_url | text | YES | — | **MISMATCH** — code sends `hero_image` |
| read_time_minutes | integer | YES | — | — |
| published_at | timestamptz | YES | now() | — |
| updated_at | timestamptz | YES | now() | — |

> **Drift:** `publishOneDraft` sends `hero_image`, `seo_title`, `seo_description` — none exist in live schema. Table has `featured_image_url` instead. Reconciliation decision: **code-wins** — migrate guides to add `hero_image`, `seo_title`, `seo_description`; backfill `featured_image_url → hero_image` for existing 9 rows; deprecate `featured_image_url`.

---

## news_articles

Migration: `scripts/schema.sql` + `scripts/migrations/002_content_updated_at.sql`

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| title | text | NO | — |
| slug | text | NO | — |
| content | text | NO | — |
| category | text | NO | 'New Sets' |
| excerpt | text | NO | — |
| hero_image | text | YES | — |
| published_at | timestamptz | YES | now() |
| seo_title | text | YES | — |
| seo_description | text | YES | — |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

---

## newsletter_subscribers

Migration: `scripts/schema.sql` + `supabase/migrations/20260510000000_newsletter_rls_hardening.sql`

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| email | text | NO | — |
| subscribed_at | timestamptz | YES | now() |
| is_active | boolean | YES | true |

---

## pending_drafts

Migration: `supabase/migrations/20260503000000_pending_drafts.sql` + subsequent amendments

| column | type | nullable | default | drift |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | — |
| source_url | text | NO | — | — |
| source_title | text | NO | — | — |
| source_excerpt | text | YES | — | — |
| source_published_at | timestamptz | YES | — | — |
| draft_title | text | YES | — | — |
| draft_body | text | YES | — | — |
| draft_verdict | text | YES | — | — |
| draft_format | text | YES | — | — |
| word_count | integer | YES | — | — |
| status | text | NO | 'draft' | — |
| lint_results | jsonb | YES | — | — |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | — |
| approved_at | timestamptz | YES | — | — |
| approved_by | text | YES | — | — |
| published_url | text | YES | — | — |
| iteration_label | text | YES | — | — |
| provider | text | YES | — | — |
| requires_manual_approval | boolean | NO | false | — |
| lint_result | jsonb | YES | — | — |
| discard_reason | text | YES | — | **LIVE_ONLY** — no migration file adds this column |

> **Drift:** `discard_reason` column exists in live DB with no corresponding migration. Also missing `published_at timestamptz` (PR-2b-3.6 reconciliation adds this).  
> Note: both `lint_results` (jsonb, older) and `lint_result` (jsonb, newer) coexist — consolidation candidate.

---

## posted_lego_sets ⚠️ ORPHANED

Migration: **NONE**  
Code references: **0**

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO | — |
| set_id | character varying | NO | — |
| title | character varying | YES | — |
| posted_at | timestamptz | YES | now() |

> **No migration file. No code references anywhere in src/ or scripts/.** Drop candidate — confirm nothing writes to it before dropping.

---

## posted_sets

Migration: `supabase/migrations/20260524000000_posted_sets.sql`

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO | — |
| set_num | text | NO | — |
| set_name | text | YES | — |
| posted_at | timestamptz | YES | now() |
| ig_feed_posted | boolean | YES | false |
| ig_reels_posted | boolean | YES | false |
| yt_shorts_posted | boolean | YES | false |

> Code refs: `health-check.mjs` (read last posted_at), `technical-hygiene.mjs` (read last row). Written by social pipeline (Python). Active.

---

## price_history

Migration: `scripts/migrations/001_store_prices.sql`

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| set_id | text | NO | — |
| store_id | text | NO | — |
| price_inr | numeric | YES | — |
| recorded_at | timestamptz | NO | now() |

> Append-only price log. Active: read by deals/price-drops pages; written by `scrape-now.mjs`.

---

## price_snapshots

Migration: `db/migrations/001_price_snapshots.sql`

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO | nextval('price_snapshots_id_seq') |
| set_num | text | NO | — |
| store | text | NO | — |
| price_inr | integer | NO | — |
| in_stock | boolean | NO | — |
| snapshot_date | date | NO | — |
| captured_at | timestamptz | NO | now() |

> Daily snapshot table. Active: `snapshot-prices.js` writes, `technical-hygiene.mjs` reads.

---

## prices ⚠️ EFFECTIVELY DEAD

Migration: `scripts/schema.sql`

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| set_id | uuid | YES | — |
| store_name | text | NO | — |
| store_url | text | NO | — |
| price_inr | integer | YES | — |
| availability | text | YES | 'unknown' |
| buy_url | text | NO | — |
| scraped_at | timestamptz | YES | now() |
| is_active | boolean | YES | true |

> **1 code reference** — `technical-hygiene.mjs:1044` probe only (`.select('id').limit(1)`). No scraper writes to it; `store_prices` is the active table (35+ refs). Deprecation/drop candidate for Phase B.

---

## raw_signals ⚠️ LIVE_ONLY (no migration file)

Migration: **NONE — created directly in DB**  
Code refs: 9+ (RADAR pipeline: fetch-rss.js, dedupe-signals.js, classify-signals.js, YoutubeStrip.tsx, health-check.mjs, technical-hygiene.mjs)

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| source_name | text | NO | — |
| source_tier | integer | NO | — |
| source_type | text | NO | — |
| external_id | text | YES | — |
| url | text | NO | — |
| url_hash | text | NO | — |
| title | text | NO | — |
| title_hash | text | NO | — |
| body | text | YES | — |
| published_at | timestamptz | YES | — |
| fetched_at | timestamptz | NO | now() |
| raw_payload | jsonb | YES | — |
| dedup_status | text | NO | 'pending' |
| dedup_group_id | uuid | YES | — |
| created_at | timestamptz | NO | now() |

> **Critical table with no migration file.** Phase C must write a `CREATE TABLE IF NOT EXISTS` migration for this table so it can be reproduced from scratch.

---

## reviews

Migration: `scripts/schema.sql` + `supabase/migrations/20260514000000_reviews_schema_hardening.sql`

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| set_id | uuid | YES | — |
| title | text | NO | — |
| slug | text | NO | — |
| content | text | NO | — |
| verdict | text | NO | — |
| rating | integer | YES | — |
| youtube_url | text | YES | — |
| published_at | timestamptz | YES | now() |
| created_at | timestamptz | YES | now() |
| hero_image | text | YES | — |
| excerpt | text | YES | — |
| seo_title | text | YES | — |
| seo_description | text | YES | — |
| updated_at | timestamptz | NO | now() |

---

## sets

Migration: `scripts/schema.sql` + `supabase/migrations/20260528000000_sets_retirement_columns.sql`

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| set_number | text | NO | — |
| name | text | NO | — |
| theme | text | NO | '' |
| subtheme | text | YES | — |
| year | integer | YES | — |
| pieces | integer | YES | — |
| minifigs | integer | YES | — |
| image_url | text | YES | — |
| description | text | YES | — |
| age_range | text | YES | — |
| lego_mrp_inr | integer | YES | — |
| rebrickable_id | text | YES | — |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| retirement_date | date | YES | — |
| is_retiring_soon | boolean | NO | false |
| retired | boolean | NO | false |

> Last 3 columns added by retirement migration. A2 export was truncated before these — derived from migration file.

---

## social_automation_heartbeat

Migration: `supabase/migrations/20260617000000_social_automation_heartbeat.sql`

| column | type | nullable | default |
|---|---|---|---|
| platform | text | NO | — (PRIMARY KEY) |
| last_attempt_at | timestamptz | YES | — |
| last_success_at | timestamptz | YES | — |
| last_failure_at | timestamptz | YES | — |
| last_error | text | YES | — |
| updated_at | timestamptz | NO | now() |

> Seeded with rows for `instagram` and `youtube`. Written by social pipeline (Python). Read by `health-check.mjs`.

---

## store_prices

Migration: `scripts/migrations/001_store_prices.sql`

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| set_id | text | NO | — |
| store_id | text | NO | CHECK IN ('toycra','mybrickhouse','jaiman') |
| price_inr | numeric | YES | — |
| in_stock | boolean | NO | false |
| product_url | text | NO | — |
| scraped_at | timestamptz | NO | now() |

> **Primary active price table.** 35+ code references across all listing pages, scraper, generator, health-check. `store_id` CHECK constraint in migration — verify if `jaiman` is still a valid value in live data.

---

## Drift summary

| Table | Status | Action |
|---|---|---|
| `generator_runs` | LIVE_ONLY columns (live richer than file) | **Locked** — live wins, no migration needed (PR-2b-3.5) |
| `guides` | MISMATCH — `featured_image_url` vs `hero_image`/`seo_*` | Migrate: add `hero_image`, `seo_title`, `seo_description`; backfill; deprecate `featured_image_url` |
| `pending_drafts` | `discard_reason` LIVE_ONLY; missing `published_at` | Migrate: add `published_at`; document `discard_reason` |
| `raw_signals` | LIVE_ONLY — no migration file at all | Write `CREATE TABLE IF NOT EXISTS` migration |
| `posted_lego_sets` | ORPHANED — no migration, no code refs | Confirm no writers, then DROP |
| `prices` | Effectively dead — 1 probe ref only | Deprecate; drop after confirming no hidden writers |
| `sets` | A2 export truncated; retirement cols derived from file | Verify live has `retirement_date`, `is_retiring_soon`, `retired` |

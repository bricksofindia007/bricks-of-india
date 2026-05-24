# Monitoring Schedule

**Last updated:** 2026-05-24

---

## Automated checks (GitHub Actions — add to existing workflows)

All checks below should be implemented as GitHub Actions jobs or added to existing crons. None are currently automated.

### Weekly — add to `radar.yml` or new `health-check.yml`

| Check | Condition | Alert |
|-------|-----------|-------|
| RADAR health | `raw_signals` row count grew by ≥1 this week | Fail if 0 new rows — cron may be broken |
| Social automation | `posted_sets` row count grew by ≥1 this week | Fail if 0 new rows — pipeline may be broken |
| /news freshness | Last `news_articles.published_at` ≤ 7 days ago | Error if >7 days stale |
| Supabase Storage | `social-assets` bucket usage ≤ 5GB | Warning if >5GB |
| IG token expiry | Days until IG token expires ≥ 7 | Alert at exactly 7 days remaining |

**Implementation note for IG token expiry:** Store token expiry date (2026-07-23) as a GitHub Actions variable or hardcoded constant. Check `(expiry_date - today).days`. Trigger Resend email alert to `abhinav@bricksofindia.com` when ≤ 7.

### Proposed `health-check.yml` skeleton

```yaml
name: Health Check
on:
  schedule:
    - cron: '0 4 * * 1'  # Every Monday 04:00 UTC (09:30 IST)
  workflow_dispatch:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Check RADAR signals
        # Query Supabase raw_signals for new rows this week
      - name: Check posted_sets
        # Query Supabase posted_sets for new rows this week
      - name: Check /news freshness
        # Query news_articles for most recent published_at
      - name: Check IG token expiry
        # Calculate days until 2026-07-23
      - name: Send alert if any check fails
        # Resend email to abhinav@bricksofindia.com
```

---

## Monthly manual checks

Run on the first Monday of each month.

| Check | What to look at | Where |
|-------|----------------|-------|
| Domain Authority trend | DA score — record and compare to last month | Moz Link Explorer or Ahrefs free |
| Google Search Console | Impressions, clicks, CTR, average position — record snapshot | GSC Performance tab |
| Backlink profile | Any new backlinks? Quality? Anchor text? | GSC Links tab or Ahrefs |
| Fan CoLab dossier | Progress vs. timeline — CE items completed, LAB items live | `docs/CONTENT_ENGINE_STATUS.md` + `docs/LAB_ROADMAP.md` |
| IG token health | Check days remaining on current token | `.env` / GitHub Secret expiry date |
| posted_sets count | How many sets have been posted? Any gaps (days with no post)? | Supabase table |
| Content freshness | /news, /blog, /reviews — days since last post | Supabase tables |

**Time required:** ~30–45 minutes

---

## Quarterly manual checks

Run in: September 2026, December 2026, March 2027.

| Check | What to look at | Notes |
|-------|----------------|-------|
| Full SEO audit | Lighthouse on all page types, Core Web Vitals, structured data | Use PageSpeed Insights + Google Rich Results Test |
| Content strategy review | What's getting traffic? What isn't? What should we stop? | GSC Performance + user engagement patterns |
| Competitor analysis | Brickset, Brick Fanatics, Jay's Brick Blog — what are they doing that BOI isn't? | Manual review |
| Fan CoLab post-mortem (Sept 2026) | Did we get in? What worked? What didn't? | After August deadline |
| Price scraper health | Are all stores still being scraped correctly? Coverage? | `store_prices` table audit + scraper logs |
| Supabase data audit | Old/stale rows, storage usage, RLS policy review | Supabase dashboard |

**Time required:** ~2–3 hours

---

## Alert contacts

| Alert type | Recipient | Method |
|------------|-----------|--------|
| Pipeline failures (social automation) | abhinav@bricksofindia.com | Resend email (already wired) |
| Lint failures (article publish gate) | abhinav@bricksofindia.com | Resend email (already wired) |
| Health check failures | abhinav@bricksofindia.com | Resend email (to be wired in health-check.yml) |
| IG token expiry warning | abhinav@bricksofindia.com | Resend email (to be wired) |

---

## IG token calendar

| Date | Action |
|------|--------|
| 2026-07-16 | Alert fires — 7 days remaining |
| 2026-07-20 | **HARD DEADLINE** — re-exchange IG token. Use `GET /oauth/access_token` endpoint with current long-lived token to generate new 60-day token. Update `IG_ACCESS_TOKEN` in GitHub Secrets. |
| 2026-09-18 | Next expiry (60 days from 2026-07-20 exchange) |

Set a recurring calendar reminder: **every 55 days** from the last exchange date.

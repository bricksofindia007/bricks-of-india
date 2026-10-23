# How a release is measured on staging (deploy gate input)

Staging takes almost no real traffic, so a measurement cannot wait for visitors. It replays a load profile taken from production, on the staging Worker, for a fixed window. The gate checks the results below.

## What is measured
- **CPU per request, median,** for the candidate commit's Worker on staging, from the Cloudflare Workers analytics (CPU time per invocation, all invocations in the window). The value is the one the gate compares with the 108 ms line.
- **Error rate:** responses that are not 2xx or 3xx, over all requests in the window.
- **Requests measured:** the count of invocations in the window.
- **Page output:** the fixed URL list (below) is fetched from the candidate and from the rollback release (34faed19). The page rule (approved 23 Oct 2026): each page must have the same status and the same visible text, in order. The visible text is the body text: the head (title and metadata), scripts, styles, comments and markup are not compared, and build IDs and timestamps are ignored. The raw markup difference is reported as a count only and does not block.

## Load profile (committed file: docs/release/gates/load-profile.json)
- Built from production request logs for the last 7 days: route templates (for example `/sets/[slug]`, `/themes/[theme]/sort/[sort]`), each with its share of requests. Routes covering at least 90% of requests are listed. No IP addresses, no visitor identifiers, no query strings with personal data are stored.
- The profile file's SHA-256 goes into the measurement file (`load_profile_sha256`). A different profile is a different measurement.
- Concrete URLs are drawn from the staging database for each route, with a fixed random seed, so the same URLs are replayed every run.

## Window
- Rate: constant 1 request per second, spread across each minute, from the staging load generator (the scheduler Worker's staging cron, enabled only for the window and disabled after it). 25 hours in total: the first hour is warm-up and is excluded from every number. The next 24 hours are the sample (about 86,400 requests).
- `warmup_hours` = 1, `sample_hours` = 24, `requests_measured` = the sample count (must be at least 50,000).

## Representativeness check (run before the window starts; recorded in the measurement)
- Row counts on staging compared with production for `sets`, `store_prices` and `price_history`. The window is invalid if any count differs by more than 5%. Record both counts in the measurement file as `staging_rows` and `production_rows`.
- Staging must be on the candidate commit with the staging keys set; the same profile is used for each candidate.

## Pass
All of these, in the measurement file:
1. `cpu_median_ms` at or under 108.
2. `requests_measured` at least 50,000.
3. `error_rate` at or under 0.005.
4. `warmup_hours` at least 1 and `sample_hours` at least 24.
5. `page_diff_ok` true.
6. Row counts within 5% of production (`staging_rows` and `production_rows` present and in range; the gate checks the recorded numbers).
7. `load_profile_sha256` is the hash of the committed profile.

A measurement that fails any of these is not a pass, and a new window is needed. It does not carry over.

## Chain of evidence
- The measurement names the commit that ran (`measured_sha`). If the release commit differs only in docs, logs or this file, it is the same release.
- The approver (`approved_by`) and the rollback release (`rollback_target`) are recorded.

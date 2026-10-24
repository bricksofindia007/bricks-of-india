# How a release is measured on staging (deploy gate input)

Staging takes almost no real traffic, so a measurement cannot wait for visitors. It replays a load profile taken from production, on the staging Worker, for a fixed window. The gate checks the results below.

## What is measured
- **CPU per request, median,** for the candidate commit's Worker on staging, from the Cloudflare Workers analytics (CPU time per invocation, all invocations in the window). The value is the one the gate compares with the 108 ms line.
- **Error rate:** failed requests over all requests in the window, counted from each response's status. The load generator keeps counts per class and status in the flag store (key `loadgen:counts`, same KV namespace as `flag:v1`), for the window that starts at `LOADGEN_START`. The measurement reads them with the `counts` step, and the assembled record lists `response_summary` (total and failed). The Worker analytics error count is no longer used for the rate. A failed request is a server error (5xx), a timeout, a Worker exception, or a response whose status does not match its page class. A page class expects 2xx or 3xx; the not-found class expects 404. A correct 404 on the not-found class is not a failure. (Rule approved 24 Oct 2026, 12:23 IST.)
- **Requests measured:** the count of invocations in the window.
- **Page output:** the fixed URL list (below) is fetched from the candidate and from the rollback release (34faed19). The page rule (approved 23 Oct 2026): each page must have the same status and the same visible text, in order. The visible text is the body text: the head (title and metadata), scripts, styles, comments and markup are not compared, and build IDs and timestamps are ignored. The raw markup difference is reported as a count only and does not block.

## Load profile (committed file: docs/release/gates/load-profile.json)
- Built from production request logs for the last 7 days: route templates (for example `/sets/[slug]`, `/themes/[theme]/sort/[sort]`), each with its share of requests. Routes covering at least 90% of requests are listed. No IP addresses, no visitor identifiers, no query strings with personal data are stored.
- The profile file's SHA-256 goes into the measurement file (`load_profile_sha256`). A different profile is a different measurement.
- Concrete URLs are drawn from the staging database for each route, with a fixed random seed, so the same URLs are replayed every run.

## Window
- Rate: constant 1 request per second, spread across each minute, from the staging load generator. The scheduler Worker's staging schedule entry is always present, but the generator sends requests only while its flag (`loadgen_enabled`) is on and the time is inside the window; otherwise each minute is recorded as idle (`off` or `closed`) and nothing is sent. 25 hours in total: the first hour is warm-up and is excluded from every number. The next 24 hours are the sample (about 86,400 requests).
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

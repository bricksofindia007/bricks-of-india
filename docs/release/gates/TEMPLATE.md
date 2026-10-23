# Release measurement (deploy gate input)

The production deploy gate (`scripts/ci/deploy-gate.mjs`, job `deploy-gate` in `deploy-cloudflare.yml`) reads `docs/release/gates/current.json`. The file is not in the repo until a release has been measured, so the gate blocks every production deploy until one exists. How the measurement is taken, the window and the pass rules are in `MEASUREMENT.md`. Copy the block below to `current.json` and fill every field with real values.

```json
{
  "measured_sha": "<full commit SHA that ran on staging>",
  "cpu_median_ms": 0,
  "warmup_hours": 1,
  "sample_hours": 24,
  "requests_measured": 0,
  "error_rate": 0,
  "load_profile_sha256": "<SHA-256 of docs/release/gates/load-profile.json>",
  "staging_rows": { "sets": 0, "store_prices": 0, "price_history": 0 },
  "production_rows": { "sets": 0, "store_prices": 0, "price_history": 0 },
  "page_diff_ok": false,
  "rollback_target": "34faed19",
  "approved_by": "<owner>"
}
```

The gate also requires every required check to be green on the pull request head that produced the commit.

## Emergency override (outage or security only)
The deploy workflow has two inputs: `emergency_class` (`none`, `outage` or `security`) and `emergency_reason`. With a class set, the measurement rule is skipped. Required checks still apply. The reason must be at least 20 characters and is written to the log as `EMERGENCY OVERRIDE`. The production environment approval on the deploy job still applies: the owner approves it there.

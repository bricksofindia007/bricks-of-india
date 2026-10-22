# Release measurement (deploy gate input)

The production deploy gate (`scripts/ci/deploy-gate.mjs`, job `deploy-gate` in `deploy-cloudflare.yml`) reads `docs/release/gates/current.json`. The file is not in the repo until a release has been measured, so the gate blocks every production deploy until one exists. Copy this template to `current.json` in the release commit (or a docs-only commit after it), and fill every field with real values.

```json
{
  "measured_sha": "<full commit SHA that was deployed to staging and measured>",
  "cpu_median_ms": 0,
  "sample_hours": 0,
  "page_diff_ok": false,
  "rollback_target": "34faed19",
  "approved_by": "<owner>"
}
```

Rules the gate enforces:
- `measured_sha` is the commit that ran on staging. If the deployed commit differs, every changed file outside `docs/` and `logs/` blocks the release (re-measure).
- `cpu_median_ms` is the staging CPU per request, median, from the Cloudflare CPU card. It must be at or under 108 ms.
- `sample_hours` is the length of the measured window. It must be at least 24.
- `page_diff_ok` is true only after the page output of the fixed URL list matches the rollback release, apart from build IDs and timestamps.
- `rollback_target` must be the release the owner can return to (34faed19 for the current production).
- `approved_by` names the approver. The production environment approval is still required on top of this.

The gate also requires every required check to be green on the commit (for a merge commit, on the pull request head).

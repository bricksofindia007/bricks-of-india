#!/usr/bin/env python3
"""
Fails if any of the given GitHub Actions workflow files has a job (one that
specifies `runs-on`, i.e. a normal runner job, not a reusable-workflow call
via `uses:`) lacking a `timeout-minutes` value.

Why this exists: on 2026-08-18, video-generate-daily.yml's `generate` job
had no timeout-minutes, hung on a stalled apt-get update, and burned the
full GitHub Actions 6-hour default job ceiling before being cancelled --
silently eating that day's entire scheduled run. See CLAUDE.md's "all
workflows require timeout-minutes" rule.

Usage: python lint_workflow_timeouts.py <file1.yml> [file2.yml ...]
Scoped to specific files (the PR's changed workflow files), not the whole
.github/workflows/ directory -- see lint-workflows.yml's comment for why:
two pre-existing files (video-feasibility-test.yml,
video-script-gen-test-quiet-panic.yml) don't have enough run history yet to
size a real timeout and are deliberately left for manual setting, so a
directory-wide check would permanently fail on unrelated PRs until someone
fixes those two specifically.
"""
import sys
import yaml

if len(sys.argv) < 2:
    print("No workflow files given -- nothing to check.")
    sys.exit(0)

violations = []
for path in sys.argv[1:]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            doc = yaml.safe_load(f)
    except (OSError, yaml.YAMLError) as e:
        violations.append(f"{path}: could not read/parse ({e})")
        continue

    jobs = (doc or {}).get("jobs", {})
    for job_name, job in jobs.items():
        if not isinstance(job, dict):
            continue
        if "uses" in job:
            continue  # reusable workflow call, not a normal runner job
        if "runs-on" not in job:
            continue  # exotic job shape, not what this rule targets
        if "timeout-minutes" not in job:
            violations.append(f"{path}: job '{job_name}' has no timeout-minutes")

if violations:
    print("FAIL: the following jobs are missing timeout-minutes:")
    for v in violations:
        print(f"  - {v}")
    print()
    print("Add timeout-minutes: <N> to each job listed above (~2-2.5x its")
    print("observed normal runtime -- gh run list --workflow=<file> --limit 10")
    print("to measure it). If there isn't enough run history yet to size it")
    print("(fewer than ~3 completed runs), that's a real exception -- flag it")
    print("for a human to set once there's real data, don't guess.")
    sys.exit(1)

print(f"OK: {len(sys.argv) - 1} changed workflow file(s) checked, every job has timeout-minutes.")

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
size a real timeout and are deliberately left for manual setting.

That diff-scoping alone isn't sufficient, though: PR #43 (2026-08-19) added
GROQ_API_KEY to those same two files for an unrelated reason (new fallback
provider secret), which pulled them into the changed-files set and broke
the "unrelated PRs won't be blocked" assumption above on this PR itself --
verified via `gh run list --workflow=<file> --limit 10`, which showed only
2 completed runs for video-feasibility-test.yml and 0 for
video-script-gen-test-quiet-panic.yml, both below the ~3-run minimum needed
to size a real value (not just still-unscoped-by-luck). So an explicit
exemption list is needed too, independent of diff scoping. Remove an entry
here once that file has enough real run history for a human to size
timeout-minutes properly -- this is a deliberate, temporary carve-out, not
a general escape hatch.
"""
import os
import sys
import yaml

# See module docstring. Keyed by basename so it matches regardless of the
# path form (relative/absolute) the caller passes.
NO_TIMEOUT_HISTORY_YET = {
    "video-feasibility-test.yml",
    "video-script-gen-test-quiet-panic.yml",
}

if len(sys.argv) < 2:
    print("No workflow files given -- nothing to check.")
    sys.exit(0)

violations = []
skipped = []
for path in sys.argv[1:]:
    if os.path.basename(path) in NO_TIMEOUT_HISTORY_YET:
        skipped.append(path)
        continue
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

if skipped:
    print(f"SKIPPED (no timeout history yet, see NO_TIMEOUT_HISTORY_YET): {', '.join(skipped)}")
checked = len(sys.argv) - 1 - len(skipped)
print(f"OK: {checked} changed workflow file(s) checked, every job has timeout-minutes.")

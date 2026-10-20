# npm audit exception: build-time advisory, granted 20 Oct 2026

**Review by: 18 Jan 2027 (90 days).** After that date the exception lapses and the code audit fails until it is renewed or the fix ships.

**Owner sign-off:** pending (Abhinav). This entry is accepted in `.github/npm-audit-accepted.json` only for the branch of PR 704 until the owner signs.

## The advisory

| Field | Value |
|---|---|
| Advisory | GHSA-vfj7-8cjw-p6xm |
| Package | `braces` (3.0.3 is the highest version in its range; no patched 3.x release) |
| Title | braces vulnerable to stack-exhaustion denial of service through deeply nested patterns |
| Severity | high (CVSS 3.1 7.5, CWE-674) |
| Affected range | `<= 3.0.3` |

## The packages npm reports under it

All seven reach the advisory through `braces`. None has its own advisory.

| Package | Path to `braces` | Where it runs |
|---|---|---|
| `braces` | direct | build tooling only |
| `micromatch` | `braces` | tailwindcss build, fast-glob |
| `chokidar` | `braces` | tailwindcss build (file watching in dev) |
| `fast-glob` | `micromatch` | `@next/eslint-plugin-next` (lint) |
| `tailwindcss` | `chokidar`, `fast-glob`, `micromatch` | CSS build |
| `@next/eslint-plugin-next` | `fast-glob` | lint only |
| `eslint-config-next` | `@next/eslint-plugin-next` | lint only |

## Why it cannot reach visitors

1. **No production dependency includes any of these packages.** `npm ls --omit=dev` returns an empty tree for all seven names (checked on the PR 704 branch, 20 Oct 2026).
2. **The affected code runs at build time or in lint, not in the deployed site.** Tailwind and the eslint plugin are used only while the build and lint run. Visitors receive the compiled output; the runtime does not import these packages.
3. **The denial of service needs attacker-controlled glob patterns** to reach `braces` at runtime. No runtime code in the site accepts patterns from a request, a form, or a database row. Tailwind and the eslint plugin pass only fixed patterns from the repository's own config.
4. **A visitor cannot trigger a build.** Builds run in GitHub Actions from repository commits, and only maintainers can push to `main` or dispatch deploys.

## Why there is no fix yet

- No `braces` release in the 3.x line is patched. The patched versions npm offers are in different majors reached through a tailwindcss 4 migration, which is not in scope for Bundle 2.
- npm's suggested fix for the eslint plugin and config is a downgrade to 14.2.35 while the project uses Next 15.5. That is not acceptable.

## Plan

- Upgrade tailwindcss to 4.x and the eslint plugin to a patched release after Bundle 2 (draft note: `docs/security/upgrade-after-bundle2-DRAFT.md`).
- Renew this exception on or before 18 Jan 2027 only if that upgrade is still open, with the reason written here.

## What this exception does not cover

Any other high or critical advisory fails the code audit. The check for that is `scripts/ci/npm-audit-check.mjs`, proven by `tests/npm-audit-check.test.ts`.

## Reconciliation of the counts (checked against the Dependabot API, 20 Oct 2026)

GitHub's open Dependabot alerts on the default branch: **72** (1 critical, 43 high, 25 medium, 3 low). By manifest:

| Manifest | Open alerts | Read by `npm audit`? |
|---|---|---|
| `package-lock.json` | 17 | yes: matches npm audit's 17 before the fix |
| `social-automation/requirements.txt` | 21 | no (Python) |
| `scripts/video/requirements.txt` | 17 | no (Python) |
| `scripts/shareables/requirements.txt` | 17 | no (Python) |

So the 72 is 17 npm alerts plus 55 Python alerts. `npm audit` never reads the Python files. The npm side of this PR is the 17; the Python side is a separate, open item that this PR does not touch.

Current npm state on this branch (PR 704): 7 high, 0 moderate, 0 critical. npm counts each affected package, so one root advisory appears several times. The code audit's accepted-list check finds one unique root advisory, GHSA-vfj7-8cjw-p6xm, which is accepted above.

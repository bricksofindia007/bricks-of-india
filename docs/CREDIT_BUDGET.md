# Netlify Credit Budget

**Status: CALIBRATION CYCLE — provisional numbers.** Every figure below is a
first-pass estimate, not a settled allocation. It exists to give the
2026-08-23 emergency fix (see below) something concrete to check itself
against, not to be treated as historically accurate. Revisit and correct
once a full cycle's real usage has been observed post-fix.

## Why this document exists

2026-08-23: `netlify.toml`'s `ignore = "exit 0"` build-skip guard was
removed (commit `0055651`), which — combined with `deploy.yml`'s CLI
deploy step already being dead (`JSONHTTPError: Forbidden` under the
"Enforce deployment methods: Git-only" dashboard setting) — meant every
single push to `main` triggered a real Netlify native-git-integration
production deploy, billed at a flat 15 credits each, for 28 commits before
anyone noticed. `netlify.toml` was reverted to the old blanket
`ignore = "exit 0"` guard (commit `fc92f6c`, 2026-08-26) as an emergency
stop-gap — confirmed working (`fc92f6c`'s own deploy shows **Canceled** in
the Deploys tab).

That guard is deliberately the blunt "always skip" version, not a
conditional path-aware one — it stops native deploys entirely, including
ones that would matter. This document is the first step toward a real
budget instead of a permanent full block: a framework to size how much
deploy activity the credit balance can actually absorb per cycle, plus a
place to log the usage numbers that can't be pulled from git.

## The two-tier framework

### Tier 1 — Keep-alive reserve: 650 credits

Covers baseline non-deploy usage (Compute / Bandwidth / Requests — see the
manual log below) that keeps the site running regardless of how many times
`main` is pushed. Framed as **600 credits base + a 5% buffer = 650**.

> Note on the arithmetic: 600 × 1.05 rounds to 630, not 650 — the 650
> figure in use this cycle is a rounder, slightly more conservative number
> someone chose by hand rather than the literal 5% multiply-out. Both the
> 600 base itself and the exact buffer are provisional pending a real
> measurement (see manual log) — don't treat the precision of "650" as
> more settled than the 600 it's built on.

### Tier 2 — Deploy budget: 350 credits (~23 deploys) this cycle

350 credits ÷ 15 credits/deploy ≈ 23.3, i.e. **~23 real deploys** for the
whole cycle before Tier 2 is exhausted. "Real deploy" here means any
commit landing on `main` while no build-skip guard is active — exactly
the 28-in-one-morning pattern that triggered this document.

Tier 1 (650) + Tier 2 (350) sums to **1,000 credits/cycle** — stated here
as an arithmetic note on the two numbers above, not an independently
confirmed total plan allocation.

### Billing cycle

Resets **~22nd/23rd of each month** (exact day has floated by a day in
observed history — treat "22nd or 23rd" as the real uncertainty, not a
typo). Current cycle: **2026-08-23 → ~2026-09-22/23**.

## Automated Tier 2 tracking

`.github/workflows/credit-budget-check.yml` runs daily, counts real
commits to `main` since the current cycle's start date via plain
`git log`/`git rev-list` (no Netlify API, no new credentials — it reuses
the same `GITHUB_TOKEN` every workflow in this repo already has), and
multiplies by 15 to estimate credits spent against the Tier 2 budget
above. At 80% of budget it opens (or updates, if already open) a standing
tracking issue with a warning; at 100% it escalates the language. See the
workflow file itself for the exact logic.

This only covers Tier 2 (deploy count). It cannot see Tier 1 usage
(Compute/Bandwidth/Requests) — that side has no git-visible signal at all
and has to come from the dashboard. That's the next section.

## Manual usage log — Compute / Bandwidth / Requests

Not derivable from git or GitHub Actions — Netlify's Usage & billing
dashboard doesn't expose these over an API this project has access to
(and per the operating protocol, no new Netlify API token is being added
just to automate this). Fill in a new dated row here after checking the
dashboard (`Usage & billing` tab), most conveniently from a screenshot.

| Date checked | Compute (credits) | Bandwidth (credits) | Requests (credits) | Total non-deploy credits | Cycle-to-date % of Tier 1 (650) | Notes |
|---|---|---|---|---|---|---|
| _(fill in)_ | | | | | | |

Once at least one full cycle of real rows exists here, Tier 1's 600/650
figures above should be replaced with an actual observed number — that's
the "real post-fix measurement" this whole document is provisional
pending.

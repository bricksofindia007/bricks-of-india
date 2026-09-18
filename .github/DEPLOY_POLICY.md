# BOI Production Deploy Policy

Core principle: the question isn't "how much testing did this get" — it's
"if this is wrong, how would we ever find out, and how bad is it while we
don't know." Two real incidents from the 2026-09-17 session anchor this:
the Model Canary's gate_coherence_llm_judge() had silently gone fail-open
with no alert, and Netlify's auto-publish lock had quietly drifted to
unlocked with no one noticing. Neither was caught by CI going green — both
needed a deliberate human look.

## Tier 1 — Auto-approve, terminal proceeds, log it, don't ask

Qualifies only if every condition below is true:
1. No change to production runtime logic — docs, comments, CI/workflow YAML
   config, secrets-manifest metadata, or dependency lockfile-only bumps.
   OR a runtime-logic change independently verified with a real test
   against the actual system in the same session (real evidence returned,
   not just "CI passed").
2. Fully reversible — no irreversible data deletion; undoable by reverting
   the commit.
3. Does not touch anything on the Tier 2 list below, regardless of how
   well-tested it was.

Real example: PR #134 — config/metadata-only, zero runtime-logic change,
stripping logic proven against the real Meta Graph API endpoint before
merge.

## Tier 2 — Needs Abhinav's explicit approval, every time, no exceptions

Any one of these overrides Tier 1 eligibility:
1. Touches anything already gated for a reason — video pipeline approval
   logic (video_posts.status, reject_video_post), any coherence/quality-
   judge code (gate_coherence_llm_judge() and siblings), or anything else
   explicitly built to require deliberate human sign-off.
2. A new automation's first live run(s) — stays Tier 2 until it has an
   actual live track record, not just validated logic.
3. Irreversible data mutation at execution time — even if dry-run-tested,
   the live run stays Tier 2 until it's routine and already proven live.
4. Auth, credential-handling, or payment-adjacent CODE changes — not
   secret value rotation, which is routine.
5. Terminal's own report expresses uncertainty — hedge words like
   "likely," "probably," "not fully confirmed" are themselves a trigger.

Real example: PR #131 — well-verified, but touches
gate_coherence_llm_judge() directly. Stays Tier 2 permanently, not just
this once.

## Default rule

When genuinely uncertain which tier applies, default to Tier 2 — state
this as the explicit fallback, not an edge case to reason around.

## Tree-ancestry check

Before approving ANY deployment, terminal must check the full commit
ancestry being deployed — not just the diff of the commit under
classification. A deploy ships the entire tree at that commit, not an
incremental patch on top of whatever's currently live — so a commit that
looks Tier 1 in isolation can still carry an unapproved Tier 2 change if
one of its ancestors hasn't shipped yet.

If any ancestor commit in that tree contains changes that would
independently classify as Tier 2, the entire deployment is Tier 2,
regardless of how the specific commit being approved classifies on its
own.

State the ancestry check explicitly in the classification report — e.g.
"commit X is Tier 1 in isolation; checked ancestry back to Y; no
unapproved Tier 2 ancestors found" or "commit X is Tier 1 in isolation —
found unapproved Tier 2 ancestor Z, escalating to Tier 2."

**Why this exists:** 2026-09-18 incident. PR #136's redirect fix
(next.config.mjs) and slug-uniqueness guard (publish-draft.ts) were
correctly classified Tier 2 — the redirect couldn't be tested until
deployed, and the guard was type-checked but never exercised against real
duplicate-slug data. Terminal held that commit (467e0af) for Abhinav's
explicit approval, as required. Two later commits were then classified
and approved as Tier 1 in isolation — both genuinely docs-only diffs
against what was live (a DEPLOY_POLICY.md commit, then a
BOI_MASTER_TRACKER.md logging commit) — without checking that both were
descendants of the still-unapproved 467e0af. Approving either one
deployed the full tree, which included 467e0af's changes. The redirect
went live without Abhinav ever approving that specific commit. No harm
resulted (the redirect and guard both turned out to work correctly, per
real evidence gathered right after), but the process failure was real:
terminal shipped a commit that had explicitly been reported as held for
Abhinav's own decision.

## How Tier 2 reaches Abhinav

Every Tier 2 item is reported via chat with a recommendation already
attached. Abhinav's role is reading that line and giving a yes/no, not
independently evaluating the change himself.

## Logging

Every classification (tier + specific criterion that decided it) gets
logged to BOI_MASTER_TRACKER.md as it happens — both auto-approvals and
held items.

## Review cadence

Revisit after a few weeks of real use. Adjust criteria explicitly if
something slips through or everything lands in Tier 2.

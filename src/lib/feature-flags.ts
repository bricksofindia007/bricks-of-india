/**
 * TypeScript mirror of config/feature_flags.py -- see that file's docstring
 * for the full rationale (commit 7fc986d incident, 2026-08-16/17). Kept as
 * a separate file rather than a shared JSON config to avoid adding a
 * cross-language build/import dependency for a two-flag object; keep the
 * two files' values in sync by hand when either changes.
 *
 * Usage:
 *   import { FEATURE_FLAGS } from '@/lib/feature-flags';
 *   if (FEATURE_FLAGS.cerebrasFallbackEnabled) { ... }
 */

export const FEATURE_FLAGS = {
  // Cerebras fallback (article pipeline's generate-with-failover.ts; see
  // also config/feature_flags.py's 'cerebras_fallback_enabled' for the
  // Python-side video pipelines). Added 2026-08-19: Cerebras has been
  // payment-blocked (402 "Payment required") since at least 2026-08-18 and
  // Abhinav cannot add a payment method to that account. Fallback order is
  // now Gemini -> Groq (free tier, 429 on limit rather than a permanent
  // 402). The Cerebras integration code is kept intact, not deleted,
  // behind this flag -- so it can be re-enabled with a one-line diff if
  // billing is ever resolved. Leave false until Abhinav confirms Cerebras
  // billing is fixed.
  cerebrasFallbackEnabled: false,

  // Article-pipeline Groq fallback (groq.ts / generate-with-failover.ts).
  // Added 2026-08-22 (qwen rollout evidence pass): Groq previously fired
  // unconditionally whenever Gemini failed and a Groq key was configured,
  // targeting the now-decommissioned llama-3.3-70b-versatile (confirmed
  // dead, live 404) -- meaning every retryable Gemini failure fell through
  // to a Groq call that always 404'd, then (since cerebrasFallbackEnabled
  // is also false) threw BothProvidersFailedError, which per the 2026-06-28
  // recycle policy gets the draft DELETED, not retried. Swapping to a
  // working model behind the SAME unconditional call would put live qwen
  // output into production with zero review the moment this merges. This
  // flag stops that: Groq fallback is skipped entirely until Abhinav
  // explicitly enables it after reviewing the rollout's evidence (real TPM
  // probe + 3-sample sanity check against src/lib/hard-rules.ts).
  //
  // Flipped true 2026-08-22 (FINAL ARCHITECTURE PASS) per explicit
  // instruction, evidence reviewed -- this also restores a working
  // fallback for the silent-delete bug described above. IMPORTANT CAVEAT,
  // confirmed live via `gh secret list`: GROQ_API_KEY is NOT currently a
  // GitHub repo secret -- it only exists in a local scripts/test/.env
  // (explicitly marked "local/test credential only" when first provided).
  // Flipping this flag is therefore currently a functional no-op in
  // production: GroqProvider's fetch will still be attempted, but every
  // real scheduled workflow run has an empty apiKey, so Groq will 401
  // immediately and generateWithFailover() falls through to
  // BothProvidersFailedError exactly as before. Real Groq calls (and the
  // silent-delete fix) will not take effect until Abhinav adds
  // GROQ_API_KEY as an actual repo secret -- deliberately not done here,
  // per the earlier explicit instruction not to add it without a
  // dedicated decision. scripts/canary/model_canary.py's daily run
  // reports this exact condition ("SECRET NOT CONFIGURED") until resolved.
  articleGroqFallbackEnabled: true,

  // Which model groq.ts's GroqProvider targets, once
  // articleGroqFallbackEnabled above is true. Swapped 2026-09-17: qwen/
  // qwen3.6-27b (chosen 2026-08-22) was itself decommissioned without a
  // formal deprecations-page entry -- Groq rotates its Preview-tier Qwen
  // point releases (3-32b -> 3.6-27b -> 3.8-27b) without the same notice
  // as GA models, so pinning to one is exactly what killed this fallback
  // twice now (first llama-3.3-70b-versatile, then qwen3.6-27b). Moved to
  // openai/gpt-oss-120b -- Groq's own recommended replacement for BOTH
  // prior deprecations (console.groq.com/docs/deprecations) and a GA
  // production model, not Preview. Confirmed live via a real Groq API
  // call before this change shipped (model_canary.py workflow_dispatch
  // run, not just docs). Kept as its own flag value, not hardcoded in
  // groq.ts, so a future model swap or rollback is a one-line config
  // change.
  articleGroqFallbackModel: 'openai/gpt-oss-120b',
} as const;

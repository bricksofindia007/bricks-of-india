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
} as const;

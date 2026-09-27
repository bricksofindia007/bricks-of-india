import { unverifiedSetCitations, citationFeedback } from './set-identity';
import { buildSystemPrompt, buildUserPrompt, parseDraftResponse } from './prompts/draft-prompt';
import { GeminiProvider, GroqProvider, CerebrasProvider } from './providers';
import type { Provider } from './providers';
import { isCerebrasEligible } from './source-quality';
import { lintDraft, type LintResult } from './lint';
import { runHardRules, type HardRuleResult, type DraftFormat } from './hard-rules';
import { FEATURE_FLAGS } from './feature-flags';
import type { SupabaseClient } from '@supabase/supabase-js';

import { OPENER_FEEDBACK } from './opener-pattern';
export type DraftGenerationInput = {
  format: string;
  sourceTitle: string | null;
  sourceUrl: string;
  sourcePublishedAt?: string | null;
  setNumber?: string | null;
  fullBody?: string | null;
  sourceExcerpt: string | null;
  indiaPriceContext: string;
  // Opinion fortnightly cadence fallback path — see draft-prompt.ts.
  forceOpinionTake?: boolean;
};

export type GenerationOutcome = {
  title: string;
  body: string;
  verdict: string | null;
  rating: number | null;
  format: string;
  wordCount: number;
  provider: 'gemini' | 'groq' | 'cerebras';
  requiresManualApproval: boolean;
  failoverUsed: boolean;
  lintResult: LintResult | null;
  hardRules: HardRuleResult[];
  hardFail: boolean;
};

// Added 2026-06-28 (Abhinav, this session): "what fails through Gemini and
// Cerebras both should be put in a rejected category and recycled" — recycled
// clarified by Abhinav to mean deleted, not retried. This needs to be
// distinguishable from the more common case where Gemini fails non-retryably
// and Cerebras is never attempted at all (kept as a plain Error, still
// retried automatically next run — Abhinav confirmed only the genuinely-both-
// attempted-both-failed case should be deleted). String-matching error
// messages for this would be fragile; a dedicated error type is the same
// pattern already used for LintFailedError in publish-draft.ts.
// Widened 2026-08-19: was hardcoded to exactly Gemini+Cerebras. Fallback
// chain is now Gemini -> Groq -> (Cerebras, only if feature-flags.ts's
// cerebrasFallbackEnabled is true) -- fallbackProvider/fallbackMessage
// record whichever fallback was actually attempted last (Groq in the
// normal case, Cerebras only if that flag is on and Groq also failed).
// generate-approved-drafts.ts's consumer updated accordingly -- it used to
// read .cerebrasMessage directly, which would have silently misattributed
// a Groq failure as a Cerebras one if left as-is.
export class BothProvidersFailedError extends Error {
  constructor(
    public readonly geminiMessage: string,
    public readonly fallbackProvider: string,
    public readonly fallbackMessage: string,
  ) {
    super(`Both providers failed — Gemini: ${geminiMessage} | ${fallbackProvider}: ${fallbackMessage}`);
    this.name = 'BothProvidersFailedError';
  }
}

// Determines whether a Gemini error should trigger Cerebras failover.
// Only 429 and 5xx are retryable — parse errors and bad requests are not.
// SMOKE_TEST=1 widens to include 400 so a bad API key can simulate failover.
function isRetryableGeminiError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err));
  if (process.env.SMOKE_TEST === '1') return /\[4\d\d/.test(msg) || /\[5\d\d/.test(msg);
  return /\[429/.test(msg) || /\[5\d\d/.test(msg);
}

const vlog = (...args: unknown[]) => {
  if (process.env.SMOKE_TEST === '1') console.log('  [failover]', ...args);
};

function lintSummary(lint: LintResult | null): void {
  if (!lint || process.env.SMOKE_TEST !== '1') return;
  const g = lint.gates;
  const fmt = (label: string, r: { severity: string; reason?: string | null } | null) =>
    `    ${label.padEnd(16)} ${r ? r.severity.toUpperCase().padEnd(5) : 'n/a  '} ${r?.reason ?? ''}`;
  console.log('  [lint] gates:');
  console.log(fmt('wordCount', g.wordCount));
  console.log(fmt('indiaParagraph', g.indiaParagraph));
  console.log(fmt('verdict', g.verdict));
  console.log(fmt('factuality', g.factuality));
  console.log(fmt('sourceFidelity', g.sourceFidelity));
  console.log(`  [lint] overallPass: ${lint.overallPass}`);
  if (lint.warnings.length) console.log(`  [lint] warnings: ${lint.warnings.join(' | ')}`);
}

export async function generateWithFailover(
  input: DraftGenerationInput,
  sb: SupabaseClient,
  geminiKey: string,
  groqKey: string | undefined,
  cerebrasKey: string | undefined,
  batchOpeners?: string[],   // bodies accepted earlier in this same batch run (Gate 8 same-batch race fix, 2026-07-02)
): Promise<GenerationOutcome> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt   = buildUserPrompt(input);

  async function runLint(body: string, verdict: string | null, wordCount: number, title?: string): Promise<LintResult> {
    return lintDraft(
      {
        format: input.format,
        body,
        title,
        word_count: wordCount,
        verdict,
        source: {
          source_url:     input.sourceUrl,
          source_title:   input.sourceTitle,
          source_excerpt: input.sourceExcerpt,
        },
      },
      { supabase: sb, skipHeroImage: true, batchOpeners },
    );
  }

  // Gate 11 retry (2026-09-26): a draft whose set citations don't match the
  // article (Donkey Kong "(2000)"/10332 class) gets ONE regeneration from the
  // same provider with explicit feedback; the second draft is linted again and
  // stands or falls on its own -- no further retries (same pattern as #194).
  // One regeneration with explicit feedback for the gates that can be fixed by
  // telling the model what went wrong -- Gate 11 (citation identity) and
  // Gate 12 (banned opener, #194) -- then the second draft stands or falls on
  // its own. Both failing produce one combined REVISION REQUIRED, not two calls.
  async function lintWithFeedbackRetry(
    call: (userPromptOverride: string) => Promise<string>,
    first: ReturnType<typeof parseDraftResponse>,
  ): Promise<{ parsed: ReturnType<typeof parseDraftResponse>; lint: LintResult | null; retried: boolean }> {
    const lint = await runLint(first.body, first.verdict, first.wordCount, first.title).catch(() => null);
    const citationFailed = !!lint?.gates.citationIdentity && !lint.gates.citationIdentity.pass;
    const openerFailed = !!lint?.gates.openerPattern && !lint.gates.openerPattern.pass;
    if (!citationFailed && !openerFailed) return { parsed: first, lint, retried: false };
    const feedback: string[] = [];
    if (citationFailed) feedback.push(citationFeedback(await unverifiedSetCitations(sb, `${first.title}
${first.body}`)));
    if (openerFailed) feedback.push(OPENER_FEEDBACK);
    vlog(`Feedback gates failed (${[citationFailed && 'Gate 11', openerFailed && 'Gate 12'].filter(Boolean).join(', ')}) -- regenerating once with feedback`);
    try {
      const text = await call(`${userPrompt}

REVISION REQUIRED: ${feedback.join(' ')}`);
      const second = parseDraftResponse(text, input.format);
      const lint2 = await runLint(second.body, second.verdict, second.wordCount, second.title).catch(() => null);
      vlog(`After regeneration: Gate 11 ${lint2?.gates.citationIdentity?.pass === false ? 'FAIL' : 'ok'}, Gate 12 ${lint2?.gates.openerPattern?.pass === false ? 'FAIL' : 'ok'}`);
      return { parsed: second, lint: lint2, retried: true };
    } catch (err) {
      vlog(`Regeneration call failed: ${err instanceof Error ? err.message.slice(0, 120) : String(err)} -- keeping the failing first draft`);
      return { parsed: first, lint, retried: true };
    }
  }

  // ── Gemini first ─────────────────────────────────────────────────────────────
  const gemini = new GeminiProvider(geminiKey);
  let geminiErr: unknown = null;

  vlog('Attempting Gemini...');
  try {
    const { text } = await gemini.call({ systemPrompt, userPrompt });
    vlog('Gemini succeeded — running lint + Gate 7');
    const { parsed, lint } = await lintWithFeedbackRetry(
      async (up) => (await gemini.call({ systemPrompt, userPrompt: up })).text,
      parseDraftResponse(text, input.format),
    );
    const hardRules = runHardRules(parsed.body, input.format as DraftFormat, input.sourceUrl);
    const hardFail  = hardRules.some(r => !r.pass);
    lintSummary(lint);
    vlog(`Gate 7: hardFail=${hardFail} failures=${hardRules.filter(r => !r.pass).map(r => r.id).join(',') || 'none'}`);
    vlog(`Routing: provider=gemini requiresManualApproval=${hardFail} failoverUsed=false`);
    return {
      title: parsed.title,
      body:  parsed.body,
      verdict: parsed.verdict,
      rating: parsed.rating,
      format:  parsed.format,
      wordCount: parsed.wordCount,
      provider: 'gemini',
      requiresManualApproval: hardFail,
      failoverUsed: false,
      lintResult: lint,
      hardRules,
      hardFail,
    };
  } catch (err) {
    geminiErr = err;
  }

  // ── Decide whether to failover ────────────────────────────────────────────────
  const errMsg    = (geminiErr instanceof Error ? geminiErr.message : String(geminiErr)).slice(0, 120);
  const retryable = isRetryableGeminiError(geminiErr);
  vlog(`Gemini failed: ${errMsg}`);
  vlog(`Error classification: ${retryable ? 'RETRYABLE (429/5xx)' : 'NON-RETRYABLE — will not failover'}`);

  // Fallback chain: Groq always attempted (if a key is configured), then
  // Cerebras only if feature-flags.ts's cerebrasFallbackEnabled is true.
  // Added 2026-08-19 -- see that flag's docstring for why Cerebras moved to
  // opt-in (payment-blocked, 402, since 2026-08-18).
  // 2026-08-22 (qwen rollout): groqKey alone used to be enough to try Groq
  // unconditionally -- harmless while it targeted a dead model (always
  // 404'd, fell straight through), but see feature-flags.ts's
  // articleGroqFallbackEnabled docstring for why a working model behind
  // the same unconditional call is exactly what must NOT ship silently.
  const candidates: { name: 'groq' | 'cerebras'; provider: Provider }[] = [];
  if (groqKey && FEATURE_FLAGS.articleGroqFallbackEnabled) {
    candidates.push({ name: 'groq', provider: new GroqProvider(groqKey) });
  }
  if (cerebrasKey && FEATURE_FLAGS.cerebrasFallbackEnabled) {
    candidates.push({ name: 'cerebras', provider: new CerebrasProvider(cerebrasKey) });
  }

  if (!retryable || candidates.length === 0) {
    throw geminiErr;
  }

  // Same eligibility gate for every fallback candidate, not just Cerebras --
  // it checks the SOURCE content's quality (fullBody/excerpt length), not
  // anything provider-specific, so it applies regardless of which fallback
  // is being tried. Name kept as isCerebrasEligible (not renamed) to avoid
  // churn in source-quality.ts and its own tests; see that function's
  // docstring for the actual eligibility logic.
  const fullBodyLen = (input.fullBody ?? '').length;
  const excerptLen  = (input.sourceExcerpt ?? '').length;
  const eligible    = isCerebrasEligible({ source_excerpt: input.sourceExcerpt, fullBody: input.fullBody });
  vlog(`Fallback eligibility: fullBody_len=${fullBodyLen} excerpt_len=${excerptLen} → ${eligible ? 'ELIGIBLE' : 'INELIGIBLE (both < 200 chars)'}`);

  if (!eligible) {
    throw new Error(
      `Gemini failed (retryable) and fallback not eligible (fullBody and excerpt both < 200 chars): ${(geminiErr as Error).message}`,
    );
  }

  // ── Fallback attempts, in order ──────────────────────────────────────────────
  // Same probation-free, gates-only publish policy as the original
  // Cerebras-only path -- whichever fallback succeeds publishes identically
  // to Gemini.
  let parsed: ReturnType<typeof parseDraftResponse> | undefined;
  let usedProvider: 'groq' | 'cerebras' | undefined;
  let lastFallbackMsg = '';
  for (const { name, provider } of candidates) {
    vlog(`Triggering ${name} failover...`);
    try {
      const { text } = await provider.call({ systemPrompt, userPrompt });
      vlog(`${name} returned ${text.length} chars — parsing...`);
      parsed = parseDraftResponse(text, input.format);
      usedProvider = name;
      break;
    } catch (fallbackErr) {
      lastFallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      vlog(`${name} failed: ${lastFallbackMsg.slice(0, 120)}`);
    }
  }

  if (!parsed || !usedProvider) {
    // All configured/eligible fallbacks genuinely attempted and failed to
    // produce usable content — this is the case Abhinav's policy
    // (2026-06-28) targets for delete, distinct from Gemini-non-retryable-
    // fallback-never-tried (which stays a plain Error, still retried
    // automatically). fallbackProvider records whichever was tried last.
    const lastTried = candidates[candidates.length - 1]?.name ?? 'none';
    throw new BothProvidersFailedError((geminiErr as Error).message, lastTried, lastFallbackMsg);
  }
  vlog(`Parsed: title="${parsed.title.slice(0, 60)}" wordCount=${parsed.wordCount} verdict=${parsed.verdict}`);

  const usedCall = candidates.find((c) => c.name === usedProvider)!.provider;
  const retried = await lintWithFeedbackRetry(
    async (up) => (await usedCall.call({ systemPrompt, userPrompt: up })).text,
    parsed,
  );
  parsed = retried.parsed;
  const lint      = retried.lint;
  const hardRules = runHardRules(parsed.body, input.format as DraftFormat, input.sourceUrl);
  const hardFail  = hardRules.some(r => !r.pass);
  lintSummary(lint);
  vlog(`Gate 7: hardFail=${hardFail} failures=${hardRules.filter(r => !r.pass).map(r => r.id).join(',') || 'none'}`);
  vlog(`Routing: provider=${usedProvider} requiresManualApproval=${hardFail} failoverUsed=true`);

  return {
    title:   parsed.title,
    body:    parsed.body,
    verdict: parsed.verdict,
    rating:  parsed.rating,
    format:  parsed.format,
    wordCount: parsed.wordCount,
    provider: usedProvider,
    requiresManualApproval: hardFail,
    failoverUsed: true,
    lintResult: lint,
    hardRules,
    hardFail,
  };
}

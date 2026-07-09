import { buildSystemPrompt, buildUserPrompt, parseDraftResponse } from './prompts/draft-prompt';
import { GeminiProvider, CerebrasProvider } from './providers';
import { isCerebrasEligible } from './source-quality';
import { lintDraft, type LintResult } from './lint';
import { runHardRules, type HardRuleResult, type DraftFormat } from './hard-rules';
import type { SupabaseClient } from '@supabase/supabase-js';

export type DraftGenerationInput = {
  format: string;
  sourceTitle: string | null;
  sourceUrl: string;
  sourcePublishedAt?: string | null;
  setNumber?: string | null;
  fullBody?: string | null;
  sourceExcerpt: string | null;
  indiaPriceContext: string;
};

export type GenerationOutcome = {
  title: string;
  body: string;
  verdict: string | null;
  rating: number | null;
  format: string;
  wordCount: number;
  provider: 'gemini' | 'cerebras';
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
export class BothProvidersFailedError extends Error {
  constructor(
    public readonly geminiMessage: string,
    public readonly cerebrasMessage: string,
  ) {
    super(`Both providers failed — Gemini: ${geminiMessage} | Cerebras: ${cerebrasMessage}`);
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
  cerebrasKey: string | undefined,
  batchOpeners?: string[],   // bodies accepted earlier in this same batch run (Gate 8 same-batch race fix, 2026-07-02)
): Promise<GenerationOutcome> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt   = buildUserPrompt(input);

  async function runLint(body: string, verdict: string | null, wordCount: number): Promise<LintResult> {
    return lintDraft(
      {
        format: input.format,
        body,
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

  // ── Gemini first ─────────────────────────────────────────────────────────────
  const gemini = new GeminiProvider(geminiKey);
  let geminiErr: unknown = null;

  vlog('Attempting Gemini...');
  try {
    const { text } = await gemini.call({ systemPrompt, userPrompt });
    vlog('Gemini succeeded — running lint + Gate 7');
    const parsed    = parseDraftResponse(text, input.format);
    const lint      = await runLint(parsed.body, parsed.verdict, parsed.wordCount).catch(() => null);
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

  if (!retryable || !cerebrasKey) {
    throw geminiErr;
  }

  const fullBodyLen = (input.fullBody ?? '').length;
  const excerptLen  = (input.sourceExcerpt ?? '').length;
  const eligible    = isCerebrasEligible({ source_excerpt: input.sourceExcerpt, fullBody: input.fullBody });
  vlog(`Cerebras eligibility: fullBody_len=${fullBodyLen} excerpt_len=${excerptLen} → ${eligible ? 'ELIGIBLE' : 'INELIGIBLE (both < 200 chars)'}`);

  if (!eligible) {
    throw new Error(
      `Gemini failed (retryable) and Cerebras not eligible (fullBody and excerpt both < 200 chars): ${(geminiErr as Error).message}`,
    );
  }

  // ── Cerebras failover ─────────────────────────────────────────────────────────
  // Cerebras publishes identically to Gemini — gates-only, no probation.
  vlog('Triggering Cerebras failover...');
  const cerebras = new CerebrasProvider(cerebrasKey);
  vlog('Calling Cerebras gpt-oss-120b...');

  let parsed: ReturnType<typeof parseDraftResponse>;
  try {
    const { text } = await cerebras.call({ systemPrompt, userPrompt });
    vlog(`Cerebras returned ${text.length} chars — parsing...`);
    parsed = parseDraftResponse(text, input.format);
  } catch (cerebrasErr) {
    // Both providers genuinely attempted and both failed to produce usable
    // content — this is the case Abhinav's policy (2026-06-28) targets for
    // delete, distinct from Gemini-non-retryable-Cerebras-never-tried (which
    // stays a plain Error, still retried automatically). Covers both a real
    // Cerebras API/network failure and a malformed/unparseable Cerebras
    // response (empty output, missing BOI_DRAFT markers) — either way,
    // Cerebras did not deliver usable content.
    const cerebrasMsg = cerebrasErr instanceof Error ? cerebrasErr.message : String(cerebrasErr);
    vlog(`Cerebras also failed: ${cerebrasMsg.slice(0, 120)}`);
    throw new BothProvidersFailedError((geminiErr as Error).message, cerebrasMsg);
  }
  vlog(`Parsed: title="${parsed.title.slice(0, 60)}" wordCount=${parsed.wordCount} verdict=${parsed.verdict}`);

  const lint      = await runLint(parsed.body, parsed.verdict, parsed.wordCount).catch(() => null);
  const hardRules = runHardRules(parsed.body, input.format as DraftFormat, input.sourceUrl);
  const hardFail  = hardRules.some(r => !r.pass);
  lintSummary(lint);
  vlog(`Gate 7: hardFail=${hardFail} failures=${hardRules.filter(r => !r.pass).map(r => r.id).join(',') || 'none'}`);
  vlog(`Routing: provider=cerebras requiresManualApproval=${hardFail} failoverUsed=true`);

  return {
    title:   parsed.title,
    body:    parsed.body,
    verdict: parsed.verdict,
    rating:  parsed.rating,
    format:  parsed.format,
    wordCount: parsed.wordCount,
    provider: 'cerebras',
    requiresManualApproval: hardFail,
    failoverUsed: true,
    lintResult: lint,
    hardRules,
    hardFail,
  };
}

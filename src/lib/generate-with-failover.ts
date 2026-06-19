import { buildSystemPrompt, buildUserPrompt, parseDraftResponse } from './prompts/draft-prompt';
import { GeminiProvider, CerebrasProvider } from './providers';
import { isCerebrasEligible } from './source-quality';
import { getCerebrasGraduationStatus, requiresManualApproval } from './cerebras-graduation';
import { lintDraft, type LintResult } from './lint';
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
  format: string;
  wordCount: number;
  provider: 'gemini' | 'cerebras';
  requiresManualApproval: boolean;
  failoverUsed: boolean;
  lintResult: LintResult | null;
};

// Determines whether a Gemini error should trigger Cerebras failover.
// Only 429 and 5xx are retryable — parse errors and bad requests are not.
// SMOKE_TEST=1 widens to include 400 so a bad API key can simulate failover.
function isRetryableGeminiError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err));
  if (process.env.SMOKE_TEST === '1') return /\[4\d\d/.test(msg) || /\[5\d\d/.test(msg);
  return /\[429/.test(msg) || /\[5\d\d/.test(msg);
}

export async function generateWithFailover(
  input: DraftGenerationInput,
  sb: SupabaseClient,
  geminiKey: string,
  cerebrasKey: string | undefined,
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
      { supabase: sb, skipHeroImage: true },
    );
  }

  // ── Gemini first ─────────────────────────────────────────────────────────────
  const gemini = new GeminiProvider(geminiKey);
  let geminiErr: unknown = null;

  try {
    const { text } = await gemini.call({ systemPrompt, userPrompt });
    const parsed   = parseDraftResponse(text, input.format);
    const lint     = await runLint(parsed.body, parsed.verdict, parsed.wordCount).catch(() => null);
    return {
      title: parsed.title,
      body:  parsed.body,
      verdict: parsed.verdict,
      format:  parsed.format,
      wordCount: parsed.wordCount,
      provider: 'gemini',
      requiresManualApproval: false,
      failoverUsed: false,
      lintResult: lint,
    };
  } catch (err) {
    geminiErr = err;
  }

  // ── Decide whether to failover ────────────────────────────────────────────────
  if (!isRetryableGeminiError(geminiErr) || !cerebrasKey) {
    throw geminiErr;
  }

  if (!isCerebrasEligible({ source_excerpt: input.sourceExcerpt })) {
    throw new Error(
      `Gemini failed (retryable) and Cerebras not eligible (excerpt < 200 chars): ${(geminiErr as Error).message}`,
    );
  }

  // ── Cerebras failover ─────────────────────────────────────────────────────────
  const graduation   = await getCerebrasGraduationStatus(sb);
  const needsManual  = requiresManualApproval(graduation.graduated);
  const cerebras     = new CerebrasProvider(cerebrasKey);

  const { text } = await cerebras.call({ systemPrompt, userPrompt });
  const parsed   = parseDraftResponse(text, input.format);
  const lint     = await runLint(parsed.body, parsed.verdict, parsed.wordCount).catch(() => null);

  return {
    title:   parsed.title,
    body:    parsed.body,
    verdict: parsed.verdict,
    format:  parsed.format,
    wordCount: parsed.wordCount,
    provider: 'cerebras',
    requiresManualApproval: needsManual,
    failoverUsed: true,
    lintResult: lint,
  };
}

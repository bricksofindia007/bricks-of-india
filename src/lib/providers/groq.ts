import type { Provider, ProviderCallInput, ProviderCallResult } from './types';
import { FEATURE_FLAGS } from '../feature-flags';

// 2026-08-22 (qwen rollout evidence pass): default model swapped from the
// now-decommissioned llama-3.3-70b-versatile (confirmed dead, live 404) to
// FEATURE_FLAGS.articleGroqFallbackModel (qwen/qwen3.6-27b) -- see that
// flag's docstring for why this whole path is also gated behind
// articleGroqFallbackEnabled at the call site (generate-with-failover.ts),
// not just here. Kept as a fallback literal (not required) so a missing
// flag entry still resolves to a real model string rather than undefined.
const DEFAULT_GROQ_MODEL = 'qwen/qwen3.6-27b';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class GroqProvider implements Provider {
  readonly name = 'groq';

  constructor(private readonly apiKey: string) {}

  async call({ systemPrompt, userPrompt }: ProviderCallInput): Promise<ProviderCallResult> {
    const model = FEATURE_FLAGS.articleGroqFallbackModel || DEFAULT_GROQ_MODEL;
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      max_tokens:  2048,
      temperature: 0.7,
    };
    // reasoning_effort is a vendor-specific param -- qwen accepts only
    // 'none'/'default'; without it, qwen burns its whole output budget on
    // hidden <think> reasoning and returns empty content (confirmed
    // empirically during this rollout's VID-QP testing). Only applied for
    // the qwen family -- a future non-qwen reasoning model swap (e.g.
    // gpt-oss, which uses 'low'/'medium'/'high' instead) would need this
    // re-derived, not blindly reused.
    if (model.startsWith('qwen/')) {
      body.reasoning_effort = 'none';
    }

    // 429 handling: added 2026-08-22 after a real 429 was hit live during
    // this rollout's article-pipeline sanity testing (Groq's org-level
    // 8,000 TPM cap, same as VID-QP's). One bounded retry, honoring the
    // server's Retry-After header when present -- this is a single
    // fallback call, not a batch, so it doesn't need VID-QP's voice-test
    // 65s inter-call pacing, but giving up on the very first rate-limit
    // hit isn't real handling either.
    for (const attempt of [1, 2]) {
      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });

      if (res.status === 429) {
        if (attempt === 2) {
          const err = new Error('Groq 429: rate-limited after one retry');
          (err as any).retryable  = true;
          (err as any).statusCode = 429;
          throw err;
        }
        const retryAfter = res.headers.get('Retry-After');
        const delayMs = (retryAfter ? parseFloat(retryAfter) + 1 : 20) * 1000;
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err  = new Error(`Groq ${res.status}: ${text.slice(0, 200)}`);
        (err as any).retryable  = res.status >= 500;
        (err as any).statusCode = res.status;
        throw err;
      }

      const json = await res.json() as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const text = json.choices?.[0]?.message?.content;
      if (!text) throw new Error('Groq: empty response content');
      return { text, inputTokens: json.usage?.prompt_tokens, outputTokens: json.usage?.completion_tokens };
    }
    throw new Error('Groq call failed: unreachable retry exhaustion.');
  }
}

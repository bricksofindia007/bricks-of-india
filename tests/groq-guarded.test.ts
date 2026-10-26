// Groq fallback calls go through the shared AI call guard (config/ai-limits.json). A model that is not on the allowlist is
// refused before anything is sent. The allowlist gained exactly one model: the Groq model the fallback uses.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const flags = vi.hoisted(() => ({ articleGroqFallbackModel: 'openai/gpt-oss-120b' }));
vi.mock('../src/lib/feature-flags', () => ({ FEATURE_FLAGS: flags }));
vi.mock('../src/lib/spend-guard-pilot', () => ({
  guardAiCall: async () => ({ allowed: true, reason: null }),
  recordAiCall: async () => undefined,
}));

import { GroqProvider } from '../src/lib/providers/groq';

const root = join(__dirname, '..');
const config = JSON.parse(readFileSync(join(root, 'config/ai-limits.json'), 'utf8'));

const okResponse = () => new Response(
  JSON.stringify({ choices: [{ message: { content: 'draft text' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
  { status: 200, headers: { 'Content-Type': 'application/json' } },
);

describe('Groq fallback goes through the AI call guard', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    flags.articleGroqFallbackModel = 'openai/gpt-oss-120b';
    fetchMock = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('an allowlisted model is called and its text returned', async () => {
    const out = await new GroqProvider('test-value').call({ systemPrompt: 'sys', userPrompt: 'user' });
    expect(out.text).toBe('draft text');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a model that is not on the allowlist is refused before anything is sent', async () => {
    flags.articleGroqFallbackModel = 'qwen/qwen3.6-27b';
    await expect(new GroqProvider('test-value').call({ systemPrompt: 'sys', userPrompt: 'user' }))
      .rejects.toThrow(/model not on the allowlist: qwen\/qwen3.6-27b/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a server error fails the one guarded call; it is not retried outside the guard', async () => {
    fetchMock.mockImplementationOnce(async () => new Response('{}', { status: 500 }));
    fetchMock.mockImplementationOnce(async () => okResponse());
    await expect(new GroqProvider('test-value').call({ systemPrompt: 'sys', userPrompt: 'user' })).rejects.toThrow(/Groq 500/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('the allowlist', () => {
  it('lists the three Gemini models and the Groq fallback model, and nothing else', () => {
    expect(config.allowedModels).toEqual([
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-3.1-flash-lite',
      'openai/gpt-oss-120b',
    ]);
  });
  it('the per-run and per-call caps are unchanged by this change', () => {
    expect(config.perRun['generate-approved-drafts.ts']).toEqual({ maxCalls: 30, maxInputTokens: 300000 });
    expect(config.sites.draft).toEqual({ maxInputTokensPerCall: 15000 });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { createBudget, guardedCall, AiLimitError, geminiUsage, estimateTokens } from '../scripts/lib/ai-guard.mjs';

// A fake Gemini-style client: records what it was asked and returns a fixed usage.
function fakeCall(usage = { inputTokens: 1000, outputTokens: 50 }) {
  const invoke = vi.fn(async () => ({ text: 'ok', ...usage }));
  return invoke;
}

const SMALL = { system: 'You write short articles.', user: 'Write one article about a set.' };

describe('ai guard: model allowlist', () => {
  it('refuses a model that is not on the list, before any request', async () => {
    const alert = vi.fn();
    const budget = createBudget({ runName: 'generate-approved-drafts.ts', alert });
    const invoke = fakeCall();
    await expect(guardedCall({ site: 'draft', model: 'gemini-3.1-pro', ...SMALL, invoke, budget })).rejects.toBeInstanceOf(AiLimitError);
    expect(invoke).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('refuses any Pro model name', async () => {
    const budget = createBudget({ runName: 'generate-approved-drafts.ts', alert: vi.fn() });
    await expect(guardedCall({ site: 'draft', model: 'gemini-2.5-pro', ...SMALL, invoke: fakeCall(), budget })).rejects.toThrow(/allowlist/);
  });
});

describe('ai guard: per-call size', () => {
  it('refuses a request above the site limit, before any request', async () => {
    const alert = vi.fn();
    const budget = createBudget({ runName: 'generate-approved-drafts.ts', alert });
    const invoke = fakeCall();
    const huge = 'x'.repeat(200_000); // far above the draft limit
    await expect(guardedCall({ site: 'draft', model: 'gemini-2.5-flash-lite', system: 'sys', user: huge, invoke, budget })).rejects.toThrow(/too large/);
    expect(invoke).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('accepts a request just under the limit', async () => {
    const budget = createBudget({ runName: 'generate-approved-drafts.ts', alert: vi.fn() });
    const invoke = fakeCall();
    const under = 'x'.repeat(14_000); // about 4,667 estimated tokens, under the 15,000 draft limit
    await guardedCall({ site: 'draft', model: 'gemini-2.5-flash-lite', system: '', user: under, invoke, budget });
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe('ai guard: per-run caps', () => {
  it('stops at the call cap, alerts once, and makes no further call', async () => {
    const alert = vi.fn();
    const budget = createBudget({ runName: 'model_canary.py', alert }); // canary cap: 4 calls
    const invoke = fakeCall({ inputTokens: 10, outputTokens: 1 });
    for (let i = 0; i < 4; i++) {
      await guardedCall({ site: 'canary', model: 'gemini-2.5-flash', ...SMALL, invoke, budget });
    }
    await expect(guardedCall({ site: 'canary', model: 'gemini-2.5-flash', ...SMALL, invoke, budget })).rejects.toThrow(/call cap/);
    await expect(guardedCall({ site: 'canary', model: 'gemini-2.5-flash', ...SMALL, invoke, budget })).rejects.toThrow(/call cap/);
    expect(invoke).toHaveBeenCalledTimes(4);
    expect(alert).toHaveBeenCalledTimes(1); // one email per run, not one per refused call
  });

  it('stops at the input token cap and alerts', async () => {
    const alert = vi.fn();
    const budget = createBudget({ runName: 'model_canary.py', alert }); // canary cap: 4,000 input tokens per run
    const invoke = fakeCall({ inputTokens: 3_990, outputTokens: 1 });
    await guardedCall({ site: 'canary', model: 'gemini-2.5-flash', ...SMALL, invoke, budget }); // 3,990 used
    await expect(guardedCall({ site: 'canary', model: 'gemini-2.5-flash', ...SMALL, invoke, budget })).rejects.toThrow(/input token cap/);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('counts a failed request against the caps (a retry cannot dodge the limit)', async () => {
    const budget = createBudget({ runName: 'model_canary.py', alert: vi.fn() });
    const failing = vi.fn(async () => { throw new Error('503 UNAVAILABLE'); });
    for (let i = 0; i < 4; i++) {
      await expect(guardedCall({ site: 'canary', model: 'gemini-2.5-flash', ...SMALL, invoke: failing, budget })).rejects.toThrow('503');
    }
    expect(budget.calls).toBe(4);
    await expect(guardedCall({ site: 'canary', model: 'gemini-2.5-flash', ...SMALL, invoke: failing, budget })).rejects.toThrow(/call cap/);
  });
});

describe('ai guard: normal run', () => {
  it('passes unchanged and counts counts only', async () => {
    const alert = vi.fn();
    const budget = createBudget({ runName: 'generate-approved-drafts.ts', alert });
    const result = await guardedCall({ site: 'draft', model: 'gemini-2.5-flash-lite', ...SMALL, invoke: fakeCall({ inputTokens: 500, outputTokens: 80 }), budget });
    expect(result.text).toBe('ok');
    expect(budget.calls).toBe(1);
    expect(budget.inputTokens).toBe(500);
    expect(budget.outputTokens).toBe(80);
    expect(budget.models).toEqual({ 'gemini-2.5-flash-lite': 1 });
    expect(alert).not.toHaveBeenCalled();
  });

  it('falls back to the estimate when the response has no usage', async () => {
    const budget = createBudget({ runName: 'generate-approved-drafts.ts', alert: vi.fn() });
    await guardedCall({ site: 'draft', model: 'gemini-2.5-flash-lite', system: 'abc', user: 'defgh', invoke: async () => ({ text: 'x' }), budget });
    expect(budget.inputTokens).toBe(estimateTokens('abc') + estimateTokens('defgh'));
  });

  it('reads usage from a Gemini SDK result', () => {
    expect(geminiUsage({ response: { usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 } } })).toEqual({ inputTokens: 7, outputTokens: 3 });
  });

  it('an unlisted script gets the strict default caps', () => {
    const budget = createBudget({ runName: 'some-new-script.ts', alert: vi.fn() });
    expect(budget.name).toBe('default');
    expect(budget.maxCalls).toBe(10);
  });
});

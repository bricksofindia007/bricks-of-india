// Spend guard pilot (Groq): with the flag off nothing is read or written; with it on, a call is refused at the
// daily cap, at the rupee stop, and when the counts cannot be read; each successful call is recorded with its
// tokens and rupees.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const flags = vi.hoisted(() => ({ aiSpendGuardPilot: false }));
vi.mock('../src/lib/feature-flags', () => ({ FEATURE_FLAGS: flags }));

const db = vi.hoisted(() => ({ rows: [] as Array<{ provider: string; calls: number; input_tokens: number; output_tokens: number; rupees: number }>, readError: false, reads: 0, rpcs: [] as unknown[] }));
vi.mock('../src/lib/supabase', () => ({
  createServerClient: () => ({
    from: () => {
      const q = {
        select() { return q; },
        eq() { return q; },
        then(resolve: (v: unknown) => void) {
          db.reads++;
          resolve(db.readError ? { data: null, error: { message: 'down' } } : { data: db.rows, error: null });
        },
      };
      return q;
    },
    rpc: async (name: string, args: unknown) => {
      db.rpcs.push({ name, args });
      return { data: null, error: null };
    },
  }),
}));

import { guardAiCall, recordAiCall, usageDay } from '../src/lib/spend-guard-pilot';
import { config } from '../src/lib/spend-limits';

const root = join(__dirname, '..');
const NOW = new Date('2026-10-18T10:00:00Z');
const cap = config.ai.providers.groq.daily_calls;

beforeEach(() => {
  flags.aiSpendGuardPilot = false;
  db.rows = [];
  db.readError = false;
  db.reads = 0;
  db.rpcs = [];
});

describe('flag off', () => {
  it('allows the call without reading the counter', async () => {
    db.rows = [{ provider: 'groq', calls: cap, input_tokens: 0, output_tokens: 0, rupees: 0 }];
    expect(await guardAiCall('groq', NOW)).toEqual({ allowed: true, reason: null });
    expect(db.reads).toBe(0);
  });
  it('writes nothing when a call is recorded', async () => {
    await recordAiCall('groq', 'openai/gpt-oss-120b', 100, 50, NOW);
    expect(db.rpcs).toEqual([]);
  });
});

describe('flag on', () => {
  beforeEach(() => {
    flags.aiSpendGuardPilot = true;
  });
  it('allows a call under every cap', async () => {
    db.rows = [{ provider: 'groq', calls: 10, input_tokens: 500, output_tokens: 500, rupees: 0.5 }];
    expect(await guardAiCall('groq', NOW)).toEqual({ allowed: true, reason: null });
  });
  it('sums the day\'s rows for the provider across models', async () => {
    db.rows = [
      { provider: 'groq', calls: cap - 1, input_tokens: 10, output_tokens: 10, rupees: 0 },
      { provider: 'groq', calls: 1, input_tokens: 10, output_tokens: 10, rupees: 0 },
    ];
    expect(await guardAiCall('groq', NOW)).toEqual({ allowed: false, reason: 'groq daily limit reached' });
  });
  it('the rupee stop is the total across providers: a Groq call is refused when Gemini alone spent Rs 13', async () => {
    flags.aiSpendGuardPilot = true;
    db.rows = [{ provider: 'gemini', calls: 2, input_tokens: 100, output_tokens: 100, rupees: 13 }, { provider: 'groq', calls: 0, input_tokens: 0, output_tokens: 0, rupees: 0 }];
    const r = await guardAiCall('groq', NOW);
    expect(r.allowed).toBe(false);
  });  it('refuses at the rupee stop, even with calls and tokens under their caps', async () => {
    db.rows = [{ provider: 'groq', calls: 3, input_tokens: 1000, output_tokens: 1000, rupees: 13 }];
    expect((await guardAiCall('groq', NOW)).allowed).toBe(false);
  });
  it('refuses at the daily token cap', async () => {
    db.rows = [{ provider: 'groq', calls: 1, input_tokens: config.ai.providers.groq.daily_tokens, output_tokens: 0, rupees: 0 }];
    expect((await guardAiCall('groq', NOW)).allowed).toBe(false);
  });
  it('the day starts from zero: no rows means nothing used yet', async () => {
    db.rows = [];
    expect((await guardAiCall('groq', NOW)).allowed).toBe(true);
  });
  it('fails closed when the counts cannot be read', async () => {
    db.readError = true;
    expect(await guardAiCall('groq', NOW)).toEqual({ allowed: false, reason: 'usage unreadable' });
  });
  it('records one call with input and output tokens, and the rupees from the model price', async () => {
    await recordAiCall('groq', 'openai/gpt-oss-120b', 1000, 2000, NOW);
    expect(db.rpcs).toHaveLength(1);
    const args = (db.rpcs[0] as { args: Record<string, unknown> }).args;
    expect(args).toMatchObject({ p_day: '2026-10-18', p_provider: 'groq', p_model: 'openai/gpt-oss-120b', p_input: 1000, p_output: 2000 });
    // 0.15 and 0.60 USD per million at 95 INR per USD: (1000*0.15 + 2000*0.60) / 1e6 * 95 = Rs 0.12825.
    expect(args.p_rupees as number).toBeCloseTo(0.12825, 6);
  });
  it('an unpriced model records zero rupees, so its caps are the only control', async () => {
    await recordAiCall('groq', 'llama-3.3-70b-versatile', 1000, 1000, NOW);
    expect((db.rpcs[0] as { args: Record<string, unknown> }).args.p_rupees).toBe(0);
  });
  it('the day is the UTC date', () => {
    expect(usageDay(new Date('2026-10-18T23:30:00Z'))).toBe('2026-10-18');
  });
});

describe('wiring and flags', () => {
  it('the Groq provider checks the guard before it sends, and records after a response', () => {
    const src = readFileSync(join(root, 'src/lib/providers/groq.ts'), 'utf8');
    const guard = src.indexOf("await guardAiCall('groq')");
    const send = src.indexOf('await fetch(GROQ_API_URL');
    const record = src.indexOf("await recordAiCall('groq', model,");
    expect(guard).toBeGreaterThan(0);
    expect(send).toBeGreaterThan(guard);
    expect(record).toBeGreaterThan(send);
  });
  it('the pilot flag is off in both flag files', () => {
    expect(readFileSync(join(root, 'src/lib/feature-flags.ts'), 'utf8')).toMatch(/aiSpendGuardPilot: false,/);
    expect(readFileSync(join(root, 'config/feature_flags.py'), 'utf8')).toMatch(/"ai_spend_guard_pilot": False,/);
  });
});

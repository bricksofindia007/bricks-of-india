// Spend guard pilot (Groq): with the flag off nothing is read or written; with it on, a call is refused at the
// daily cap and when the counts cannot be read, and each successful call is recorded.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const flags = vi.hoisted(() => ({ aiSpendGuardPilot: false }));
vi.mock('../src/lib/feature-flags', () => ({ FEATURE_FLAGS: flags }));

const db = vi.hoisted(() => ({ row: null as null | { calls: number; tokens: number }, readError: false, reads: 0, rpcs: [] as unknown[] }));
vi.mock('../src/lib/supabase', () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({
        eq() { return this; },
        maybeSingle: async () => {
          db.reads++;
          return db.readError ? { data: null, error: { message: 'down' } } : { data: db.row, error: null };
        },
      }),
    }),
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
  db.row = null;
  db.readError = false;
  db.reads = 0;
  db.rpcs = [];
});

describe('flag off', () => {
  it('allows the call without reading the counter', async () => {
    db.row = { calls: cap, tokens: 0 };
    expect(await guardAiCall('groq', NOW)).toEqual({ allowed: true, reason: null });
    expect(db.reads).toBe(0);
  });
  it('writes nothing when a call is recorded', async () => {
    await recordAiCall('groq', 500, NOW);
    expect(db.rpcs).toEqual([]);
  });
});

describe('flag on', () => {
  beforeEach(() => {
    flags.aiSpendGuardPilot = true;
  });
  it('allows a call under the cap', async () => {
    db.row = { calls: 10, tokens: 1000 };
    expect(await guardAiCall('groq', NOW)).toEqual({ allowed: true, reason: null });
  });
  it('refuses at the daily call cap, with a reason', async () => {
    db.row = { calls: cap, tokens: 0 };
    expect(await guardAiCall('groq', NOW)).toEqual({ allowed: false, reason: 'groq daily cap reached' });
  });
  it('refuses at the daily token cap', async () => {
    db.row = { calls: 0, tokens: config.ai.providers.groq.daily_tokens };
    expect((await guardAiCall('groq', NOW)).allowed).toBe(false);
  });
  it('the day starts from zero: no row means nothing used yet', async () => {
    db.row = null;
    expect((await guardAiCall('groq', NOW)).allowed).toBe(true);
  });
  it('fails closed when the counts cannot be read', async () => {
    db.readError = true;
    expect(await guardAiCall('groq', NOW)).toEqual({ allowed: false, reason: 'usage unreadable' });
  });
  it('records one call with its tokens against the UTC day and provider', async () => {
    await recordAiCall('groq', 1234, NOW);
    expect(db.rpcs).toEqual([{ name: 'ai_usage_add', args: { p_day: '2026-10-18', p_provider: 'groq', p_calls: 1, p_tokens: 1234 } }]);
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
    const record = src.indexOf("await recordAiCall('groq'");
    expect(guard).toBeGreaterThan(0);
    expect(send).toBeGreaterThan(guard);
    expect(record).toBeGreaterThan(send);
  });
  it('the pilot flag is off in both flag files', () => {
    expect(readFileSync(join(root, 'src/lib/feature-flags.ts'), 'utf8')).toMatch(/aiSpendGuardPilot: false,/);
    expect(readFileSync(join(root, 'config/feature_flags.py'), 'utf8')).toMatch(/"ai_spend_guard_pilot": False,/);
  });
});

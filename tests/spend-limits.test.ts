// Spend limits: the AI caps (warning at 60%, refusal at the cap), the rupee stop (Rs 8 warn, Rs 13 stop, Rs 100 absolute ceiling) with
// per-model prices and the stored rate, and an alert test for each Supabase, R2, Brevo and Resend level.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config, levelFor, rupeeLevel, aiCallDecision, rupeesFor, egressLevel, r2ClassALevel, brevoLevel, resendLevel } from '../src/lib/spend-limits';

const root = join(__dirname, '..');
const g = config.ai.providers.gemini;
const none = { calls: 0, tokens: 0, rupees: 0 };

describe('AI daily caps', () => {
  it('ok below 60% of the call cap; warn at 60%', () => {
    expect(aiCallDecision('gemini', { ...none, calls: Math.floor(g.daily_calls * 0.59) }).level).toBe('ok');
    expect(aiCallDecision('gemini', { ...none, calls: Math.ceil(g.daily_calls * 0.6) })).toMatchObject({ allowed: true, level: 'warn' });
  });
  it('refuses at 100% of the call cap and at 100% of the token cap', () => {
    expect(aiCallDecision('gemini', { ...none, calls: g.daily_calls })).toMatchObject({ allowed: false, level: 'stop' });
    expect(aiCallDecision('gemini', { ...none, tokens: g.daily_tokens })).toMatchObject({ allowed: false, level: 'stop' });
  });
  it('the next day starts from zero', () => {
    expect(aiCallDecision('gemini', none).allowed).toBe(true);
  });
  it('Groq and Cerebras have their own caps, each refused at its own 100%', () => {
    for (const p of ['groq', 'cerebras'] as const) {
      const c = config.ai.providers[p];
      expect(aiCallDecision(p, { ...none, calls: c.daily_calls }).allowed).toBe(false);
      expect(aiCallDecision(p, { ...none, calls: c.daily_calls - 1 }).allowed).toBe(true);
    }
  });
  it('levelFor boundaries: 59.9% ok, 60% warn, 100% stop', () => {
    expect(levelFor(59, 100, 0.6)).toBe('ok');
    expect(levelFor(60, 100, 0.6)).toBe('warn');
    expect(levelFor(100, 100, 0.6)).toBe('stop');
  });
});

describe('rupee stop: Rs 8 warn, Rs 13 stop, Rs 100 ceiling', () => {
  it('levels at the boundaries', () => {
    expect(rupeeLevel(7.99)).toBe('ok');
    expect(rupeeLevel(8)).toBe('warn');
    expect(rupeeLevel(12.99)).toBe('warn');
    expect(rupeeLevel(13)).toBe('stop');
  });
  it('binds: refuses at Rs 13 even when calls and tokens are well under their caps', () => {
    expect(aiCallDecision('gemini', { calls: 1, tokens: 1000, rupees: 13 })).toMatchObject({ allowed: false, level: 'stop', rupeeLevel: 'stop' });
    expect(aiCallDecision('gemini', { calls: 1, tokens: 1000, rupees: 14 })).toMatchObject({ allowed: false, level: 'stop' });
  });
  it('refuses at the Rs 100 absolute ceiling, whatever the level', () => {
    expect(aiCallDecision('gemini', { calls: 1, tokens: 1000, rupees: 100 })).toMatchObject({ allowed: false, level: 'stop', ceilingHit: true });
    expect(aiCallDecision('gemini', { calls: 1, tokens: 1000, rupees: 99.9 })).toMatchObject({ ceilingHit: false });
  });
  it('warns at Rs 8 without refusing', () => {
    expect(aiCallDecision('gemini', { calls: 1, tokens: 1000, rupees: 8 })).toMatchObject({ allowed: true, level: 'warn' });
  });
  it('the config sets Rs 8 and Rs 13, with a Rs 100 ceiling', () => {
    expect(config.rupee_stop.warn_inr).toBe(8);
    expect(config.rupee_stop.stop_inr).toBe(13);
    expect(config.rupee_stop.absolute_ceiling_inr).toBe(100);
  });
});

describe('rupee cost from the price table and the stored rate', () => {
  it('gemini-2.5-flash-lite at 0.10 input and 0.40 output USD per million: 1M of each is $0.50, Rs 47.50 at 95', () => {
    expect(rupeesFor('gemini-2.5-flash-lite', 1_000_000, 1_000_000)).toBeCloseTo(47.5, 6);
  });
  it('the owner example: Rs 10 at Rs 95 per USD is about 1.05M input tokens on flash-lite', () => {
    const inrPerInputToken = rupeesFor('gemini-2.5-flash-lite', 1_000_000, 0)!;
    expect(10 / inrPerInputToken).toBeCloseTo(1.05, 2);
  });
  it('an unpriced model returns null, so only its caps apply', () => {
    expect(rupeesFor('llama-3.3-70b-versatile', 1000, 1000)).toBeNull();
    expect(rupeesFor('gpt-oss-120b', 1000, 1000)).toBeNull();
  });
  it('the checked prices and their date are in the config', () => {
    expect(config.ai.prices_last_checked).toBe('2026-10-18');
    expect(config.ai.prices_usd_per_million_tokens['gemini-3.1-flash-lite']).toEqual({ input: 0.25, output: 1.5 });
    expect(config.ai.prices_usd_per_million_tokens['openai/gpt-oss-120b']).toEqual({ input: 0.15, output: 0.6 });
    expect(config.ai.prices_usd_per_million_tokens['gemini-2.5-flash']).toEqual({ input: 0.3, output: 2.5 });
  });
  it('Groq llama-3.3-70b and the Cerebras models are null, and the Qwen 3.6 name is absent', () => {
    const t = config.ai.prices_usd_per_million_tokens as Record<string, unknown>;
    expect(t['llama-3.3-70b-versatile']).toBeNull();
    expect(t['gpt-oss-120b']).toBeNull();
    expect(t['llama3.1-8b']).toBeNull();
    expect(JSON.stringify(config)).not.toMatch(/qwen3\.6/);
  });
  it('the stored rate is 95 and dated', () => {
    expect(config.usd_inr_stored.rate).toBe(95);
    expect(config.usd_inr_stored.as_of).toBe('2026-10-18');
  });
});

describe('alerts fire at their levels', () => {
  it('Supabase egress: alert at 3.5, guard at 4.0, stop at 4.6', () => {
    expect(egressLevel(3.49)).toBe('ok');
    expect(egressLevel(3.5)).toBe('alert');
    expect(egressLevel(4.0)).toBe('guard');
    expect(egressLevel(4.59)).toBe('guard');
    expect(egressLevel(4.6)).toBe('stop');
  });
  it('R2 Class A: warn at 60% of 900,000, stop at 900,000', () => {
    expect(r2ClassALevel(539_999)).toBe('ok');
    expect(r2ClassALevel(540_000)).toBe('warn');
    expect(r2ClassALevel(900_000)).toBe('stop');
  });
  it('Brevo: warn at 162 a day, stop at 270', () => {
    expect(brevoLevel(161)).toBe('ok');
    expect(brevoLevel(162)).toBe('warn');
    expect(brevoLevel(270)).toBe('stop');
  });
  it('Resend: warn at 54 a day, stop at 90', () => {
    expect(resendLevel(53)).toBe('ok');
    expect(resendLevel(54)).toBe('warn');
    expect(resendLevel(90)).toBe('stop');
  });
});

describe('the per-model counter migration', () => {
  it('server-only, with a rupees column and its function granted to the server role only', () => {
    const sql = readFileSync(join(root, 'supabase/migrations/20261018160000_ai_model_usage.sql'), 'utf8');
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).toMatch(/REVOKE ALL ON public\.ai_model_usage FROM PUBLIC, anon, authenticated;/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.ai_model_usage_add\(date, text, text, bigint, bigint, numeric\) TO service_role;/);
    expect(sql).toMatch(/rupees\s+numeric/);
  });
});

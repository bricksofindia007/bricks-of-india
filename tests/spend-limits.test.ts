// Spend limits: the AI caps (warning at 60%, refusal at 100%, rupees only when a price is set), and an alert
// test for each Supabase, R2, Brevo and Resend level.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config, levelFor, aiCallDecision, rupeesFor, egressLevel, r2ClassALevel, brevoLevel, resendLevel } from '../src/lib/spend-limits';

const root = join(__dirname, '..');
const g = config.ai.providers.gemini;

describe('AI daily caps', () => {
  it('ok below 60% of the cap', () => {
    expect(aiCallDecision('gemini', { calls: Math.floor(g.daily_calls * 0.59), tokens: 0 })).toMatchObject({ allowed: true, level: 'ok' });
  });
  it('warns at 60% of the call cap', () => {
    const d = aiCallDecision('gemini', { calls: Math.ceil(g.daily_calls * 0.6), tokens: 0 });
    expect(d).toMatchObject({ allowed: true, level: 'warn', callLevel: 'warn' });
  });
  it('warns at 60% of the token cap', () => {
    const d = aiCallDecision('gemini', { calls: 0, tokens: g.daily_tokens * 0.6 });
    expect(d).toMatchObject({ allowed: true, level: 'warn', tokenLevel: 'warn' });
  });
  it('refuses at 100% of the call cap, and at 100% of the token cap', () => {
    expect(aiCallDecision('gemini', { calls: g.daily_calls, tokens: 0 })).toMatchObject({ allowed: false, level: 'stop' });
    expect(aiCallDecision('gemini', { calls: 0, tokens: g.daily_tokens })).toMatchObject({ allowed: false, level: 'stop' });
  });
  it('the next day starts from zero (the counter is per day, so a fresh day is ok)', () => {
    expect(aiCallDecision('gemini', { calls: 0, tokens: 0 }).allowed).toBe(true);
  });
  it('Groq and Cerebras have their own caps and are refused at their own 100%', () => {
    for (const p of ['groq', 'cerebras'] as const) {
      const c = config.ai.providers[p];
      expect(aiCallDecision(p, { calls: c.daily_calls, tokens: 0 }).allowed).toBe(false);
      expect(aiCallDecision(p, { calls: c.daily_calls - 1, tokens: 0 }).allowed).toBe(true);
    }
  });
  it('levelFor boundaries: 59.9% ok, 60% warn, 100% stop', () => {
    expect(levelFor(59, 100, 0.6)).toBe('ok');
    expect(levelFor(60, 100, 0.6)).toBe('warn');
    expect(levelFor(100, 100, 0.6)).toBe('stop');
  });
});

describe('rupee figure', () => {
  it('is null while a model price is null: only the caps apply', () => {
    expect(rupeesFor('gemini', 'gemini-2.5-flash-lite', 1_000_000)).toBeNull();
  });
  it('is zero for Groq and Cerebras (free tiers): their caps are the control', () => {
    expect(rupeesFor('groq', 'openai/gpt-oss-120b', 5_000_000)).toBe(0);
    expect(rupeesFor('cerebras', 'gpt-oss-120b', 5_000_000)).toBe(0);
  });
  it('is tokens times the price, once a price is set', () => {
    const table = config.ai.rupee_price_per_million_tokens as Record<string, number | null>;
    const before = table['gemini-2.5-flash-lite'];
    table['gemini-2.5-flash-lite'] = 10;
    try {
      expect(rupeesFor('gemini', 'gemini-2.5-flash-lite', 500_000)).toBe(5);
    } finally {
      table['gemini-2.5-flash-lite'] = before;
    }
  });
  it('the config says prices are unchecked until verified prices arrive', () => {
    expect(config.prices_last_checked).toBeNull();
    expect(config.ai.rupee_price_per_million_tokens['gemini-2.5-flash-lite']).toBeNull();
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

describe('the config file and migration', () => {
  it('the caps are marked as proposals', () => {
    expect(config._status).toMatch(/PROPOSED/);
  });
  it('the counter table is server-only, and the function is granted to the server role only', () => {
    const sql = readFileSync(join(root, 'supabase/migrations/20261018150000_ai_daily_usage.sql'), 'utf8');
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).toMatch(/REVOKE ALL ON public\.ai_daily_usage FROM PUBLIC, anon, authenticated;/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.ai_usage_add\(date, text, integer, bigint\) TO service_role;/);
  });
});

// Supabase egress: the existing guard (alert 3.5, block 4.0) gains the stop at 4.6, with the same levels as
// config/spend-limits.json. Also: Gemini and Cerebras check the pilot guard before each call and record after.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mayReadNonEssential, LIMITS, alertLevels } from '../scripts/lib/quota-guard.mjs';
import { config, egressLevel } from '../src/lib/spend-limits';

const root = join(__dirname, '..');
const ok = { storageMb: 0, dbMb: 0, egressProjectedGb: 0 };

describe('egress guard levels', () => {
  it.each([
    [3.49, true, 'ok'],
    [3.5, true, 'warning'],
    [3.99, true, 'warning'],
    [4.0, false, 'critical'],
    [4.59, false, 'critical'],
    [4.6, false, 'stop'],
    [5.2, false, 'stop'],
  ])('%s GB -> allowed=%s level=%s', (gb, allowed, level) => {
    const d = mayReadNonEssential({ ...ok, egressProjectedGb: gb });
    expect([d.allowed, d.level]).toEqual([allowed, level]);
  });
  it('the stop line is 4.6 and is reported as its own level', () => {
    expect(LIMITS.egress.stopGb).toBe(4.6);
    expect(mayReadNonEssential({ ...ok, egressProjectedGb: 4.6 }).reason).toBe('egress-stop');
  });
  it('alertLevels carries the stop', () => {
    expect(alertLevels({ ...ok, egressProjectedGb: 4.7 }).egress.level).toBe('stop');
  });
  it('unreadable usage still fails closed', () => {
    expect(mayReadNonEssential({ ...ok, egressProjectedGb: null })).toMatchObject({ allowed: false, reason: 'usage-unreadable' });
  });
});

describe('the two guards use the same levels', () => {
  it('the config and the guard agree on 3.5, 4.0 and 4.6', () => {
    expect([config.supabase_egress_gb.alert, config.supabase_egress_gb.guard, config.supabase_egress_gb.stop]).toEqual([LIMITS.egress.alertGb, LIMITS.egress.blockGb, LIMITS.egress.stopGb]);
  });
  it('the config levels match the guard at each boundary', () => {
    expect(egressLevel(4.6)).toBe('stop');
    expect(egressLevel(4.0)).toBe('guard');
    expect(egressLevel(3.5)).toBe('alert');
  });
});

describe('Gemini and Cerebras call sites', () => {
  for (const [file, name, send] of [['src/lib/providers/gemini.ts', 'gemini', 'generateContent'], ['src/lib/providers/cerebras.ts', 'cerebras', 'fetch(CEREBRAS_API_URL']] as const) {
    it(`${name} checks the guard before it sends, and records after the response`, () => {
      const src = readFileSync(join(root, file), 'utf8');
      const guard = src.indexOf(`await guardAiCall('${name}')`);
      const record = src.indexOf(`await recordAiCall('${name}'`);
      expect(guard).toBeGreaterThan(0);
      expect(record).toBeGreaterThan(guard);
      expect(src.indexOf(send)).toBeGreaterThan(guard);
    });
  }
});

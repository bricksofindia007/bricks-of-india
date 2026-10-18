// USD to INR rate decision for the MRP estimate job: one stored rate with its date, a 70 to 110 band, a 5% jump
// check, a 5-day staleness limit, and no fixed fallback anywhere in the populate script.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-ignore plain CommonJS helper
import { resolveRate, inBand, passesJump, STALE_DAYS } from '../scripts/lib/usd-rate.cjs';

const root = join(__dirname, '..');

describe('USD/INR rate decision', () => {
  it('fetch failure with a stored rate 2 days old: the stored rate is used, an alert is raised, dependent writes may run', () => {
    const r = resolveRate({ fetched: null, stored: { rate: 95, date: '2026-10-16' }, today: '2026-10-18' });
    expect(r.rate).toBe(95);
    expect(r.source).toBe('stored');
    expect(r.alert).toMatch(/using stored rate from 2026-10-16/);
    expect(r.storeNew).toBe(false);
  });

  it('fetch failure with a stored rate 6 days old: no dependent writes (no rate), and an alert is raised', () => {
    const r = resolveRate({ fetched: null, stored: { rate: 95, date: '2026-10-12' }, today: '2026-10-18' });
    expect(r.rate).toBeNull();
    expect(r.source).toBe('none');
    expect(r.alert).toMatch(/6 days old \(limit 5 days\); dependent writes skipped/);
  });

  it('no fixed fallback anywhere in the populate script: no fallback constant and no rate literal', () => {
    const src = readFileSync(join(root, 'scripts/populate-mrp.js'), 'utf8');
    expect(src).not.toMatch(/FALLBACK/);
    expect(src).not.toMatch(/(rate|RATE|INR)\s*=\s*90\b/);
    expect(src).not.toMatch(/\?\?\s*90\b|\|\|\s*90\b/);
  });

  it('a value outside the 70 to 110 band is rejected; a value inside it is accepted', () => {
    expect(inBand(69.9)).toBe(false);
    expect(inBand(110.1)).toBe(false);
    expect(inBand(94.96)).toBe(true);
  });

  it('a new value more than 5% from the stored value is rejected and the stored value is kept', () => {
    expect(passesJump(100, { rate: 94, date: '2026-10-17' })).toBe(false);
    expect(passesJump(96, { rate: 94, date: '2026-10-17' })).toBe(true);
    const r = resolveRate({ fetched: 100, stored: { rate: 94, date: '2026-10-17' }, today: '2026-10-18' });
    expect(r.rate).toBe(94);
    expect(r.source).toBe('stored');
  });

  it('the staleness limit is 5 days', () => {
    expect(STALE_DAYS).toBe(5);
  });
});

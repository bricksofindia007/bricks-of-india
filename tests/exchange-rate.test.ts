// Exchange rate job and its stored row: band 70 to 110, 5% jump check, 5-day staleness, alert on a failed fetch,
// no fixed fallback, a heartbeat on every run, and the stored row's grants and row security.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-ignore plain CommonJS helper
import { resolveRate, inBand, passesJump, parseFrankfurter, STALE_DAYS, BAND_MIN, BAND_MAX, JUMP_MAX } from '../scripts/lib/usd-rate.cjs';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

describe('band 70 to 110', () => {
  it('rejects values outside the band and accepts values inside it', () => {
    expect([BAND_MIN, BAND_MAX]).toEqual([70, 110]);
    expect(inBand(69.99)).toBe(false);
    expect(inBand(110.01)).toBe(false);
    expect(inBand(70)).toBe(true);
    expect(inBand(94.96)).toBe(true);
  });

  it('an out-of-band fetch is not stored; the stored row is used', () => {
    const r = resolveRate({ fetched: 150, stored: { rate: 95, date: '2026-10-17' }, today: '2026-10-18' });
    expect(r.storeNew).toBe(false);
    expect(r.rate).toBe(95);
    expect(r.alert).toMatch(/outside 70 to 110/);
  });
});

describe('5% jump check', () => {
  it('rejects a new value more than 5% from the stored value and keeps the stored value', () => {
    expect(JUMP_MAX).toBe(0.05);
    expect(passesJump(100, { rate: 94, date: '2026-10-17' })).toBe(false);
    expect(passesJump(96, { rate: 94, date: '2026-10-17' })).toBe(true);
    const r = resolveRate({ fetched: 100, stored: { rate: 94, date: '2026-10-17' }, today: '2026-10-18' });
    expect(r.storeNew).toBe(false);
    expect(r.rate).toBe(94);
    expect(r.alert).toMatch(/5% jump check/);
  });

  it('accepts a value that passes band and jump and stores it', () => {
    const r = resolveRate({ fetched: 95.5, stored: { rate: 94, date: '2026-10-17' }, today: '2026-10-18' });
    expect(r.storeNew).toBe(true);
    expect(r.rate).toBe(95.5);
  });
});

describe('5-day staleness', () => {
  it('the limit is 5 days', () => {
    expect(STALE_DAYS).toBe(5);
  });

  it('a stored value 5 days old is still used', () => {
    const r = resolveRate({ fetched: null, stored: { rate: 95, date: '2026-10-13' }, today: '2026-10-18' });
    expect(r.rate).toBe(95);
  });

  it('a stored value 6 days old is not used: no rate, and an alert', () => {
    const r = resolveRate({ fetched: null, stored: { rate: 95, date: '2026-10-12' }, today: '2026-10-18' });
    expect(r.rate).toBeNull();
    expect(r.alert).toMatch(/6 days old \(limit 5 days\)/);
  });
});

describe('failed fetch raises an alert and keeps the stored row', () => {
  it('a failed fetch with a stored value 2 days old: stored value kept, alert raised, nothing written', () => {
    const r = resolveRate({ fetched: null, stored: { rate: 95, date: '2026-10-16' }, today: '2026-10-18' });
    expect(r.storeNew).toBe(false);
    expect(r.rate).toBe(95);
    expect(r.alert).toMatch(/fetch failed/);
  });

  it('the Frankfurter parser refuses a response without a date or without an INR value', () => {
    expect(parseFrankfurter({ date: '2026-10-16', rates: { INR: 94.96 } })).toEqual({ rate: 94.96, date: '2026-10-16' });
    expect(parseFrankfurter({ rates: { INR: 94.96 } })).toBeNull();
    expect(parseFrankfurter({ date: '2026-10-16', rates: {} })).toBeNull();
    expect(parseFrankfurter({ date: '16/10/2026', rates: { INR: 94.96 } })).toBeNull();
  });
});

describe('no fixed fallback, heartbeat, and the stored row', () => {
  it('the job has no fixed rate and no fallback constant', () => {
    const src = read('scripts/exchange-rate.mjs');
    expect(src).not.toMatch(/FALLBACK/);
    expect(src).not.toMatch(/(rate|RATE|INR)\s*=\s*\d/);
  });

  it('the job writes a heartbeat on every run that has a stored row', () => {
    const src = read('scripts/exchange-rate.mjs');
    expect(src).toMatch(/last_attempt_at/);
    expect(src).toMatch(/heartbeat\(now\)/);
  });

  it('the stored row: row security on, no browser role granted, a server-only read function', () => {
    const sql = read('supabase/migrations/20261018190000_usd_inr_rate.sql');
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/revoke all on public\.usd_inr_rate from public, anon, authenticated/);
    expect(sql).toMatch(/revoke all on function public\.get_usd_inr_rate\(\) from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.get_usd_inr_rate\(\) to service_role/);
    expect(sql).not.toMatch(/to anon|to authenticated/);
  });

  it('the migration carries its own PR number as the issue header', () => {
    const sql = read('supabase/migrations/20261018190000_usd_inr_rate.sql');
    expect(sql.split(/\r?\n/)[0]).toBe('-- boi:issue 679');
  });
});

// The stored-rate reader: maps the granted function's row, refuses unusable rows, and never reads the table
// or uses the server key.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toStoredRate, rateSourceOf } from '../src/lib/usd-rate-reader';

const root = join(__dirname, '..');

describe('stored rate reader', () => {
  it('maps a function row to rate and value date', () => {
    expect(toStoredRate({ rate: '94.9600', value_date: '2026-10-16' })).toEqual({ rate: 94.96, asOf: '2026-10-16' });
  });

  it('refuses a missing, zero, negative or non-numeric rate, and a malformed date', () => {
    expect(toStoredRate(null)).toBeNull();
    expect(toStoredRate({ rate: 0, value_date: '2026-10-16' })).toBeNull();
    expect(toStoredRate({ rate: -3, value_date: '2026-10-16' })).toBeNull();
    expect(toStoredRate({ rate: 'abc', value_date: '2026-10-16' })).toBeNull();
    expect(toStoredRate({ rate: 94, value_date: '16/10/2026' })).toBeNull();
  });

  it('a rate source over a loaded value returns it, and over no value returns null', () => {
    expect(rateSourceOf({ rate: 94, asOf: '2026-10-16' }).getRate()).toEqual({ rate: 94, asOf: '2026-10-16' });
    expect(rateSourceOf(null).getRate()).toBeNull();
  });

  it('the reader reads only the granted function: no table read, no server key', () => {
    const src = readFileSync(join(root, 'src/lib/usd-rate-reader.ts'), 'utf8');
    expect(src).toMatch(/\.rpc\('get_usd_inr_rate'\)/);
    expect(src).not.toMatch(/\.from\('usd_inr_rate'\)/);
    expect(src).not.toMatch(/createServerClient|SERVICE_ROLE/);
  });
});

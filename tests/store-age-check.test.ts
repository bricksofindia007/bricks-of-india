/**
 * Daily store age check (order 0560, permanent fix 3b). Pure logic only: no network, no key.
 */
import { describe, it, expect } from 'vitest';
import { staleStores, newestPath, describeReadFailure, MAX_AGE_HOURS } from '../scripts/store-age-check.mjs';

const NOW = Date.parse('2026-11-07T04:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe('staleStores: 36 hour limit', () => {
  it('the limit is 36 hours', () => {
    expect(MAX_AGE_HOURS).toBe(36);
  });

  it('two fresh stores give no problems', () => {
    expect(staleStores({ mybrickhouse: hoursAgo(2), toycra: hoursAgo(5) }, NOW)).toEqual([]);
  });

  it('a store just under the limit is fine', () => {
    expect(staleStores({ mybrickhouse: hoursAgo(35.9), toycra: hoursAgo(1) }, NOW)).toEqual([]);
  });

  it('a store over the limit is named with its age and the limit', () => {
    const p = staleStores({ mybrickhouse: hoursAgo(53.5), toycra: hoursAgo(1) }, NOW);
    expect(p).toEqual(['mybrickhouse: newest price is 53.5 hours old (limit 36 hours)']);
  });

  it('exactly at the limit is not yet a problem; just over it is', () => {
    expect(staleStores({ mybrickhouse: hoursAgo(36), toycra: hoursAgo(1) }, NOW)).toEqual([]);
    expect(staleStores({ mybrickhouse: hoursAgo(36.1), toycra: hoursAgo(1) }, NOW)).toHaveLength(1);
  });

  it('both stores stale gives two lines', () => {
    expect(staleStores({ mybrickhouse: hoursAgo(50), toycra: hoursAgo(40) }, NOW)).toHaveLength(2);
  });

  it('a store with no rows is a problem', () => {
    expect(staleStores({ mybrickhouse: null, toycra: hoursAgo(1) }, NOW)).toEqual(['mybrickhouse: no prices at all']);
  });

  it('an unreadable time is a problem, not a pass', () => {
    expect(staleStores({ mybrickhouse: 'not a date', toycra: hoursAgo(1) }, NOW)).toEqual(['mybrickhouse: newest price time could not be read']);
  });

  it('a store missing from the map counts as no prices', () => {
    expect(staleStores({ toycra: hoursAgo(1) }, NOW)).toEqual(['mybrickhouse: no prices at all']);
  });
});

describe('describeReadFailure: says why a read was refused, never the key', () => {
  it('includes the service message when the body has one', () => {
    expect(describeReadFailure('mybrickhouse', 401, '{"message":"Invalid API key","hint":"Double check your key"}'))
      .toBe('mybrickhouse: read failed with HTTP 401 (Invalid API key)');
  });

  it('falls back to the hint, then to the status alone', () => {
    expect(describeReadFailure('toycra', 401, '{"hint":"check the key"}')).toBe('toycra: read failed with HTTP 401 (check the key)');
    expect(describeReadFailure('toycra', 500, 'not json')).toBe('toycra: read failed with HTTP 500');
  });

  it('collapses whitespace and caps the detail length', () => {
    const long = 'x'.repeat(400);
    const line = describeReadFailure('toycra', 403, JSON.stringify({ message: `a\n\n  b ${long}` }));
    expect(line.length).toBeLessThan(220);
    expect(line).not.toMatch(/\n/);
  });
});

describe('newestPath: read-only query shape', () => {
  it('asks for one row, newest first, for one store, columns only', () => {
    const u = new URL(newestPath('https://example.supabase.co', 'toycra'));
    expect(u.pathname).toBe('/rest/v1/store_prices');
    expect(u.searchParams.get('select')).toBe('scraped_at');
    expect(u.searchParams.get('store_id')).toBe('eq.toycra');
    expect(u.searchParams.get('order')).toBe('scraped_at.desc');
    expect(u.searchParams.get('limit')).toBe('1');
  });

  it('never writes: only the GET path is built here', () => {
    expect(newestPath('https://example.supabase.co', 'mybrickhouse')).not.toMatch(/insert|delete|patch|upsert/i);
  });
});

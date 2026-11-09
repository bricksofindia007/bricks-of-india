/**
 * Daily store age check (order 0560, permanent fix 3b; order 1440 item 1: read through the read-only role).
 * Pure logic only: no network, no connection string.
 */
import { describe, it, expect } from 'vitest';
import { staleStores, newestQuery, parseNewest, describeReadError, MAX_AGE_HOURS, STORES } from '../scripts/store-age-check.mjs';

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

describe('newestQuery: one read-only statement over the price table', () => {
  it('runs in a read-only transaction with a statement timeout and reads only store and time', () => {
    const q = newestQuery();
    expect(q).toMatch(/^begin read only;/);
    expect(q).toMatch(/set local statement_timeout = '10s'/);
    expect(q).toMatch(/select store_id \|\| '\|' \|\| coalesce\(max\(scraped_at\)::text, ''\) from public\.store_prices/);
    expect(q).toMatch(/where store_id in \('mybrickhouse', 'toycra'\) group by store_id; commit;$/);
  });

  it('never writes: no insert, update, delete, drop or grant in the statement', () => {
    expect(newestQuery()).not.toMatch(/insert|update |delete|drop|grant|alter|truncate/i);
  });

  it('refuses a store name outside the plain pattern (nothing is put into the query unchecked)', () => {
    expect(() => newestQuery(["toycra'; drop table x; --"])).toThrow(/store name not allowed/);
  });
});

describe('parseNewest: reads only the store lines from the output', () => {
  it('reads the newest time per store and ignores command tags', () => {
    const out = 'BEGIN\nSET\nmybrickhouse|2026-11-07 03:05:50+00\ntoycra|2026-11-07 03:00:55+00\nCOMMIT\n';
    expect(parseNewest(out)).toEqual({ mybrickhouse: '2026-11-07 03:05:50+00', toycra: '2026-11-07 03:00:55+00' });
  });

  it('a store with no rows reads as null, so it is reported as no prices', () => {
    expect(parseNewest('mybrickhouse|\n')).toEqual({ mybrickhouse: null, toycra: null });
  });

  it('ignores lines for stores the check does not track', () => {
    expect(parseNewest('other|2026-11-07 01:00:00+00\n')).toEqual({ mybrickhouse: null, toycra: null });
    expect(STORES).toEqual(['mybrickhouse', 'toycra']);
  });
});

describe('describeReadError: a clear reason, never the connection string', () => {
  const url = 'postgresql://ci_readonly:SECRETVALUE@db.example.internal:6543/postgres';

  it('gives the first line of the client error', () => {
    expect(describeReadError('psql: error: FATAL:  password authentication failed for user "ci_readonly"\nDETAIL: x', url))
      .toBe('read failed: psql: error: FATAL:  password authentication failed for user "ci_readonly"');
  });

  it('removes the connection string and any connection-string-looking text from the line', () => {
    const line = describeReadError(`could not connect to ${url}\n`, url);
    expect(line).not.toContain('SECRETVALUE');
    expect(line).not.toContain('postgresql://');
    expect(line).toContain('[connection string]');
  });

  it('says so when the client gave no detail', () => {
    expect(describeReadError('', url)).toBe('read failed: no detail from the database client');
  });

  it('caps the length', () => {
    expect(describeReadError('x'.repeat(500), url).length).toBeLessThan(220);
  });
});

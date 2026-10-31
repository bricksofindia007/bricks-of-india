// Retired sets on My Collection show their last seen price on the row (order 0280 item 2c). The total does not change.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { retiredIdsForLastSeen, lastSeenMap, LAST_SEEN_BATCH } from '../src/lib/last-seen-page';
import { retiredLine } from '../src/lib/collection-worth';

const root = join(__dirname, '..');

describe('which sets to ask about', () => {
  it('only retired owned sets, each once', () => {
    const owned = [{ set: '90001' }, { set: '90002' }, { set: '90001' }, { set: '90003' }];
    const retired: Record<string, boolean | null> = { '90001': true, '90002': false, '90003': null };
    expect(retiredIdsForLastSeen(owned, (s) => retired[s] ?? null)).toEqual(['90001']);
  });

  it('unknown retired status is never asked about (never treated as retired)', () => {
    expect(retiredIdsForLastSeen([{ set: '90004' }], () => null)).toEqual([]);
  });

  it('at most one batch', () => {
    const owned = Array.from({ length: LAST_SEEN_BATCH + 20 }, (_, i) => ({ set: String(10000 + i) }));
    expect(retiredIdsForLastSeen(owned, () => true)).toHaveLength(LAST_SEEN_BATCH);
  });
});

describe('the last seen map', () => {
  it('keeps rows with a usable price and date', () => {
    const m = lastSeenMap([{ set_number: '90001', price_inr: 4999, observed_at: '2026-05-14T10:00:00Z' }]);
    expect(m.get('90001')).toEqual({ priceInr: 4999, observedAt: '2026-05-14T10:00:00Z' });
  });

  it('leaves out a zero or missing price, or a bad date (the approved line shows instead)', () => {
    const m = lastSeenMap([
      { set_number: '90002', price_inr: 0, observed_at: '2026-05-14T10:00:00Z' },
      { set_number: '90003', price_inr: NaN, observed_at: '2026-05-14T10:00:00Z' },
      { set_number: '90004', price_inr: 100, observed_at: 'not a date' },
    ]);
    expect(m.size).toBe(0);
  });

  it('the row text is the existing last seen line, with month and year', () => {
    const m = lastSeenMap([{ set_number: '90001', price_inr: 4999, observed_at: '2026-05-14T10:00:00Z' }]);
    expect(retiredLine(m.get('90001') ?? null)).toMatch(/^Retired\. Last seen in India at ₹4,999 \(May 2026\)\. Good luck finding one\.$/);
  });
});

describe('the page wiring', () => {
  const src = readFileSync(join(root, 'src/app/my/MyCollection.tsx'), 'utf8');

  it('the owned row passes the last seen price to worthOf', () => {
    expect(src).toMatch(/worthOf\(worthInputFor\(o, p, priceState === 'ok'\), rate, isRetired\(o\.set\), lastSeen\.get\(o\.set\) \?\? null\)/);
  });

  it('the total gets the last seen price for each retired set (the total counts it)', () => {
    expect(src).toMatch(/const total = worthTotal\(worthItems, rate, isRetired, capped, \(s\) => lastSeen\.get\(s\) \?\? null\);/);
  });

  it('the read is one batched request for retired sets, through the existing route', () => {
    expect(src).toContain('/api/last-seen-prices?ids=');
  });
});

// Staging read-only mode degrades an unreadable price read to empty; production (flag off) still throws.
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptyOnStagingError, stagingReadOnly } from '../src/lib/staging-mode';
import { getDeals } from '../src/lib/price-summary';

const root = join(__dirname, '..');
const ORIGINAL = process.env.STAGING_READ_ONLY;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.STAGING_READ_ONLY;
  else process.env.STAGING_READ_ONLY = ORIGINAL;
});

// A query builder that resolves the final call (range) to the given result.
function failingClient(result: { data: unknown; error: unknown }) {
  const builder: any = new Proxy({}, {
    get: (_t, prop) => (prop === 'range' ? () => Promise.resolve(result) : () => builder),
  });
  return { from: () => builder } as any;
}

describe('emptyOnStagingError', () => {
  it('flag off: a read error still throws (production unchanged)', () => {
    delete process.env.STAGING_READ_ONLY;
    expect(stagingReadOnly()).toBe(false);
    expect(() => emptyOnStagingError({ message: 'permission denied' })).toThrow();
  });

  it('flag on: a read error is treated as empty', () => {
    process.env.STAGING_READ_ONLY = '1';
    expect(emptyOnStagingError({ message: 'permission denied' })).toBe(true);
  });

  it('no error: nothing to degrade, in either mode', () => {
    delete process.env.STAGING_READ_ONLY;
    expect(emptyOnStagingError(null)).toBe(false);
    process.env.STAGING_READ_ONLY = '1';
    expect(emptyOnStagingError(null)).toBe(false);
  });
});

describe('getDeals (the deals list)', () => {
  it('flag on: an unreadable summary view gives an empty list (the staging build completes)', async () => {
    process.env.STAGING_READ_ONLY = '1';
    const deals = await getDeals(failingClient({ data: null, error: { message: 'permission denied' } }));
    expect(deals).toEqual([]);
  });

  it('flag off: an unreadable summary view still throws (production unchanged)', async () => {
    delete process.env.STAGING_READ_ONLY;
    await expect(getDeals(failingClient({ data: null, error: { message: 'permission denied' } }))).rejects.toBeTruthy();
  });

  it('production path: readable rows come back the same way with the flag off', async () => {
    delete process.env.STAGING_READ_ONLY;
    const rows = [{ set_id: '10305', deal_tier: 'deal', discount_pct: '12.5', anchor_mrp_inr: '100', best_price_inr: '88' }];
    const sb: any = {
      from: () => {
        const b: any = new Proxy({}, { get: (_t, p) => (p === 'range' ? () => Promise.resolve({ data: rows, error: null }) : () => b) });
        return b;
      },
    };
    const deals = await getDeals(sb);
    expect(deals).toHaveLength(1);
    expect(deals[0].set_id).toBe('10305');
  });
});

describe('set page price side', () => {
  const page = readFileSync(join(root, 'src/app/sets/[slug]/page.tsx'), 'utf8');

  it('reads both price-side results through the degrade helper, not a throw', () => {
    expect(page).toMatch(/emptyOnStagingError\(sp\.error\)/);
    expect(page).toMatch(/emptyOnStagingError\(sum\.error\)/);
    expect(page).not.toMatch(/if \(sp\.error\) throw sp\.error/);
  });
});

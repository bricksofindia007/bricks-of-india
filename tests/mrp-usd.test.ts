// US price column: the pure helpers the populate job uses, and a check that the existing INR path is unchanged.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-ignore plain CommonJS helper
import { usdFromSet, collectUsd, usdRows, batches, WRITE_BATCH } from '../scripts/lib/mrp-usd.cjs';

const root = join(__dirname, '..');

const set = (number: string, usd?: number | null) => ({ number, LEGOCom: usd === undefined ? undefined : { US: { retailPrice: usd } } });

describe('usdFromSet', () => {
  it('reads the Brickset US retail price in dollars', () => {
    expect(usdFromSet(set('10307-1', 499.99))).toBe(499.99);
  });
  it('is null when there is no price, a zero price, or no US block', () => {
    expect(usdFromSet(set('1', null))).toBeNull();
    expect(usdFromSet(set('2', 0))).toBeNull();
    expect(usdFromSet(set('3', undefined))).toBeNull();
    expect(usdFromSet(undefined)).toBeNull();
  });
});

describe('collectUsd', () => {
  it('keeps priced sets only, keyed by Brickset number, and adds to an existing map', () => {
    const into: Record<string, number> = { old: 10 };
    const out = collectUsd([set('10307-1', 499), set('10308-1', null), set('10309-1', 129.5)], into);
    expect(out).toEqual({ old: 10, '10307-1': 499, '10309-1': 129.5 });
  });
  it('skips a record with no number', () => {
    expect(collectUsd([{ LEGOCom: { US: { retailPrice: 50 } } }])).toEqual({});
  });
  it('handles no sets at all', () => {
    expect(collectUsd(undefined)).toEqual({});
  });
});

describe('usdRows and batching', () => {
  it('builds one row per priced set', () => {
    expect(usdRows({ '10307-1': 499 })).toEqual([{ set_number: '10307-1', us_price_usd: 499 }]);
  });
  it('batches at 500 rows per call, with the last batch short', () => {
    expect(WRITE_BATCH).toBe(500);
    const rows = Array.from({ length: 1201 }, (_, i) => ({ set_number: String(i), us_price_usd: 1 }));
    const b = batches(rows);
    expect(b.map((x) => x.length)).toEqual([500, 500, 201]);
    expect(b.flat()).toEqual(rows);
  });
  it('an empty map makes no batches (no write call)', () => {
    expect(batches(usdRows({}))).toEqual([]);
  });
});

describe('the existing INR path is unchanged', () => {
  const job = readFileSync(join(root, 'scripts/populate-mrp.js'), 'utf8');
  it('still converts and writes lego_mrp_inr through the same batch function', () => {
    expect(job).toMatch(/const usd = set\.LEGOCom\?\.US\?\.retailPrice;\s*if \(usd && usd > 0\) prices\[set\.number\] = usdToInr\(usd, rate\);/);
    expect(job).toMatch(/await bulkPatch\(\s*updates\.map\(u => \(\{ id: u\.id, lego_mrp_inr: u\.lego_mrp_inr \}\)\)/);
    expect(job).toMatch(/sb\.rpc\('sets_bulk_patch', \{ p_rows: chunk \}\)/);
  });
  it('the US price write uses its own function and batch size, after the INR and retirement phases', () => {
    const i4 = job.indexOf('Phase 4 — update lego_mrp_inr');
    const i5 = job.indexOf('Phase 5 — write retirement_date');
    const i6 = job.indexOf('Phase 6 — US retail price');
    expect(i4).toBeGreaterThan(0);
    expect(i5).toBeGreaterThan(i4);
    expect(i6).toBeGreaterThan(i5);
    expect(job.slice(i6)).toMatch(/sb\.rpc\('sets_bulk_us_price', \{ p_rows: chunk \}\)/);
  });
  it('the job makes no new Brickset calls for the US price', () => {
    // Every new step reads records already fetched: no new fetch() in the helper.
    expect(readFileSync(join(root, 'scripts/lib/mrp-usd.cjs'), 'utf8')).not.toMatch(/fetch\(/);
  });
});

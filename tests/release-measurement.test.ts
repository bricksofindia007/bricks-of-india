// Release measurement helpers (scripts/release): the pure rules behind the CPU, page and row-count steps.
import { describe, it, expect } from 'vitest';
import { median, summarise, normalisePage, firstDifference, FIXED_URLS } from '../scripts/release/measure-release.mjs';
import { countFromContentRange, TABLES } from '../scripts/release/count-rows.mjs';

describe('median', () => {
  it('odd and even lists; empty list is null; NaN is ignored', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(median([NaN, 5])).toBe(5);
  });
});

describe('summarise', () => {
  it('uses only hours with traffic; reports the median CPU in ms and the error rate', () => {
    const s = summarise([
      { requests: 3600, errors: 4, cpuP50Us: 90_000 },
      { requests: 3600, errors: 0, cpuP50Us: 110_000 },
      { requests: 0, errors: 0, cpuP50Us: NaN },
      { requests: 3600, errors: 2, cpuP50Us: 100_000 },
    ]);
    expect(s.hours).toBe(3);
    expect(s.requests).toBe(10800);
    expect(s.errors).toBe(6);
    expect(s.cpu_median_ms).toBe(100);
    expect(s.error_rate).toBe(0.000556);
  });
  it('no traffic gives null values, not zero', () => {
    const s = summarise([{ requests: 0, errors: 0, cpuP50Us: NaN }]);
    expect(s.cpu_median_ms).toBeNull();
    expect(s.error_rate).toBeNull();
  });
});

describe('normalisePage', () => {
  it('removes build ids, timestamps and cache-busting values', () => {
    const a = '<script src="/_next/static/AbC123/x.js?v=987"></script>"buildId":"AbC123" at 2026-10-24T03:10:00.123Z';
    const b = '<script src="/_next/static/ZzZ999/x.js"></script>"buildId":"ZzZ999" at 2026-10-23T01:00:00Z';
    expect(normalisePage(a)).toBe(normalisePage(b));
  });
  it('keeps real content differences', () => {
    expect(normalisePage('<h1>A</h1>')).not.toBe(normalisePage('<h1>B</h1>'));
  });
});

describe('firstDifference', () => {
  it('null when equal; otherwise the first differing position with context', () => {
    expect(firstDifference('abc', 'abc')).toBeNull();
    const d = firstDifference('hello world', 'hello there');
    expect(d?.at).toBe(6);
    expect(d?.candidate).toContain('world');
    expect(d?.rollback).toContain('there');
  });
});

describe('inputs', () => {
  it('the fixed URL list is non-empty and starts at the home page', () => {
    expect(FIXED_URLS[0]).toBe('/');
    expect(FIXED_URLS.length).toBeGreaterThanOrEqual(10);
  });
  it('row counts come from the exact count header', () => {
    expect(countFromContentRange('0-0/7203')).toBe(7203);
    expect(countFromContentRange('*/0')).toBe(0);
    expect(countFromContentRange(null)).toBeNull();
    expect(TABLES).toEqual(['sets', 'store_prices', 'price_history']);
  });
});

// scripts/technical-hygiene.mjs: the weekly check's limits, verdict list and exit rule. The script runs its checks at
// import time, so these read its source text.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '../scripts/technical-hygiene.mjs'), 'utf8');

describe('weekly check: price freshness', () => {
  it('the store price limit is 26 hours, and the alert compares against it', () => {
    expect(src).toMatch(/const STALENESS_LIMIT_HOURS = 26;/);
    expect(src).toMatch(/if \(ageHours > STALENESS_LIMIT_HOURS\)/);
    expect(src).not.toMatch(/ageHours > 8\b/);
  });
});

describe('weekly check: review verdicts', () => {
  it('the allowed list has the five live verdicts', () => {
    const m = /const VALID_VERDICTS = new Set\(\[([^\]]+)\]\)/.exec(src);
    expect(m).not.toBeNull();
    const verdicts = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
    expect(verdicts).toEqual(['AVOID', 'BUY NOW', 'HUNT IT', 'IMPORT ONLY', 'WAIT']);
  });
  it('only one check reports an invalid verdict', () => {
    expect(src.match(/new Set\(\['BUY NOW'/g) ?? []).toHaveLength(1);
    expect(src).not.toMatch(/ReviewVerdict/);
  });
});

describe('weekly check: one email per run', () => {
  it('the job fails only when the report was not sent', () => {
    expect(src).toMatch(/if \(!reportSent\) process\.exit\(1\);/);
    expect(src).not.toMatch(/if \(alerts\.length > 0\) process\.exit\(1\);/);
  });
  it('the report is sent before that exit decision', () => {
    expect(src.indexOf('reportSent = true')).toBeLessThan(src.indexOf('if (!reportSent) process.exit(1);'));
  });
});

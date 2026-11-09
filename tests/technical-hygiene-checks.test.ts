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

// The regex literals exactly as the script declares them.
const literal = (name: string) => {
  const m = new RegExp(`const ${name} = (\\/.+\\/[gimsuy]*);`).exec(src);
  if (!m) throw new Error(`${name} not found`);
  return new Function(`return ${m[1]}`)() as RegExp;
};
const BOLD_PAIR_RE = literal('BOLD_PAIR_RE');
const UNPAIRED_STAR_RE = literal('UNPAIRED_STAR_RE');
const STORE_NAME_RE = literal('STORE_NAME_RE');
const leaks = (content: string) => UNPAIRED_STAR_RE.test(content.replace(BOLD_PAIR_RE, '$1'));

describe('weekly check: asterisks in article text', () => {
  it('properly paired bold is not flagged (the Godzilla case: bold around "Verdict: WAIT")', () => {
    expect(leaks('**Verdict: WAIT** The set is fine. **Price: ₹1,299** at the store.')).toBe(false);
  });
  it('an unpaired double asterisk is flagged', () => {
    expect(leaks('**Verdict: WAIT The set is fine.')).toBe(true);
    expect(leaks('Verdict: WAIT** The set is fine.')).toBe(true);
  });
  it('an isolated single asterisk before a word is flagged, a spaced multiplication sign is not', () => {
    expect(leaks('a stray*word in the text')).toBe(true);
    expect(leaks('5 * 3 pieces per pack')).toBe(false);
  });
});

describe('weekly check: store names in articles', () => {
  it('counts Toycra, MyBrickHouse, LEGO.in, Flipkart and Amazon in any case', () => {
    for (const name of ['Toycra', 'MYBRICKHOUSE', 'lego.in', 'Flipkart', 'AMAZON']) {
      expect(STORE_NAME_RE.test(`Available at ${name} for ₹1,299.`), name).toBe(true);
    }
  });
  it('an article that names none of them does not match', () => {
    expect(STORE_NAME_RE.test('A set reviewed for ₹1,299 with no store named.')).toBe(false);
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

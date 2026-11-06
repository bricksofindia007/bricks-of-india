// The weekly hygiene staleness check uses the same 36-hour window as the store-age check (order 0760).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const src = readFileSync(join(root, 'scripts/technical-hygiene.mjs'), 'utf8');

describe('technical hygiene: store price staleness', () => {
  it('the threshold is 36 hours', () => {
    expect(src).toMatch(/^const STALE_HOURS = 36;$/m);
  });

  it('the alert compares the store age with STALE_HOURS, not a literal', () => {
    expect(src).toMatch(/if \(ageHours > STALE_HOURS\) \{/);
    expect(src).not.toMatch(/ageHours > 8\b/);
  });

  it('the alert text names the threshold it used', () => {
    expect(src).toMatch(/\(threshold: \$\{STALE_HOURS\}h\)/);
    expect(src).not.toMatch(/threshold: 8h/);
  });

  it('the check still covers the same stores and the same read', () => {
    expect(src).toMatch(/const stores = \['mybrickhouse', 'toycra'\];/);
    expect(src).toMatch(/\.from\('store_prices'\)/);
  });
});

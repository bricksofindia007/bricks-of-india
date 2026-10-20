// The display-name file is the one source for store names. Each reader (TypeScript and Python) reads that file, and the
// consumers in the code use it rather than their own literals.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { storeDisplayName, STORE_DISPLAY_NAMES } from '../src/lib/store-display-names';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

// The stores in the registry. The FP5.1 registry migration (20260927152208) is a frozen, applied migration and is not
// read here: it seeded "MyBrickHouse" as the display name. The live name is set by a data update on 2026-10-01, and
// production was verified LEGO.in. The display-name file is therefore the source; the migration is not edited.
const REGISTRY_STORES: Record<string, string> = {
  mybrickhouse: 'LEGO.in',
  toycra: 'Toycra',
};

describe('store display names: config file', () => {
  it('the file has exactly the registry stores, no extras', () => {
    expect(Object.keys(STORE_DISPLAY_NAMES).sort()).toEqual(Object.keys(REGISTRY_STORES).sort());
  });
  it('each store has its registry display name', () => {
    for (const [slug, name] of Object.entries(REGISTRY_STORES)) expect(STORE_DISPLAY_NAMES[slug]).toBe(name);
  });
  it('the display name for mybrickhouse is LEGO.in, as in production', () => {
    expect(storeDisplayName('mybrickhouse')).toBe('LEGO.in');
  });
  it('an unknown slug shows as itself', () => {
    expect(storeDisplayName('jaiman')).toBe('jaiman');
  });
});

describe('store display names: readers and consumers use the file', () => {
  it('the Python reader reads the same file', () => {
    expect(read('scripts/lib/store_display_names.py')).toMatch(/config" \/ "store-display-names\.json"/);
  });
  it('the review disclaimer reads store names from the file, not from its own literals', () => {
    const src = read('src/lib/review-disclaimer.ts');
    expect(src).toMatch(/from '\.\/store-display-names'/);
    expect(src).not.toMatch(/mybrickhouse:\s*'LEGO\.in'/);
  });
});

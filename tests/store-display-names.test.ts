// The display-name file matches the stores table's seed, and both readers return the same names.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { storeDisplayName, STORE_DISPLAY_NAMES } from '../src/lib/store-display-names';

const root = join(__dirname, '..');

/** (slug, display name) pairs from the stores seed (the INSERT rows in the registry migration). */
function seedRows(): Array<[string, string]> {
  const sql = readFileSync(join(root, 'supabase/migrations/20260927152208_fp51_stores_registry.sql'), 'utf8');
  return [...sql.matchAll(/\('([a-z0-9_]+)',\s*'([^']+)',\s*'https?:/g)].map((m) => [m[1], m[2]] as [string, string]);
}

describe('store display names match the stores seed', () => {
  const seed = seedRows();
  it('the seed has the expected stores', () => {
    expect(seed.map(([s]) => s)).toEqual(['mybrickhouse', 'toycra']);
  });
  it('every seed slug has the same display name in the file', () => {
    for (const [slug, name] of seed) expect(STORE_DISPLAY_NAMES[slug]).toBe(name);
  });
  it('the file has no extra stores beyond the seed', () => {
    expect(Object.keys(STORE_DISPLAY_NAMES).sort()).toEqual(seed.map(([s]) => s).sort());
  });
  it('the display name for mybrickhouse is LEGO.in, as in production', () => {
    expect(storeDisplayName('mybrickhouse')).toBe('LEGO.in');
  });
  it('an unknown slug shows as itself', () => {
    expect(storeDisplayName('jaiman')).toBe('jaiman');
  });
  it('the Python reader reads the same file', () => {
    const py = readFileSync(join(root, 'scripts/lib/store_display_names.py'), 'utf8');
    expect(py).toMatch(/config" \/ "store-display-names\.json"/);
  });
});

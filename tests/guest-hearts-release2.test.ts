// Release 2 guest hearts (order 1510 item 1). Hearts are on for guests with no sign-in; My Collection and accounts stay off.
// Static checks only: no network, no cookies. Guardrail G1 (public pages send no cookies and stay cached) and G2 (the
// added request count per visit is zero: hearts are kept in the browser).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

const flagsTs = read('src/lib/feature-flags.ts');
const flagsPy = read('config/feature_flags.py');

describe('release 2: guest hearts switch', () => {
  it('the app switch for hearts is on', () => {
    expect(flagsTs).toMatch(/^\s*myCollectionHearts: true,/m);
  });
  it('the config mirror for hearts is on, in sync with the app switch', () => {
    expect(flagsPy).toMatch(/"my_collection_hearts": True,/);
  });
  it('My Collection page and accounts stay off, in both files', () => {
    expect(flagsTs).toMatch(/^\s*myCollectionPage: false,/m);
    expect(flagsTs).toMatch(/^\s*accountsEnabled: false,/m);
    expect(flagsPy).toMatch(/"my_collection_page": False,/);
    expect(flagsPy).toMatch(/"accounts_enabled": False,/);
  });
});

describe('release 2: guest hearts send nothing and read no cookies (G1, G2)', () => {
  const files = ['src/components/saved/SaveButtons.tsx', 'src/components/saved/CollectionSlots.tsx', 'src/lib/my-collection.ts'];
  for (const f of files) {
    it(`${f} makes no network call and reads no cookie or request header`, () => {
      const src = read(f);
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/document\.cookie/);
      expect(src).not.toMatch(/\bcookies\(\)/);
      expect(src).not.toMatch(/\bheaders\(\)/);
    });
  }
  it('the hearts are kept in the browser under the wishlist key', () => {
    expect(read('src/lib/my-collection.ts')).toMatch(/WISHLIST_KEY = 'boi_wishlist'/);
  });
  it('the heart slot is a client component', () => {
    expect(read('src/components/saved/CollectionSlots.tsx').split('\n')[0]).toMatch(/'use client'/);
  });
});

describe('release 2: approved voice lines unchanged', () => {
  it('the heart and empty-state lines are the approved ones, exactly', () => {
    const src = read('src/lib/my-collection.ts');
    expect(src).toContain("heartAdded: 'Saved. Your wallet has been notified.'");
    expect(src).toContain("heartRemoved: 'Removed. Your wallet is relieved.'");
    expect(src).toContain("wishlistEmpty: 'Nothing saved yet. Your wallet admires your patience.'");
  });
});

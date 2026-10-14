// A1 (1 Oct 2026): set numbers that contain "-" resolve to their own set page.
import { describe, it, expect } from 'vitest';
import { setNumberCandidates, pickSetNumber, slugMatchesSet } from '../src/lib/set-slug';
import { slugify } from '../src/lib/utils';

// The 12 broken pages from the 1 Oct crawl, plus neighbours that share a first segment.
const CATALOGUE = [
  ['Pick-a-Brick-2026', '2026 Pick-a-Brick and Bricks & Pieces Parts'],
  ['Pick-a-Brick', 'Pre-2021 Pick-a-Brick and Bricks & Pieces Parts'],
  ['WIZARD-PORTRAITS', 'Wizard Portraits Tiles'],
  ['WIZARD-CARDS', 'Wizard Cards Tiles'],
  ['DOTS-HP', 'DOTS Collectible Tiles 41811-1 Hogwarts Desktop Kit'],
  ['DOTS-MEGA-PACK', 'DOTS Collectible Tiles 41913-1 Mega Pack'],
  ['DOTS-PROMO', 'DOTS Promotional Packs'],
  ['DOTS-SERIES', 'DOTS Collectible Tiles Series 1'],
  ['VIDIYO-TILES', 'VIDIYO Tiles - Database Set'],
  ['BONSAI-2', 'Lovely Bonsai Tree'],
  ['DUCK-2', 'Duck'],
  ['DATABASE-2026', '2026 - Unused Parts Database Set'],
  ['DATABASE-2025', '2025 - Unused Parts Database Set'],
  ['71051', 'Series 28 Minifigures'],
  ['71051-6', 'Koala Suit'],
  ['10316', 'Lord of the Rings: Rivendell'],
].map(([set_number, name]) => ({ set_number, name }));
const slugOf = (s: { set_number: string; name: string }) => `${s.set_number}-${slugify(s.name)}`;
const known = (slug: string) => CATALOGUE.filter((s) => setNumberCandidates(slug).includes(s.set_number));

describe('set slug resolution', () => {
  it.each(CATALOGUE.map((s) => [slugOf(s), s.set_number]))('%s -> %s', (slug, num) => {
    expect(pickSetNumber(slug, known(slug))).toBe(num);
  });
  it('the 8 former 404s and 4 former wrong-set pages all resolve to themselves', () => {
    const twelve = ['Pick-a-Brick-2026', 'WIZARD-PORTRAITS', 'DOTS-HP', 'DOTS-MEGA-PACK', 'VIDIYO-TILES', 'WIZARD-CARDS', 'DOTS-PROMO', 'DOTS-SERIES', 'BONSAI-2', 'DUCK-2', 'DATABASE-2026', 'DATABASE-2025'];
    for (const n of twelve) { const s = CATALOGUE.find((c) => c.set_number === n)!; expect(pickSetNumber(slugOf(s), known(slugOf(s)))).toBe(n); }
  });
  it('an old or renamed slug still lands on the longest existing set number', () => {
    expect(pickSetNumber('71051-6-old-name', known('71051-6-old-name'))).toBe('71051-6');
    expect(pickSetNumber('10316-rivendell', known('10316-rivendell'))).toBe('10316');
  });
  it('unknown slugs resolve to nothing (page falls back as before)', () => {
    expect(pickSetNumber('99999-nothing', [])).toBeNull();
  });
  it('a normal set page matches on its first segment (no extra lookup)', () => {
    expect(slugMatchesSet('10316-lord-of-the-rings-rivendell', CATALOGUE.find((c) => c.set_number === '10316')!)).toBe(true);
    expect(slugMatchesSet('BONSAI-2-lovely-bonsai-tree', { set_number: 'BONSAI', name: '55cm Bonsai Tree Model' })).toBe(false);
  });
});

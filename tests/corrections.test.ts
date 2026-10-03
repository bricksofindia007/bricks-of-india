import { describe, it, expect } from 'vitest';
import { extractCorrections, STORE_RENAME_NOTE } from '../src/lib/corrections';

describe('corrections page: dated notes in article text', () => {
  it('reads the formats in use', () => {
    const text = [
      'Body text.',
      'Correction (26 Sep 2026): an earlier version of this article listed the wrong set number and price. Both have been fixed.',
      '*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India.*',
      'Corrected 29 Sep 2026, updated 30 Sep 2026: an earlier version included an unverified price estimate, which has been removed.',
      'Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.',
    ].join('\n');
    const n = extractCorrections(text);
    expect(n.map((x) => x.date)).toEqual(['2026-09-26', '2026-10-01', '2026-09-29', '2026-10-01']);
    expect(n[1].text).toBe('an earlier version of this review said this set was no longer available in India.');
  });
  it('ignores normal sentences and empty text', () => {
    expect(extractCorrections('We updated our list on Monday. Correction needed? Tell us.')).toEqual([]);
    expect(extractCorrections(null)).toEqual([]);
  });
  it('recognises the repeated store-rename note', () => {
    expect(STORE_RENAME_NOTE.test("MyBrickHouse's online store is now LEGO.in.")).toBe(true);
  });
});

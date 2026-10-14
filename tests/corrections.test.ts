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

import { noteParts, groupKey, groupLabel } from '../src/lib/corrections';
describe('corrections page display (3 Oct 2026)', () => {
  it('renders markdown links as links and capitalises the first letter', () => {
    expect(noteParts('an earlier version said X. See the [LEGO Tiger (31217) price page](/sets/31217-tiger).')).toEqual([
      { text: 'An earlier version said X. See the ' }, { text: 'LEGO Tiger (31217) price page', href: '/sets/31217-tiger' }, { text: '.' },
    ]);
  });
  it('groups notes that differ only by their link, per date', () => {
    const a = 'an earlier version called this set retired. See [A](/sets/1-a).';
    const b = 'an earlier version called this set retired. See [B](/sets/2-b).';
    expect(groupKey('2026-10-02', a)).toBe(groupKey('2026-10-02', b));
    expect(groupKey('2026-10-02', a)).not.toBe(groupKey('2026-10-01', a));
  });
  it('labels the big groups in plain words', () => {
    expect(groupLabel('estimated price removed; official Indian pricing not yet announced.', 103)).toBe('Removed unverified price estimates from 103 articles.');
    expect(groupLabel('an earlier version of this review called this set retired and unavailable in India.', 23)).toBe("Corrected 23 reviews that wrongly said the set couldn't be bought in India.");
  });
});

describe('round 11: price-store note groups into one entry', () => {
  it('labels the grouped note', async () => {
    const { groupLabel, extractCorrections } = await import('../src/lib/corrections');
    const n = extractCorrections('Body.\n\n*Correction (4 October 2026): we corrected which store the price below comes from.*');
    expect(n).toEqual([{ date: '2026-10-04', text: 'we corrected which store the price below comes from.' }]);
    expect(groupLabel(n[0].text, 87)).toBe('Corrected which store a price came from on 87 reviews.');
  });
});

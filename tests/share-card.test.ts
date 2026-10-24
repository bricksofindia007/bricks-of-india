// Share card for My Collection and the wishlist (pillar H, flag off). The card carries the list name, the set count and
// the approved line only: no rupee value, no set name, no price, no store.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cardCopy, cardFileName, drawShareCard, CARD_SIZES, type CardCanvas } from '../src/lib/share-card';
import { SHARE_TEXT } from '../src/lib/share';

const root = join(__dirname, '..');

function recorder(): CardCanvas & { texts: string[] } {
  const texts: string[] = [];
  return {
    fillStyle: '',
    font: '',
    textAlign: 'start',
    fillRect() {},
    fillText(t: string) { texts.push(t); },
    texts,
  };
}

describe('card words', () => {
  it('uses the approved collection share line exactly', () => {
    expect(SHARE_TEXT.collectionShared).toBe('Your list, shared. Take a bow');
    expect(cardCopy('collection', 3).line).toBe('Your list, shared. Take a bow');
    expect(cardCopy('wishlist', 3).line).toBe('Your list, shared. Take a bow');
  });
  it('names the list and counts sets, singular and plural', () => {
    expect(cardCopy('collection', 1)).toMatchObject({ heading: 'My Collection', count: '1 set' });
    expect(cardCopy('wishlist', 12)).toMatchObject({ heading: 'My Wishlist', count: '12 sets' });
    expect(cardCopy('wishlist', 0).count).toBe('0 sets');
  });
  it('clamps a bad count to zero or a whole number', () => {
    expect(cardCopy('collection', -4).count).toBe('0 sets');
    expect(cardCopy('collection', Number.NaN).count).toBe('0 sets');
    expect(cardCopy('collection', 2.9).count).toBe('2 sets');
  });
  it('never contains a rupee value, a price, a store or a set name', () => {
    const all = JSON.stringify([cardCopy('collection', 40), cardCopy('wishlist', 40)]);
    expect(all).not.toMatch(/₹|Rs\.?\s?\d|INR|\$|price|store/i);
  });
  it('the file name carries the list and the format only', () => {
    expect(cardFileName('collection', 'square')).toBe('my-collection-square.png');
    expect(cardFileName('wishlist', 'story')).toBe('my-wishlist-story.png');
  });
});

describe('drawing', () => {
  it('draws only the card words, in the approved size', () => {
    const ctx = recorder();
    drawShareCard(ctx, 'story', cardCopy('wishlist', 5));
    expect(ctx.texts).toEqual(['My Wishlist', '5 sets', 'Your list, shared. Take a bow', 'bricksofindia.com']);
  });
  it('story format is 1080 by 1920; square is 1080 by 1080', () => {
    expect(CARD_SIZES.story).toEqual({ width: 1080, height: 1920 });
    expect(CARD_SIZES.square).toEqual({ width: 1080, height: 1080 });
  });
});

describe('the component is gated by the share flag', () => {
  const src = readFileSync(join(root, 'src/components/share/CollectionShare.tsx'), 'utf8');
  it('renders nothing while shareEnabled is off, and checks the flag before any work', () => {
    const gate = src.indexOf('if (!shareEnabled(FEATURE_FLAGS)) return null;');
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(src.indexOf('async function buildCard'));
  });
  it('sends nothing: no fetch, no beacon, no analytics call', () => {
    expect(src).not.toMatch(/fetch\(|sendBeacon|trackEvent|XMLHttpRequest/);
  });
  it('the flag is off in both mirrored files', () => {
    const ts = readFileSync(join(root, 'src/lib/feature-flags.ts'), 'utf8');
    const py = readFileSync(join(root, 'config/feature_flags.py'), 'utf8');
    expect(ts).toMatch(/shareEnabled: false,/);
    expect(py).toMatch(/"share_enabled": False,/);
  });
});

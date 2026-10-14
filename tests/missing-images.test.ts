import { describe, it, expect } from 'vitest';
import { isKnownMissingImage } from '../src/lib/missing-images';
import { buildAggregateOffer } from '../src/lib/schemas';

describe('isKnownMissingImage (3 Oct 2026 site check)', () => {
  it('matches a missing Rebrickable image in original and resized form', () => {
    expect(isKnownMissingImage('https://cdn.rebrickable.com/media/sets/42233-f/173439.jpg')).toBe(true);
    expect(isKnownMissingImage('https://cdn.rebrickable.com/media/thumbs/sets/42233-f/173439.jpg/250x250p.jpg')).toBe(true);
    expect(isKnownMissingImage('https://cdn.rebrickable.com/media/thumbs/sets/42233-f/173439.jpg/1000x800p.jpg')).toBe(true);
  });
  it('matches a missing Brickset image', () => {
    expect(isKnownMissingImage('https://images.brickset.com/sets/images/TSHIRT-1.jpg')).toBe(true);
  });
  it('leaves working and local images alone', () => {
    expect(isKnownMissingImage('https://cdn.rebrickable.com/media/sets/10329-1/10329-1.jpg')).toBe(false);
    expect(isKnownMissingImage('https://images.brickset.com/sets/images/75192-1.jpg')).toBe(false);
    expect(isKnownMissingImage('/images/lego-placeholder.svg')).toBe(false);
    expect(isKnownMissingImage(null)).toBe(false);
  });
});

describe('buildAggregateOffer: no real price, no offer (3 Oct 2026)', () => {
  const NAMES = { legoin: 'LEGO.in' };
  it('a price of 0 is left out; with nothing left there is no offer (the /sets/43302 case)', () => {
    expect(buildAggregateOffer([{ store_id: 'legoin', price_inr: 0, in_stock: false, scraped_at: null }] as any, NAMES, 'u')).toBeUndefined();
  });
  it('a 0 row next to a real sold-out price keeps only the real one', () => {
    const o: any = buildAggregateOffer([
      { store_id: 'legoin', price_inr: 0, in_stock: false, scraped_at: null },
      { store_id: 'toycra', price_inr: 4999, in_stock: false, scraped_at: null },
    ] as any, NAMES, 'u');
    expect(o).toHaveLength(1);
    expect(o[0].price).toBe(4999);
  });
});

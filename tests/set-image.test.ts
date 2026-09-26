import { describe, it, expect } from 'vitest';
import { rebrickableResized } from '../src/lib/set-image';

describe('rebrickableResized', () => {
  it('maps nested Rebrickable originals to the resized CDN path', () => {
    expect(rebrickableResized('https://cdn.rebrickable.com/media/sets/10332-1/137285.jpg', '250x250'))
      .toBe('https://cdn.rebrickable.com/media/thumbs/sets/10332-1/137285.jpg/250x250p.jpg');
  });
  it('maps flat originals too', () => {
    expect(rebrickableResized('https://cdn.rebrickable.com/media/sets/242-1.jpg', '1000x800'))
      .toBe('https://cdn.rebrickable.com/media/thumbs/sets/242-1.jpg/1000x800p.jpg');
  });
  it('leaves other hosts and already-resized URLs alone', () => {
    const b = 'https://images.brickset.com/sets/images/10332-1.jpg';
    expect(rebrickableResized(b, '250x250')).toBe(b);
    const t = 'https://cdn.rebrickable.com/media/thumbs/sets/10332-1/137285.jpg/250x250p.jpg';
    expect(rebrickableResized(t, '250x250')).toBe(t);
  });
});

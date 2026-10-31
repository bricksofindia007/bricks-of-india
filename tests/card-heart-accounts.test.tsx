// While accounts are on, the heart on a set card is hidden (order 0380 item 3, D-2026-10-30-10). With accounts off the
// heart shows as before. The set page and My Collection keep the heart; their own tests cover that.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const flags = vi.hoisted(() => ({ accountsEnabled: true, myCollectionHearts: true }));
vi.mock('../src/lib/feature-flags', () => ({ FEATURE_FLAGS: flags }));

import { SetCard } from '../src/components/sets/SetCard';

const SET = { set_number: '10307', name: 'Eiffel Tower', image_url: null, pieces: 1000, theme: 'Icons', year: 2024, slug: 'x' } as never;
const HEART_WRAPPER = 'absolute top-2 right-2';

beforeEach(() => {
  flags.accountsEnabled = true;
  flags.myCollectionHearts = true;
});

describe('card hearts while accounts are on', () => {
  it('the card has no heart when accounts are on', () => {
    expect(renderToStaticMarkup(<SetCard set={SET} />)).not.toContain(HEART_WRAPPER);
  });
  it('the card shows the heart when accounts are off (hearts flag on)', () => {
    flags.accountsEnabled = false;
    expect(renderToStaticMarkup(<SetCard set={SET} />)).toContain(HEART_WRAPPER);
  });
  it('the card has no heart when the hearts flag is off, whatever accounts is', () => {
    flags.myCollectionHearts = false;
    flags.accountsEnabled = false;
    expect(renderToStaticMarkup(<SetCard set={SET} />)).not.toContain(HEART_WRAPPER);
  });
});

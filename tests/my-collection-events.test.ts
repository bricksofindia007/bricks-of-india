// My Collection usage events (spec section 9): heart_add, heart_remove, owned_add and my_sets_view go through the
// shared event helper, only while their flag is on, with only the page type and the set number in the payload.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const flags = vi.hoisted(() => ({ myCollectionHearts: true, myCollectionPage: true }));
vi.mock('../src/lib/feature-flags', () => ({ FEATURE_FLAGS: flags }));

const analytics = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('../src/lib/analytics', () => ({ trackEvent: analytics.trackEvent }));

import { trackCollectionEvent } from '../src/lib/my-collection';

const root = join(__dirname, '..');

beforeEach(() => {
  flags.myCollectionHearts = true;
  flags.myCollectionPage = true;
  analytics.trackEvent.mockClear();
});

describe('payload shape', () => {
  it('heart_add sends the page type and the set number, and nothing else', () => {
    trackCollectionEvent('heart_add', { page_type: 'sets_list', set_number: '10307' });
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('heart_add', { page_type: 'sets_list', set_number: '10307' });
  });
  it('heart_remove has the same shape', () => {
    trackCollectionEvent('heart_remove', { page_type: 'sets_list', set_number: '10307' });
    expect(analytics.trackEvent).toHaveBeenCalledWith('heart_remove', { page_type: 'sets_list', set_number: '10307' });
  });
  it('owned_add has the same shape', () => {
    trackCollectionEvent('owned_add', { page_type: 'set', set_number: '10307' });
    expect(analytics.trackEvent).toHaveBeenCalledWith('owned_add', { page_type: 'set', set_number: '10307' });
  });
  it('my_sets_view sends the page type only, with no set number', () => {
    trackCollectionEvent('my_sets_view', { page_type: 'sets_list' });
    expect(analytics.trackEvent).toHaveBeenCalledWith('my_sets_view', { page_type: 'sets_list' });
  });
  it('no personal data: extra keys (a name, a note, a price) never reach the event', () => {
    const sneaky = { page_type: 'sets_list', set_number: '10307', name: 'Star Wars', note: 'for Sam', price_inr: 41199 };
    trackCollectionEvent('heart_add', sneaky as unknown as { page_type: string; set_number: string });
    const [, payload] = analytics.trackEvent.mock.calls[0];
    expect(Object.keys(payload).sort()).toEqual(['page_type', 'set_number']);
  });
  it('the four event names are the ones the shared helper allows', () => {
    const allowed = readFileSync(join(root, 'src/lib/analytics.ts'), 'utf8');
    for (const name of ['heart_add', 'heart_remove', 'owned_add', 'my_sets_view']) {
      expect(allowed).toMatch(new RegExp(`${name}: \\[`));
    }
  });
});

describe('no event when the flag is off', () => {
  it('hearts flag off: heart and owned events are not sent', () => {
    flags.myCollectionHearts = false;
    trackCollectionEvent('heart_add', { page_type: 'sets_list', set_number: '10307' });
    trackCollectionEvent('heart_remove', { page_type: 'sets_list', set_number: '10307' });
    trackCollectionEvent('owned_add', { page_type: 'set', set_number: '10307' });
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });
  it('page flag off: my_sets_view is not sent', () => {
    flags.myCollectionPage = false;
    trackCollectionEvent('my_sets_view', { page_type: 'sets_list' });
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });
  it('the page flag alone does not turn on the heart events, and the other way round', () => {
    flags.myCollectionHearts = false;
    flags.myCollectionPage = true;
    trackCollectionEvent('heart_add', { page_type: 'sets_list', set_number: '10307' });
    trackCollectionEvent('my_sets_view', { page_type: 'sets_list' });
    expect(analytics.trackEvent.mock.calls.map((c) => c[0])).toEqual(['my_sets_view']);
  });
});

describe('every call site goes through the helper, not the raw event call', () => {
  it('no My Collection file calls the raw event helper for these four names', () => {
    for (const f of ['src/components/saved/SaveButtons.tsx', 'src/app/my/MyCollection.tsx', 'src/app/lab/cmf-tracker/FigureHeart.tsx']) {
      const src = readFileSync(join(root, f), 'utf8');
      expect(src, f).not.toMatch(/trackEvent\('(heart_add|heart_remove|owned_add|my_sets_view)'/);
    }
  });
});

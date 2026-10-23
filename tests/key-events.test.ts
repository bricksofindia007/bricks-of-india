import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { trackKeyEvent, KEY_EVENTS } from '../src/lib/key-events';
import { sanitizeParams } from '../src/lib/analytics';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';

const flags = FEATURE_FLAGS as unknown as Record<string, boolean>;
let gtag: ReturnType<typeof vi.fn>;

beforeEach(() => {
  gtag = vi.fn();
  (globalThis as any).window = { gtag };
});
afterEach(() => {
  delete (globalThis as any).window;
  flags.keyEvents = false;
});

describe('key events: flag off', () => {
  it('sends nothing', () => {
    expect(trackKeyEvent('sign_up', { page_type: 'home' })).toBe(false);
    expect(trackKeyEvent('add_to_wishlist', { page_type: 'set', set_number: '75192' })).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });
});

describe('key events: flag on', () => {
  beforeEach(() => { flags.keyEvents = true; });

  it('sends an allowlisted event with only allowed parameters', () => {
    trackKeyEvent('add_to_wishlist', { page_type: 'set', set_number: '75192', email: 'x@example.com' });
    expect(gtag).toHaveBeenCalledWith('event', 'add_to_wishlist', { page_type: 'set', set_number: '75192' });
  });

  it('refuses a name that is not a key event', () => {
    expect(trackKeyEvent('not_a_key_event' as any, {})).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it('does not re-send the store click from this module', () => {
    expect(trackKeyEvent('click_store_listing', { page_type: 'set' })).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it('sends a standee visit with a source tag from the closed list', () => {
    trackKeyEvent('standee_visit', { page_type: 'home', source: 'standee_qr' });
    expect(gtag).toHaveBeenCalledWith('event', 'standee_visit', { page_type: 'home', source: 'standee_qr' });
  });

  it('drops a standee source tag that is not on the list', () => {
    trackKeyEvent('standee_visit', { page_type: 'home', source: 'made_up_tag' });
    expect(gtag).toHaveBeenCalledWith('event', 'standee_visit', { page_type: 'home' });
  });

  it('with no GA script loaded, nothing is sent and nothing throws', () => {
    (globalThis as any).window = {};
    expect(() => trackKeyEvent('sign_up', { page_type: 'home' })).not.toThrow();
  });
});

describe('key event list', () => {
  it('has the six agreed events', () => {
    expect([...KEY_EVENTS].sort()).toEqual(
      ['add_to_collection', 'add_to_wishlist', 'alert_set', 'click_store_listing', 'sign_up', 'standee_visit'],
    );
  });
  it('sanitizeParams keeps only allowed keys for sign_up', () => {
    expect(sanitizeParams('sign_up', { page_type: 'home', set_number: '75192' })).toEqual({ page_type: 'home' });
  });
});

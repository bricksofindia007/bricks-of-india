import { describe, expect, it, vi, afterEach } from 'vitest';
import { sanitizeParams, hostOf, trackEvent } from '@/lib/analytics';

describe('sanitizeParams', () => {
  it('keeps only the parameters an event allows', () => {
    const out = sanitizeParams('click_store_listing', {
      page_type: 'set', store: 'mybrickhouse', set_number: '75419', position: 2, email: 'x@y.z', extra: 1,
    });
    expect(out).toEqual({ page_type: 'set', store: 'mybrickhouse', set_number: '75419', position: 2 });
  });

  it('takes the store value as the registry id, and rejects anything else', () => {
    expect(sanitizeParams('click_store_listing', { store: 'toycra' })).toEqual({ store: 'toycra' });
    expect(sanitizeParams('click_store_listing', { store: 'LEGO.in' })).toEqual({});
    expect(sanitizeParams('click_store_listing', { store: 'a b' })).toEqual({});
    expect(sanitizeParams('click_store_listing', { store: 'x'.repeat(41) })).toEqual({});
  });

  it('accepts any registry id without a code change (a new store needs no edit here)', () => {
    expect(sanitizeParams('click_store_listing', { store: 'jaiman_toys' })).toEqual({ store: 'jaiman_toys' });
    expect(sanitizeParams('click_store_listing', { store: 'hamleys' })).toEqual({ store: 'hamleys' });
    expect(sanitizeParams('click_store_listing', { store: 'firstcry' })).toEqual({ store: 'firstcry' });
  });

  it('rejects page types outside the closed list', () => {
    expect(sanitizeParams('search_submit', { page_type: 'compare', search_length: 4 })).toEqual({ page_type: 'compare', search_length: 4 });
    expect(sanitizeParams('search_submit', { page_type: 'made_up' })).toEqual({});
  });

  it('limits budget to the four bands', () => {
    expect(sanitizeParams('submit_budget_calculator', { budget_band: '2000_5000' })).toEqual({ budget_band: '2000_5000' });
    expect(sanitizeParams('submit_budget_calculator', { budget_band: '5000' })).toEqual({});
  });

  it('keeps set numbers only in the set-number format', () => {
    expect(sanitizeParams('click_related_set', { set_number: '10305-1' })).toEqual({ set_number: '10305-1' });
    expect(sanitizeParams('click_related_set', { set_number: 'Death Star' })).toEqual({});
  });

  it('sends the registry display name as store_name', () => {
    expect(sanitizeParams('click_store_listing', { store: 'mybrickhouse', store_name: 'LEGO.in' })).toEqual({ store: 'mybrickhouse', store_name: 'LEGO.in' });
    expect(sanitizeParams('click_store_listing', { store_name: 'Toycra' })).toEqual({ store_name: 'Toycra' });
    expect(sanitizeParams('click_store_listing', { store_name: '<script>' })).toEqual({});
    expect(sanitizeParams('click_store_listing', { store_name: 'x'.repeat(61) })).toEqual({});
  });

  it('related-set clicks carry the store id, name and position', () => {
    expect(sanitizeParams('click_related_set', { page_type: 'compare', store: 'toycra', store_name: 'Toycra', set_number: '75419', position: 3 }))
      .toEqual({ page_type: 'compare', store: 'toycra', store_name: 'Toycra', set_number: '75419', position: 3 });
  });

  it('sends search length, never search text', () => {
    expect(sanitizeParams('search_submit', { search_length: 9, query: 'death star' })).toEqual({ search_length: 9 });
  });

  it('returns nothing for an unknown event name', () => {
    expect(sanitizeParams('not_an_event', { page_type: 'set' })).toEqual({});
  });
});

describe('hostOf', () => {
  it('returns the host without www, and null for a bad URL', () => {
    expect(hostOf('https://www.amazon.in/s?k=LEGO')).toBe('amazon.in');
    expect(hostOf('https://www.flipkart.com/search?q=x')).toBe('flipkart.com');
    expect(hostOf('not a url')).toBeNull();
  });
});

describe('trackEvent', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('does nothing when GA is not loaded', () => {
    (globalThis as { window?: unknown }).window = {};
    expect(() => trackEvent('click_store_listing', { store: 'toycra' })).not.toThrow();
  });

  it('sends one event with sanitized parameters when GA is loaded', () => {
    const gtag = vi.fn();
    (globalThis as { window?: unknown }).window = { gtag };
    trackEvent('click_store_listing', { page_type: 'set', store: 'toycra', email: 'no' });
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith('event', 'click_store_listing', { page_type: 'set', store: 'toycra' });
  });

  it('sends nothing for an unknown event name', () => {
    const gtag = vi.fn();
    (globalThis as { window?: unknown }).window = { gtag };
    trackEvent('made_up_event', {});
    expect(gtag).not.toHaveBeenCalled();
  });
});

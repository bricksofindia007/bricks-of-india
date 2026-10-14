// Item 0 (P14 round 8): the India-only availability rule.
import { describe, it, expect } from 'vitest';
import {
  computeIndiaStatus, indiaStatusLine, mayCallRetired, RETIRED_NO_PRICE_LINE, RETIRED_WORDING,
} from '../src/lib/india-status';
import { reviewAvailabilityFindings } from '../scripts/lib/retirement-report.mjs';

const now = new Date('2026-10-02T00:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 864e5).toISOString();

describe('computeIndiaStatus', () => {
  it('71848: LEGO-retired but LEGO.in ₹22,899 and Toycra ₹14,999 in stock -> available, no retired wording', () => {
    const s = computeIndiaStatus({
      legoRetired: true,
      listings: [{ storeName: 'LEGO.in', inStock: true }, { storeName: 'Toycra', inStock: true }],
      recentStockEventsAt: [],
      now,
    });
    expect(s.kind).toBe('available');
    expect(mayCallRetired(s)).toBe(false);
    expect(indiaStatusLine(s)).toBeNull();
  });

  it('retired, no Indian store, no approx. value -> the exact line', () => {
    const s = computeIndiaStatus({ legoRetired: true, listings: [], recentStockEventsAt: [], now });
    expect(s.kind).toBe('retired');
    expect(indiaStatusLine(s)).toBe('Retired — Price not available. Your wallet is silently thanking you for it.');
    expect(indiaStatusLine(s)).toBe(RETIRED_NO_PRICE_LINE);
  });

  it('retired with an approx. resale value shows the labelled value', () => {
    const s = computeIndiaStatus({
      legoRetired: true, listings: [], recentStockEventsAt: [], now,
      approxResale: { inr: 8350, usd: 100, rate: 83.5, asOf: '2 Oct 2026' },
    });
    expect(indiaStatusLine(s)).toBe("Retired — approx. resale value ≈ ₹8,350 (US$100 × today's rate ₹83.50, 2 Oct 2026).");
  });

  it('listed, all sold out, stock activity 3 days ago -> out of stock, not retired', () => {
    const s = computeIndiaStatus({
      legoRetired: true,
      listings: [{ storeName: 'Toycra', inStock: false }, { storeName: 'LEGO.in', inStock: false }],
      recentStockEventsAt: [daysAgo(3)],
      now,
    });
    expect(s.kind).toBe('out_of_stock');
    expect(indiaStatusLine(s)).toBe('Out of stock at Toycra and LEGO.in.');
  });

  it('sold out for 15 days and LEGO-retired -> retired', () => {
    const s = computeIndiaStatus({
      legoRetired: true, listings: [{ storeName: 'Toycra', inStock: false }], recentStockEventsAt: [daysAgo(15)], now,
    });
    expect(s.kind).toBe('retired');
  });

  it('day 13 is still inside the 14-day window', () => {
    const s = computeIndiaStatus({
      legoRetired: true, listings: [{ storeName: 'Toycra', inStock: false }], recentStockEventsAt: [daysAgo(13)], now,
    });
    expect(s.kind).toBe('out_of_stock');
  });

  it('sold out but NOT LEGO-retired is never retired', () => {
    const s = computeIndiaStatus({ legoRetired: false, listings: [{ storeName: 'Toycra', inStock: false }], recentStockEventsAt: [], now });
    expect(s.kind).toBe('out_of_stock');
    expect(computeIndiaStatus({ legoRetired: false, listings: [], recentStockEventsAt: [], now }).kind).toBe('not_listed');
  });
});

describe('retirement report (weekly job) never writes, only flags', () => {
  it('flags a RETIRED verdict on a set sold in India as needing a buying verdict', () => {
    const f = reviewAvailabilityFindings({ verdict: 'RETIRED', content: 'Verdict: RETIRED. Nothing left to buy.' }, { kind: 'available', inStockAt: ['LEGO.in'] });
    expect(f.map((x) => x.check)).toEqual(['retired_verdict_needs_buying_call', 'retired_wording_on_set_sold_in_india']);
  });
  it('a RETIRED verdict is flagged even when the set is retired in India (never a verdict)', () => {
    const f = reviewAvailabilityFindings({ verdict: 'RETIRED', content: 'ok' }, { kind: 'retired', approxResale: null });
    expect(f.map((x) => x.check)).toEqual(['retired_verdict_needs_buying_call']);
  });
  it('a buying verdict with no retired wording is clean', () => {
    expect(reviewAvailabilityFindings({ verdict: 'BUY NOW', content: 'Great set.' }, { kind: 'available', inStockAt: ['Toycra'] })).toEqual([]);
  });
  it('the old wording is caught', () => {
    expect('This set has been discontinued by LEGO and is no longer available through MyBrickHouse or Toycra.').toMatch(RETIRED_WORDING);
  });
});

describe('HUNT IT / SKIP (chat, 2 Oct 2026)', async () => {
  const { retiredBuyingCall, HUNT_IT_LINE } = await import('../src/lib/india-status');
  it('retired in India, rated 4 or 5 -> HUNT IT; 3 or less (or unrated) -> SKIP', () => {
    expect(retiredBuyingCall(5)).toBe('HUNT IT');
    expect(retiredBuyingCall(4)).toBe('HUNT IT');
    expect(retiredBuyingCall(3)).toBe('SKIP');
    expect(retiredBuyingCall(null)).toBe('SKIP');
    expect(HUNT_IT_LINE).toBe("A great set you'll now only find second-hand.");
  });
  it('the weekly report flags HUNT IT on a set an Indian store sells (10307: LEGO.in in stock)', () => {
    const f = reviewAvailabilityFindings({ verdict: 'HUNT IT', content: 'ok' }, { kind: 'available', inStockAt: ['LEGO.in'] });
    expect(f.map((x) => x.check)).toEqual(['hunt_it_on_set_sold_in_india']);
  });
  it('HUNT IT on a set retired in India (76178) is clean', () => {
    expect(reviewAvailabilityFindings({ verdict: 'HUNT IT', content: 'ok' }, { kind: 'retired', approxResale: null })).toEqual([]);
  });
});

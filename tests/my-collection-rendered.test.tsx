// The real rendered text of the My Collection notes, rendered on the server (react-dom/server, no DOM needed):
// the "unavailable" banner, the owned-row worth lines (rule 4 "Worth not known yet", the estimate, the retired line,
// the dated last-seen line). "No Indian price yet. We\'re watching the shelves." is for wishlist rows only.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OwnedWorthLine, PricesUnavailable } from '../src/app/my/PriceNotes';
import { retiredLine, worthOf, worthInputFor, usableRate, RETIRED_LINE, WORTH_UNKNOWN_LINE, WISHLIST_NO_PRICE_LINE } from '../src/lib/collection-worth';

const NOW = new Date('2026-10-18T06:00:00Z');
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'");

describe('the "prices unavailable" banner, as rendered', () => {
  it('renders the approved line as an alert, with the names still shown by the page', () => {
    const html = renderToStaticMarkup(<PricesUnavailable />);
    expect(html).toContain('role="alert"');
    expect(text(html)).toBe('Prices are unavailable right now. Names and pieces are still shown.');
  });
});

describe('an owned row with no verified Indian price and no US price: rule 4', () => {
  it('shows "Worth not known yet", never the no-price line', () => {
    const w = worthOf(worthInputFor({ set: '10307', qty: 1 }, undefined, true), null, false);
    const out = text(renderToStaticMarkup(<OwnedWorthLine line={w.line} />));
    expect(out).toBe(WORTH_UNKNOWN_LINE);
    expect(out).not.toContain(WISHLIST_NO_PRICE_LINE);
  });
  it('the no-price line is the wishlist copy, and is not an owned-row line', () => {
    expect(WISHLIST_NO_PRICE_LINE).toBe('No Indian price yet. We\'re watching the shelves.');
  });
});

describe('a priced owned row', () => {
  it('a US price with a usable rate shows its estimate line, not the rule 4 line', () => {
    const item = worthInputFor({ set: '10307', qty: 1 }, { best_price_inr: null, us_price_usd: 499 }, true);
    const w = worthOf(item, usableRate({ rate: 88, asOf: '2026-10-18' }, NOW), false);
    const out = text(renderToStaticMarkup(<OwnedWorthLine line={w.line} />));
    expect(out).toMatch(/^About ₹/);
    expect(out).not.toContain(WORTH_UNKNOWN_LINE);
  });
});

describe('the retired line, as rendered', () => {
  it('with no recorded Indian price: the approved sought-after line, which has no number', () => {
    const w = worthOf(worthInputFor({ set: '10307', qty: 1 }, { best_price_inr: null, us_price_usd: 499 }, true), null, true, null);
    const out = text(renderToStaticMarkup(<OwnedWorthLine line={w.line} />));
    expect(out).toBe(RETIRED_LINE);
    expect(out).not.toMatch(/\d|₹/);
  });
  it('with a recorded Indian price still on file, the page shows only the approved line: no price, no date', () => {
    // The page passes no last-seen value (owner ruling). The dated function is kept in the tree but not shown.
    const seen = { priceInr: 12999, observedAt: '2026-03-14T09:00:00Z' };
    const w = worthOf(worthInputFor({ set: '10307', qty: 1 }, { best_price_inr: null, us_price_usd: 499 }, true), null, true, null);
    const out = text(renderToStaticMarkup(<OwnedWorthLine line={w.line} />));
    expect(out).toBe(RETIRED_LINE);
    expect(out).not.toContain('Last seen');
    expect(retiredLine(seen)).toMatch(/^Last seen in India at ₹12,999 \(March 2026\)$/);
  });
  it('a set that is not retired never renders the retired line', () => {
    const w = worthOf(worthInputFor({ set: '10307', qty: 1 }, { best_price_inr: null, us_price_usd: 499 }, true), null, false, null);
    expect(text(renderToStaticMarkup(<OwnedWorthLine line={w.line} />))).not.toBe(RETIRED_LINE);
  });
});

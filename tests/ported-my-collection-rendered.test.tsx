// The real rendered text of the My Collection notes, rendered on the server (react-dom/server, no DOM needed):
// the "unavailable" banner, "No Indian price yet. We\'re watching the shelves.", and the retired line (approved text, and the dated last-seen line).
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OwnedWorthLine, PricesUnavailable } from '../src/app/my/PriceNotes';
import { retiredLine, worthOf, worthInputFor, usableRate, RETIRED_LINE, WORTH_UNKNOWN_LINE } from '../src/lib/collection-worth';

const NOW = new Date('2026-10-18T06:00:00Z');
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'");

describe('the "prices unavailable" banner, as rendered', () => {
  it('renders the approved line as an alert, with the names still shown by the page', () => {
    const html = renderToStaticMarkup(<PricesUnavailable />);
    expect(html).toContain('role="alert"');
    expect(text(html)).toBe('Prices are taking a coffee break. Your sets are still here, safe and sound.');
  });
});

describe('"No Indian price yet. We\'re watching the shelves.", as rendered', () => {
  it('a set with no verified Indian price, once the read has succeeded, shows the no-price line', () => {
    const w = worthOf(worthInputFor({ set: '10307', qty: 1 }, undefined, true), null, false);
    expect(text(renderToStaticMarkup(<OwnedWorthLine line={w.line} />))).toBe(WORTH_UNKNOWN_LINE);
  });
  it('while the read is still going, or when it failed, the row never claims "No Indian price yet. We\'re watching the shelves."', () => {
    const w = worthOf(worthInputFor({ set: '10307', qty: 1 }, undefined, false), null, false);
    expect(text(renderToStaticMarkup(<OwnedWorthLine line={w.line} />))).toBe(WORTH_UNKNOWN_LINE);
  });
  it('a priced set shows its estimate line, not the no-price line', () => {
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
  it('with a recorded Indian price: the dated last-seen line, with the words "last seen"', () => {
    const seen = { priceInr: 12999, observedAt: '2026-03-14T09:00:00Z' };
    const w = worthOf(worthInputFor({ set: '10307', qty: 1 }, { best_price_inr: null, us_price_usd: 499 }, true), null, true, seen);
    const out = text(renderToStaticMarkup(<OwnedWorthLine line={w.line} />));
    expect(out).toBe('Retired. Last seen in India at ₹12,999 (March 2026). Good luck finding one.');
    expect(retiredLine(seen)).toBe(out);
  });
  it('a set that is not retired never renders the retired line', () => {
    const w = worthOf(worthInputFor({ set: '10307', qty: 1 }, { best_price_inr: null, us_price_usd: 499 }, true), null, false, null);
    expect(text(renderToStaticMarkup(<OwnedWorthLine line={w.line} />))).not.toBe(RETIRED_LINE);
  });
});

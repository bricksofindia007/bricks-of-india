// A set card's price, path by path. Four cases: the one with a store badge (A), and the three that can show a price
// with no store badge: a summary with no store recorded (B), two stores tied at the best in-stock price (C), and a
// fallback price with no summary at all (D). For 42222 on the live theme page the path is C.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SetCard } from '../src/components/sets/SetCard';

const SET = {
  set_number: '42222', name: 'Bugatti Chiron Pur Sport Hypercar', image_url: null, pieces: 771, theme: 'Technic',
  year: 2026, age_range: null, lego_mrp_inr: 6999, mrp_verified: true,
} as never;
const NOW = new Date().toISOString();
const summary = (over: Record<string, unknown>) => ({
  best_price_inr: 6999, best_store_ids: ['lego_in'], in_stock_store_count: 1, best_scraped_at: NOW,
  anchor_mrp_inr: null, deal_tier: null, discount_pct: null, ...over,
}) as never;
const render = (props: object) => renderToStaticMarkup(<SetCard set={SET} {...(props as object)} />);

describe('path A: one store in stock, the store badge shows', () => {
  it('shows the price with "Only at" and the store name', () => {
    const html = render({ summary: summary({}) });
    expect(html).toContain('6,999');
    expect(html).toContain('Only at');
  });
});

describe('path B: a summary price with no store recorded', () => {
  it('does not show the bare price; the MRP line stands in for it', () => {
    const html = render({ summary: summary({ best_store_ids: [] }) });
    expect(html).not.toMatch(/text-sm[^"]*">₹6,999</);
    expect(html).toContain('MRP: ');
  });
});

describe('path C: two stores tied at the best in-stock price (the live 42222 case)', () => {
  it('shows the price with the "Best Price" badge', () => {
    const html = render({ summary: summary({ best_store_ids: ['lego_in', 'toycra'], in_stock_store_count: 2 }) });
    expect(html).toContain('6,999');
    expect(html).toContain('Best Price');
  });
});

describe('path D: a fallback price with no summary at all', () => {
  it('does not show the bare fallback price; the MRP line stands in for it', () => {
    const html = render({ bestPrice: { price_inr: 6999, in_stock: true, scraped_at: NOW } });
    expect(html).not.toMatch(/text-sm[^"]*">₹6,999</);
    expect(html).toContain('MRP: ');
  });
});

describe('path C, the whole card: a tie shows the same card as before, plus the Best Price badge', () => {
  it('keeps the name, number, pieces, year and price, and adds no store-count wording', () => {
    const html = render({ summary: summary({ best_store_ids: ['lego_in', 'toycra'], in_stock_store_count: 2 }) });
    for (const s of ['Bugatti Chiron Pur Sport Hypercar', '42222', '771 pcs', '2026', '6,999', 'Best Price']) {
      expect(html).toContain(s);
    }
    // The card never names a store count: no "2 stores" or "two stores" wording.
    expect(html).not.toMatch(/\b(two|2|three|3)\s+stores?\b/i);
  });
});

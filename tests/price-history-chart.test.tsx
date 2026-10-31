// Price history chart (H5, flag off): what it renders, the words it uses, and the flag mirror.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PriceHistoryChart } from '../src/components/sets/PriceHistoryChart';
import { PRICE_HISTORY_STRINGS } from '../src/lib/price-history-strings';
import { DAY_MS, type CurrentPrice, type HistoryRow } from '../src/lib/price-history-view';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';

const root = join(__dirname, '..');
const NOW = Date.parse('2026-10-28T06:00:00Z');
const at = (days: number) => new Date(NOW - days * DAY_MS).toISOString();
const row = (store_id: string, price: number | null, in_stock: boolean | null, days: number): HistoryRow =>
  ({ store_id, price_inr: price, in_stock, recorded_at: at(days) });
const fresh = (store_id: string, price: number | null, in_stock: boolean | null): CurrentPrice =>
  ({ store_id, price_inr: price, in_stock, scraped_at: new Date(NOW - 60 * 60 * 1000).toISOString() });
const names = { lego: 'LEGO.in', toycra: 'Toycra' };
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('rendering', () => {
  it('renders nothing when there is no priced history', () => {
    expect(renderToStaticMarkup(<PriceHistoryChart rows={[]} currents={[]} storeNames={names} nowMs={NOW} />)).toBe('');
  });
  it('shows the lowest-in-90-days marker only for a store with full coverage and a lowest current price', () => {
    const html = renderToStaticMarkup(
      <PriceHistoryChart
        rows={[row('lego', 1200, true, 200), row('lego', 900, true, 10), row('toycra', 1000, true, 200), row('toycra', 1100, true, 10)]}
        currents={[fresh('lego', 900, true), fresh('toycra', 1100, true)]}
        storeNames={names}
        nowMs={NOW}
      />,
    );
    const t = text(html);
    expect(t.split(PRICE_HISTORY_STRINGS.lowestMarker).length - 1).toBe(1); // only LEGO.in
    expect(t).toContain('LEGO.in');
    expect(t).toContain('Toycra');
  });
  it('a store with less than 90 days of history shows its since-date and never the marker', () => {
    const html = renderToStaticMarkup(
      <PriceHistoryChart rows={[row('lego', 900, true, 30), row('lego', 800, true, 1)]} currents={[fresh('lego', 800, true)]} storeNames={names} nowMs={NOW} />,
    );
    expect(text(html)).not.toContain(PRICE_HISTORY_STRINGS.lowestMarker);
    expect(text(html)).toMatch(/Since \d{1,2} [A-Z][a-z]{2} \d{4}/);
  });
});

describe('words', () => {
  it('uses only the placeholder strings, the store names, and dates and rupee figures from the data', () => {
    const html = renderToStaticMarkup(
      <PriceHistoryChart rows={[row('lego', 1200, true, 200), row('lego', 900, true, 1)]} currents={[fresh('lego', 900, true)]} storeNames={names} nowMs={NOW} />,
    );
    const words = text(html)
      .replace(/₹[\d,]+/g, '')
      .replace(/\b\d{1,2} [A-Z][a-z]{2} \d{4}\b/g, '');
    const allowed = [PRICE_HISTORY_STRINGS.heading, PRICE_HISTORY_STRINGS.lowestMarker, 'Shown:', 'to', 'LEGO.in'];
    for (const a of allowed) expect(words.includes(a)).toBe(true);
    expect(words).not.toMatch(/scrap|scraper|schedule|every \d|feed|API|cron|source/i);
  });
});

describe('flag mirror', () => {
  it('priceHistoryChart is false in both files', () => {
    expect(FEATURE_FLAGS.priceHistoryChart).toBe(false);
    expect(readFileSync(join(root, 'config/feature_flags.py'), 'utf8')).toMatch(/"price_history_chart": False,/);
  });
  it('the set page reads price_history only behind the flag', () => {
    const src = readFileSync(join(root, 'src/app/sets/[slug]/page.tsx'), 'utf8');
    expect(src).toMatch(/if \(FEATURE_FLAGS\.priceHistoryChart && d\.set && d\.store_prices\?\.length\) \{/);
    expect(src).toMatch(/\{FEATURE_FLAGS\.priceHistoryChart && pageData\.priceHistory/);
  });
});

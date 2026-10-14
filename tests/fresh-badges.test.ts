// P12 item 3b: deal / hot-deal / best-price badges disappear in the viewer's
// browser once the price is over 12h old (an ISR page can be served hours
// after it was rendered). FreshOnly takes `now` so the post-hydration check
// can be rendered here without a DOM.
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FreshOnly } from '../src/components/ui/FreshOnly';
import { DealBadge, BestPriceBadge } from '../src/components/ui/Badge';

const NOW = Date.parse('2026-09-29T12:00:00Z');
const hoursAgo = (n: number) => new Date(NOW - n * 3_600_000).toISOString();

const hotDeal = (scrapedAt: string | null, now?: number, fallback?: unknown) =>
  renderToStaticMarkup(h(FreshOnly, { scrapedAt, now, fallback: fallback as any, children: h(DealBadge, { tier: 'hot', pct: 24 }) }));

describe('FreshOnly (browser-side stale badge hide)', () => {
  it('hides a hot-deal badge whose price is 13h old', () => {
    expect(hotDeal(hoursAgo(13), NOW)).toBe('');
  });

  it('keeps it at 1h and exactly 12h', () => {
    expect(hotDeal(hoursAgo(1), NOW)).toContain('Hot deal');
    expect(hotDeal(hoursAgo(12), NOW)).toContain('Hot deal');
  });

  it('hides the best-price badge on the same 13h fixture', () => {
    const html = renderToStaticMarkup(h(FreshOnly, { scrapedAt: hoursAgo(13), now: NOW, children: h(BestPriceBadge) }));
    expect(html).toBe('');
  });

  it('shows the fallback instead when stale (set page 🏷️)', () => {
    expect(hotDeal(hoursAgo(13), NOW, h('span', null, '🏷️'))).toBe('<span>🏷️</span>');
  });

  it('unknown age is never fresh', () => {
    expect(hotDeal(null, NOW)).toBe('');
  });

  it('server HTML is unchanged (no now): the badge renders; the browser decides after hydration', () => {
    expect(hotDeal(hoursAgo(13))).toContain('Hot deal');
  });
});

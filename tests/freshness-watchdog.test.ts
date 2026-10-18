// Freshness watchdog: a once-a-day price scrape must not alarm. The watchdog, the site's freshness window
// and the price summary view agree on 26 hours.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PRICE_STALE_HOURS, SCRAPE_INTERVAL_HOURS } from '../src/lib/price-freshness';

const root = join(__dirname, '..');
const watchdog = readFileSync(join(root, '.github/workflows/workflow-freshness-watchdog.yml'), 'utf8');

function watchdogScrapeWindow(): number {
  const m = watchdog.match(/"scrape-prices\.yml":\s*\[(\d+),\s*(\d+)\]/);
  if (!m) throw new Error('scrape-prices.yml not on the watchlist');
  return Number(m[1]) * Number(m[2]);
}

describe('freshness watchdog', () => {
  it('alarms at 26 hours for the price scrape (was 18)', () => {
    expect(watchdogScrapeWindow()).toBe(26);
  });

  it('matches the site freshness window', () => {
    expect(watchdogScrapeWindow()).toBe(PRICE_STALE_HOURS);
  });

  it('never alarms inside a normal once-a-day gap', () => {
    expect(watchdogScrapeWindow()).toBeGreaterThanOrEqual(SCRAPE_INTERVAL_HOURS + 2);
  });

  it('the newest price-summary view uses the 30-hour window (the alarm fires 4 hours before it)', () => {
    const dir = join(root, 'supabase/migrations');
    const views = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .filter((f) => /create or replace view public\.set_price_summary/i.test(readFileSync(join(dir, f), 'utf8')));
    const latest = readFileSync(join(dir, views[views.length - 1]), 'utf8');
    expect(latest).toMatch(/scraped_at > \(now\(\) - '30:00:00'::interval\)/);
  });
});

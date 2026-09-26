'use client';
// "Updated X ago" computed in the VIEWER's browser from the row's scraped_at.
// An ISR page is rendered up to an hour before it's viewed, so a server-side
// "3h ago" is wrong by however old the render is. The server HTML carries the
// absolute scrape time; the relative label replaces it after hydration.
import { useEffect, useState } from 'react';
import { PRICE_STALE_HOURS, priceAgeHours } from '@/lib/price-freshness';

function absolute(iso: string): string {
  const d = new Date(iso);
  const ist = new Date(d.getTime() + 330 * 60_000);
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][ist.getUTCMonth()];
  const hh = String(ist.getUTCHours()).padStart(2, '0');
  const mm = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${ist.getUTCDate()} ${mon}, ${hh}:${mm} IST`;
}

function relative(h: number): string {
  if (h < 1) return 'just now';
  if (h < 48) return `${Math.floor(h)}h ago`;
  return `${Math.floor(h / 24)} days ago`;
}

export function PriceAge({ scrapedAt, prefix = 'Updated', className }: { scrapedAt: string | null; prefix?: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  if (!scrapedAt) return <span className={className}>Prices not yet scraped — check stores directly</span>;
  const h = now === null ? null : priceAgeHours(scrapedAt, now);
  const stale = h !== null && h > PRICE_STALE_HOURS;
  return (
    <span className={`${className ?? ''} ${stale ? 'text-amber-600' : ''}`.trim()} title={absolute(scrapedAt)}>
      {prefix} {h === null ? absolute(scrapedAt) : relative(h)}
      {stale ? ' — may have changed since' : ''}
    </span>
  );
}

'use client';
// Deal / best-price badges re-checked in the VIEWER's browser (P12 item 3b).
// The server already drops badges on prices older than PRICE_STALE_HOURS at
// render time (badgeEligible / set_price_summary), but an ISR page can be
// served hours after it was rendered: the 27 Sep /themes incident showed
// badges from the 11:34 scrape at 16:34 and later. Same pattern as
// PriceAge.tsx: the server HTML is unchanged (caching untouched, G1); after
// hydration the badge disappears if its price is now over 12h old.
import { useEffect, useState } from 'react';
import { isPriceFresh } from '@/lib/price-freshness';

export function FreshOnly({ scrapedAt, now, fallback = null, children }: {
  scrapedAt: string | null | undefined;
  /** Rendered instead when the price has gone stale (default: nothing). */
  fallback?: React.ReactNode;
  /** Tests only: evaluate at this time instead of after hydration. */
  now?: number;
  children: React.ReactNode;
}) {
  const [clientNow, setClientNow] = useState<number | null>(now ?? null);
  useEffect(() => { if (now === undefined) setClientNow(Date.now()); }, [now]);
  if (clientNow !== null && !isPriceFresh(scrapedAt, clientNow)) return <>{fallback}</>;
  return <>{children}</>;
}

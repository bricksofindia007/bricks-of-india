// "Sale hub" (ideas register N1, 2 Oct 2026): one switch per time-bound sale drives a short URL,
// a homepage + /deals banner and a line on each sale set's page. The switch turns itself off at
// `endsAt` (checked in the visitor's browser, so cached pages stop showing it on time).
// Brick Rush: LEGO Certified Stores across India, in-store only, 1-11 Oct 2026; prices from the
// store's own published list (chat-verified against the store's screenshots, 1 Oct 2026).
export interface Sale {
  slug: string;              // short URL: /<slug>
  name: string;
  href: string;              // the article with the full list
  startsAt: string;          // ISO
  endsAt: string;            // ISO; off from this instant
  banner: string;
  setLine: (inr: string) => string;
  prices: Record<string, number>; // set number -> in-store price (INR)
}

export const BRICK_RUSH: Sale = {
  slug: 'brick-rush',
  name: 'Brick Rush',
  href: '/news/lego-brick-rush-sale-every-in-store-deal-and-whether-it-beat',
  startsAt: '2026-10-01T00:00:00+05:30',
  endsAt: '2026-10-12T00:00:00+05:30', // 12 Oct 00:00 IST: the sale ends 11 Oct
  banner: 'Brick Rush: all 50 in-store deals →',
  setLine: (inr) => `In LEGO Certified Stores till 11 Oct: ${inr} (Brick Rush)`,
  prices: { '10333': 26399, '10341': 16029, '10356': 19700, '10365': 23724, '11370': 18199, '11376': 9799, '11377': 45499, '11378': 14299, '11380': 9099, '11389': 8399, '21063': 18119, '21066': 10499, '21362': 3200, '21363': 15600, '21367': 11049, '31218': 9099, '31220': 11999, '42172': 24719, '42206': 16029, '42207': 16029, '42228': 14999, '42231': 11199, '43014': 6999, '43016': 5949, '43017': 6999, '43018': 12349, '43020': 12349, '43022': 6999, '43023': 6999, '43300': 8000, '71859': 6999, '71860': 9799, '71870': 10499, '71872': 13999, '72037': 10724, '72050': 12349, '75397': 26000, '75419': 68249, '75442': 17549, '75447': 10724, '75639': 8699, '76269': 31849, '76300': 20799, '76344': 9799, '76354': 23999, '76437': 13739, '76457': 26779, '76466': 11899, '77082': 15399, '77984': 15399 },
};

export function saleActive(sale: Sale, now: Date = new Date()): boolean {
  const t = now.getTime();
  return t >= Date.parse(sale.startsAt) && t < Date.parse(sale.endsAt);
}

export function saleInr(n: number): string {
  const s = String(Math.round(n));
  if (s.length <= 3) return `₹${s}`;
  const head = s.slice(0, -3), tail = s.slice(-3);
  return `₹${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}`;
}

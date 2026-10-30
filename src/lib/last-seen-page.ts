// The My Collection page's last-seen read for retired sets (order 0280 item 2c). Pure helpers. The route is
// src/app/api/last-seen-prices (off while the My Collection flag is off). The total does not change: a last seen
// price is shown on the row only (owner decides the total later).
import type { LastSeen } from '@/lib/collection-worth';

/** The route takes at most this many sets per call (PRICE_READ_CAP). */
export const LAST_SEEN_BATCH = 150;

/** The owned retired sets to ask about, each once, at most one batch. */
export function retiredIdsForLastSeen(owned: { set: string }[], isRetired: (set: string) => boolean | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const o of owned) {
    if (isRetired(o.set) !== true || seen.has(o.set)) continue;
    seen.add(o.set);
    out.push(o.set);
  }
  return out.slice(0, LAST_SEEN_BATCH);
}

/** Set number to its last seen price. A row with no usable price or date is left out, so the approved line shows instead. */
export function lastSeenMap(rows: { set_number: string; price_inr: number; observed_at: string }[]): Map<string, NonNullable<LastSeen>> {
  const out = new Map<string, NonNullable<LastSeen>>();
  for (const r of rows) {
    const priceOk = Number.isFinite(r.price_inr) && r.price_inr > 0;
    const dateOk = Number.isFinite(Date.parse(r.observed_at));
    if (priceOk && dateOk) out.set(r.set_number, { priceInr: r.price_inr, observedAt: r.observed_at });
  }
  return out;
}

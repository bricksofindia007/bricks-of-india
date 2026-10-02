// Round 8 item 0(c) add-on (chat, 2 Oct 2026): a WAIT verdict says "wait for a
// better price". When the set already has a live deal (the same Deal/Hot tier
// the price box badges, from set_price_summary), say so under the verdict.
// Computed on every render from live prices; never written into content.
import type { SetPriceSummary } from './price-summary';

export const WAIT_DISCOUNT_LINE = "There's a discount right now — see the price box.";

export function waitDiscountLine(verdict: string | null | undefined, summary: Pick<SetPriceSummary, 'deal_tier'> | null | undefined): string | null {
  if ((verdict || '').trim().toUpperCase() !== 'WAIT') return null;
  return summary?.deal_tier ? WAIT_DISCOUNT_LINE : null;
}

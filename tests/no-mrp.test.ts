import { describe, it, expect, vi } from 'vitest';
import { getPriceSummaries } from '../src/lib/price-summary';

describe('NO_MRP_SETS (3 Oct 2026)', () => {
  it('42670 shows no MRP or discount even when a store lists a compare-at price', async () => {
    const rows = [
      { set_id: '42670', anchor_mrp_inr: '19999', anchor_source: 'toycra', best_price_inr: '14999', discount_pct: '25', deal_tier: 'hot', best_store_ids: ['toycra'], best_scraped_at: null, in_stock_store_count: 1 },
      { set_id: '10449', anchor_mrp_inr: '4099', anchor_source: 'catalogue', best_price_inr: '3699', discount_pct: '9.8', deal_tier: null, best_store_ids: ['toycra'], best_scraped_at: null, in_stock_store_count: 1 },
    ];
    const sb: any = { from: () => ({ select: () => ({ in: vi.fn().mockResolvedValue({ data: rows, error: null }) }) }) };
    const m = await getPriceSummaries(sb, ['42670', '10449']);
    expect(m.get('42670')).toMatchObject({ anchor_mrp_inr: null, anchor_source: null, discount_pct: null, deal_tier: null, best_price_inr: 14999 });
    expect(m.get('10449')?.anchor_mrp_inr).toBe(4099);
  });
});

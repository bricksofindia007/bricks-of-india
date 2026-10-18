// The store names in publish-draft's generated lines read from the shared display-name file. These are the exact
// texts the lines had before the move; this pins the branches the parity fixture may not reach.
import { describe, it, expect } from 'vitest';
import { prePublishAutoFix, priceLineStores } from '../src/lib/publish-draft';

const draft = { source_title: 'x', draft_title: 'x' };

describe('publish-draft store text is unchanged after the move', () => {
  it('the "Available at" line when the body names no store', () => {
    const out = prePublishAutoFix('The set costs ₹41,199 in India.', draft, 'eiffel');
    expect(out).toContain('Available at LEGO.in and Toycra (code ABHINAV12 takes 12% off full-price sets at Toycra, minimum order ₹500).');
  });
  it('the verdict line for WAIT', () => {
    const out = prePublishAutoFix('The set costs ₹41,199 in India.', draft, '10307-eiffel');
    expect(out).toContain('**Verdict: WAIT** — check prices at LEGO.in and Toycra before pulling the trigger.');
  });
  it('the "cheaper of" fallback when no featured store is known', () => {
    expect(priceLineStores({ source_retailer: 'both', source_price_inr: 1000, source_stock_status: 'in_stock', source_checked_at: '2026-10-18' } as never)).toBe('the cheaper of LEGO.in and Toycra');
  });
});

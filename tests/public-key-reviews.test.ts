// Negative tests for the reviews page move (price functions, public key only) and the public text rule.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');

// Code only: comments may mention the old client name without using it.
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('reviews page: public key only', () => {
  const page = codeOnly(readFileSync(join(root, 'src/app/reviews/[slug]/page.tsx'), 'utf8'));

  it('does not use the full-access client', () => {
    expect(page).not.toMatch(/createServerClient/);
    expect(page).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('reads through the public-key client', () => {
    expect(page).toMatch(/createPublicClient\(/);
  });

  it('reads prices only through the price functions, never a price table', () => {
    expect(page).toMatch(/rpc\('get_set_prices'/);
    expect(page).toMatch(/rpc\('get_price_history'/);
    expect(page).not.toMatch(/\.from\('store_prices'\)/);
    expect(page).not.toMatch(/\.from\('price_history'\)/);
  });

  it('takes only the deal tier from the summary (no reference price, no price source)', () => {
    expect(page).toMatch(/getReviewDealTiers\(/);
    expect(page).not.toMatch(/getPriceSummaries\(/);
    expect(page).not.toMatch(/anchor_source|anchor_mrp_inr|best_store_ids/);
  });
});

describe('price summary helpers: the reviews path uses the narrow function', () => {
  const summary = codeOnly(readFileSync(join(root, 'src/lib/price-summary.ts'), 'utf8'));
  const reviewPart = summary.slice(summary.indexOf('export async function getReviewDealTiers'));

  it('the reviews helper reads through get_price_summaries', () => {
    expect(reviewPart).toMatch(/rpc\('get_price_summaries'/);
  });

  it('the shared helper keeps reading the summary view (other pages render more fields)', () => {
    const shared = summary.slice(summary.indexOf('export async function getPriceSummaries'), summary.indexOf('/** The one summary field'));
    expect(shared).toMatch(/from\('set_price_summary'\)/);
  });
});

describe('getReviewDealTiers: no-MRP sets get no tier, and only the deal tier is read', () => {
  it('drops a no-MRP set and returns only deal_tier', async () => {
    const { getReviewDealTiers } = await import('../src/lib/price-summary');
    const rows = [
      { set_id: '42670', deal_tier: 'hot' },
      { set_id: '10449', deal_tier: 'deal' },
    ];
    const sb: any = { rpc: async () => ({ data: rows, error: null }) };
    const m = await getReviewDealTiers(sb, ['42670', '10449']);
    expect(m.has('42670')).toBe(false);
    expect(m.get('10449')).toEqual({ deal_tier: 'deal' });
  });
});

describe('public text: no price rule in llms.txt', () => {
  const llms = readFileSync(join(root, 'public/llms.txt'), 'utf8');

  it('states no MRP rule', () => {
    expect(llms).not.toMatch(/MRP/);
  });
});

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
});

describe('price summary helper: function, not the view', () => {
  const summary = codeOnly(readFileSync(join(root, 'src/lib/price-summary.ts'), 'utf8'));

  it('reads summaries through get_price_summaries', () => {
    expect(summary).toMatch(/rpc\('get_price_summaries'/);
  });

  it('no longer reads the summary view directly in the list helper', () => {
    const list = summary.slice(summary.indexOf('export async function getPriceSummaries'), summary.indexOf('export async function getDeals'));
    expect(list).not.toMatch(/from\('set_price_summary'\)/);
  });
});

describe('public text: no price rule in llms.txt', () => {
  const llms = readFileSync(join(root, 'public/llms.txt'), 'utf8');

  it('states no MRP rule', () => {
    expect(llms).not.toMatch(/MRP/);
  });
});

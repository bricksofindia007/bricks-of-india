// Store-click tracking on the reviews page: both Buy links are tracked links that record the
// click_store_listing event with the page type, store, store name and set number. A plain anchor fails.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const page = readFileSync(join(root, 'src/app/reviews/[slug]/page.tsx'), 'utf8');

// The opening tag of the element that wraps each product link (the text before the href).
function wrapperFor(hrefExpr: string): string {
  const at = page.indexOf(`href={${hrefExpr}}`);
  if (at < 0) return '';
  const open = page.lastIndexOf('<', at);
  return page.slice(open, at);
}

describe('reviews page: store-click tracking', () => {
  for (const href of ['sp.product_url', 'bestStorePrice.product_url']) {
    it(`the link for ${href} is a tracked link, not a plain anchor`, () => {
      const wrapper = wrapperFor(href);
      expect(wrapper).toMatch(/^<TrackedLink\b/);
      expect(wrapper).not.toMatch(/^<a\b/);
    });
  }

  it('both tracked links record click_store_listing with the page type, store, store name and set number', () => {
    const events = page.match(/event="click_store_listing"[\s\S]*?params=\{\{([^}]*)\}\}/g) ?? [];
    expect(events.length).toBe(2);
    for (const e of events) {
      expect(e).toMatch(/page_type: 'review'/);
      expect(e).toMatch(/store: \w+\.store_id/);
      expect(e).toMatch(/store_name: STORE_NAMES\[/);
      expect(e).toMatch(/set_number: set\.set_number/);
    }
  });

  it('the price history request asks for the function cap (200 rows)', () => {
    expect(page).toMatch(/p_limit: 200\b/);
    expect(page).not.toMatch(/p_limit: 500\b/);
  });
});

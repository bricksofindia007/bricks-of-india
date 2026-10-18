// Pinned output for every generated line that carries a store name. The expected text is what those lines produced
// before they read the shared display-name file. These tests check the output, not the source.
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt } from '../src/lib/prompts/draft-prompt';
import { setMetaDescription } from '../src/lib/utils';
import { buildIndiaPriceContext } from '../src/lib/generate-body';
import { STORE_NAMES } from '../src/lib/price-summary';

// The prompt lines are in the system prompt (the voice examples and the output rules). buildUserPrompt does not
// include them; its store text comes in through the price context, which the caller builds.
describe('draft prompt lines that carry store names (system prompt output)', () => {
  const sys = buildSystemPrompt();
  const pins = [
    '2. Indian stores (Toycra, LEGO.in, Amazon India, Flipkart) OR "import only"',
    'Toycra and LEGO.in will likely stock it 4–6 weeks after global launch.',
    'At ₹X,XXX, that\'s 18 months of Netflix. Toycra/lego.in will list it...',
    '"In India, the LEGO Eiffel Tower (10307) is available at LEGO.in for ₹65,999. Toycra has it for ₹61,500.',
    'LEGO.in and Toycra are the stores to watch',
    '- Always mention both stores: LEGO.in and Toycra — even if only one has a current price.',
    '- Always include the Toycra code line exactly: "Code ABHINAV12 takes 12% off full-price sets at Toycra, minimum order ₹500."',
  ];
  for (const p of pins) {
    it(`contains: ${p.slice(0, 60)}…`, () => {
      expect(sys).toContain(p);
    });
  }
  it('the user prompt carries no store-name line from these constants', () => {
    const user = buildUserPrompt({
      format: 'news', sourceTitle: 'T', sourceUrl: 'https://x', sourcePublishedAt: null,
      setNumber: '10307', fullBody: null, sourceExcerpt: null, indiaPriceContext: '', forceOpinionTake: false,
    } as never);
    expect(user).not.toMatch(/LEGO\.in|Toycra/);
  });
});

describe('meta description', () => {
  it('pinned text for a set name', () => {
    expect(setMetaDescription('Creative Brick Box')).toBe('Find the best price for Creative Brick Box in India. Compare prices across Toycra and LEGO.in.');
  });
});

describe('India price context lines', () => {
  it('pinned lines, mybrickhouse (LEGO.in) first, then toycra, with the stock note', async () => {
    const rows = [
      { store_id: 'toycra', price_inr: 41199, in_stock: true },
      { store_id: 'mybrickhouse', price_inr: 41500, in_stock: false },
    ];
    const sb = {
      from: () => ({ select: () => ({ eq: async () => ({ data: rows }) }) }),
    } as never;
    const out = await buildIndiaPriceContext(sb, '10307', 'Eiffel Tower');
    expect(out).toContain('INDIA PRICE DATA — use these exact figures, do not calculate:\n  LEGO.in: ₹41,500 (may be out of stock)\n  Toycra: ₹41,199');
  });
});

describe('the store names constant', () => {
  it('pinned display names', () => {
    expect(STORE_NAMES).toEqual({ mybrickhouse: 'LEGO.in', toycra: 'Toycra' });
  });
});

// Parity for the store-name move: the output of the store-name paths must not change while names
// move to the registry. The fixture holds the output captured before the move. Capture it with
// CAPTURE_STORE_PARITY=1; every other run compares against it.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { prePublishAutoFix, priceLineStores } from '../src/lib/publish-draft';
import { disclaimerTextFor, resolveDisclaimerVariant, addUnlistedDisclaimerLine } from '../src/lib/review-disclaimer';
import { buildSystemPrompt, buildRetailerSourcePriceContext } from '../src/lib/prompts/draft-prompt';
import { genuinelyAvailableAtToycra } from '../src/lib/toycra-availability';
import { ToycraDiscountBanner } from '../src/components/ui/ToycraDiscountBanner';

const fixturePath = join(__dirname, 'fixtures', 'store-names-parity.json');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const BODIES = [
  'Set 10307 is ₹41,199 at MyBrickHouse, Toycra, and Jaiman Toys.',
  'Available at Jaiman Toys and Toycra for ₹41,199.',
  'MyBrickHouse and Jaiman Toys both list it.',
  'Buy it from Jaiman Toys.',
  'Toycra is selling it at ₹41,599 today. Code ABHINAV12 takes 12% off.',
  'Verdict: WAIT. Check prices at LEGO.in and Toycra first.',
  '**Toycra** has it at ₹41,199 — a *good* price.\n\n## Heading\n\n- item one\n- item two',
];

const SOURCES = [
  { source_retailer: 'mybrickhouse', source_price_inr: 41199, source_stock_status: 'in_stock', source_checked_at: '2026-10-01' },
  { source_retailer: 'toycra', source_price_inr: 41199, source_stock_status: 'in_stock', source_checked_at: '2026-10-01' },
  { source_retailer: 'both', source_price_inr: 41199, source_stock_status: 'in_stock', source_checked_at: '2026-10-01', featured_store: 'toycra', other_price_inr: 41199, other_in_stock: true },
  { source_retailer: 'both', source_price_inr: 41199, source_stock_status: 'in_stock', source_checked_at: '2026-10-01', featured_store: 'toycra', other_price_inr: 42000, other_in_stock: true },
  { source_retailer: 'both', source_price_inr: 41199, source_stock_status: 'in_stock', source_checked_at: '2026-10-01', featured_store: 'mybrickhouse', other_price_inr: 41500, other_in_stock: false },
  { source_retailer: 'both', source_price_inr: 41199, source_stock_status: 'in_stock', source_checked_at: '2026-10-01' },
] as const;

function collect() {
  const out: Record<string, unknown> = {};
  out.autoFix = BODIES.map((b) => prePublishAutoFix(b, { source_title: 'Eiffel', draft_title: 'Eiffel' }, 'eiffel'));
  out.priceLineStores = SOURCES.map((s) => priceLineStores(s as never));
  out.disclaimers = {
    buy: disclaimerTextFor('buy'),
    wait_mybrickhouse: disclaimerTextFor('wait_mybrickhouse'),
    wait_toycra: disclaimerTextFor('wait_toycra'),
    wait_unlisted: disclaimerTextFor('wait_unlisted'),
    avoid: disclaimerTextFor('avoid'),
  };
  out.variants = [
    ['BUY NOW', 'mybrickhouse'], ['WAIT', 'mybrickhouse'], ['WAIT', 'toycra'], ['WAIT', 'both'], ['AVOID', 'toycra'],
  ].map(([v, r]) => resolveDisclaimerVariant(v as string, r as never));
  out.unlisted = ['BUY NOW', 'WAIT', 'AVOID'].map((v) =>
    addUnlistedDisclaimerLine(`Intro.\n\nVerdict: ${v}.\n\nMore text.`, v),
  );
  out.systemPromptSha = sha(buildSystemPrompt());
  out.retailerContextSha = sha(
    buildRetailerSourcePriceContext({ retailerDisplayName: 'Toycra', priceInrFormatted: '41,199', stockStatus: 'in_stock', checkedAt: '2026-10-01' }),
  );
  out.toycraAvailable = [
    'Toycra is selling it at ₹41,599 today.',
    'MyBrickHouse has it for ₹41,199 — Toycra doesn’t currently list it.',
    'No price mentioned at Toycra.',
  ].map((t) => genuinelyAvailableAtToycra(t));
  out.banner = (['full', 'inline', 'compact'] as const).map((variant) =>
    renderToStaticMarkup(<ToycraDiscountBanner variant={variant} />),
  );
  return out;
}

describe('store-name parity', () => {
  if (process.env.CAPTURE_STORE_PARITY === '1') {
    it('captures the current output', () => {
      writeFileSync(fixturePath, JSON.stringify(collect(), null, 2) + '\n');
    });
  }

  it('matches the captured output, unchanged', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
    expect(collect()).toEqual(fixture);
  });
});

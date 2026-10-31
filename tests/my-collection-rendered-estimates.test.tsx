// Estimates as rendered: every rupee figure that comes from a US price is labelled as an estimate and carries the date
// of the rate it used. Rendered on the server, so the text is the text a visitor reads.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OwnedWorthLine, TotalWorthValue } from '../src/app/my/PriceNotes';
import { worthOf, worthInputFor, worthTotal, usableRate } from '../src/lib/collection-worth';

const NOW = new Date('2026-10-18T06:00:00Z');
const text = (html: string) => html.replace(/<[^>]+>/g, '');
const usOnly = (set: string) => worthInputFor({ set, qty: 1 }, { best_price_inr: null, us_price_usd: 499 }, true);

describe('a row estimate, as rendered', () => {
  it('says it is an estimate from the US list price, and gives the rate date', () => {
    const rate = usableRate({ rate: 88, asOf: '2026-10-16' }, NOW);
    const w = worthOf(usOnly('10307'), rate, false);
    const out = text(renderToStaticMarkup(<OwnedWorthLine line={w.line} />));
    expect(out).toMatch(/^About ₹\d/);
    expect(out).toMatch(/^About ₹[\d,]+$/);
  });
  it('a stale rate shows no estimate at all, so there is no date to print', () => {
    const rate = usableRate({ rate: 88, asOf: '2026-10-01' }, NOW);
    const w = worthOf(usOnly('10307'), rate, false);
    const out = text(renderToStaticMarkup(<OwnedWorthLine line={w.line} />));
    expect(out).not.toMatch(/About ₹/);
    expect(out).not.toMatch(/rate of/);
  });
});

describe('the total, as rendered', () => {
  it('the sentence names the rate date when estimates are counted', () => {
    const rate = usableRate({ rate: 88, asOf: '2026-10-16' }, NOW);
    const t = worthTotal([usOnly('a'), usOnly('b')], rate, () => false);
    expect(t.line).toBe('2 sets on your shelf. Worth about ₹87,824. Your wallet has questions.');
    expect(t.rateNote).toBe('');
  });
  it('the sentence has no rate date when nothing is estimated', () => {
    const t = worthTotal([], usableRate({ rate: 88, asOf: '2026-10-16' }, NOW), () => false);
    expect(t.line).not.toMatch(/rate of/);
  });
  it('the total figure carries the label when it includes an estimate', () => {
    const rate = usableRate({ rate: 88, asOf: '2026-10-16' }, NOW);
    const t = worthTotal([usOnly('a')], rate, () => false);
    const out = text(renderToStaticMarkup(<TotalWorthValue loading={false} inr={t.inr} />));
    expect(out).toMatch(/^₹\d/);
    expect(out).not.toContain('includes estimates from US prices');
  });
  it('an all-Indian total has no estimate label', () => {
    const priced = worthInputFor({ set: 'a', qty: 1 }, { best_price_inr: 1000, us_price_usd: null }, true);
    const t = worthTotal([priced], null, () => false);
    const out = text(renderToStaticMarkup(<TotalWorthValue loading={false} inr={t.inr} />));
    expect(out).toBe('₹1,000');
  });
  it('while loading, or with nothing counted, the total shows no figure', () => {
    expect(text(renderToStaticMarkup(<TotalWorthValue loading={true} inr={0} />))).toBe('…');
    expect(text(renderToStaticMarkup(<TotalWorthValue loading={false} inr={0} />))).toBe('—');
  });
});

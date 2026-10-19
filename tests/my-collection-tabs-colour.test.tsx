// My Collection: arrow-key movement between the tabs (the tab pattern), the roving tab stop, and the text colours
// that now reach 4.5:1 on white (set and figure numbers, the wishlist price).
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nextTab } from '../src/app/my/tab-keys';

vi.mock('../src/lib/feature-flags', () => ({ FEATURE_FLAGS: { myCollectionPage: true, myCollectionHearts: true } }));
import { MyCollection } from '../src/app/my/MyCollection';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

describe('arrow keys move between the tabs', () => {
  it('Right goes from Wishlist to My Collection, and wraps back', () => {
    expect(nextTab('wish', 'ArrowRight')).toBe('owned');
    expect(nextTab('owned', 'ArrowRight')).toBe('wish');
  });
  it('Left goes from My Collection to Wishlist, and wraps back', () => {
    expect(nextTab('owned', 'ArrowLeft')).toBe('wish');
    expect(nextTab('wish', 'ArrowLeft')).toBe('owned');
  });
  it('Home goes to the first tab and End to the last', () => {
    expect(nextTab('owned', 'Home')).toBe('wish');
    expect(nextTab('wish', 'End')).toBe('owned');
  });
  it('any other key moves nothing', () => {
    for (const key of ['Enter', ' ', 'Tab', 'ArrowUp', 'a']) expect(nextTab('wish', key), key).toBeNull();
  });
  it('the tab list handles those keys, moves focus with the selection, and prevents the default scroll', () => {
    const src = read('src/app/my/MyCollection.tsx');
    expect(src).toMatch(/role="tablist"[^>]*onKeyDown=\{\(e\) => \{[\s\S]*nextTab\(tab, e\.key\)[\s\S]*e\.preventDefault\(\)[\s\S]*setTab\(next\)[\s\S]*focus\(\)/);
  });
});

describe('one tab stop, on the selected tab (roving tabindex)', () => {
  it('the selected tab is in the tab order and the other is not', () => {
    const html = renderToStaticMarkup(<MyCollection />);
    const wish = html.match(/<button[^>]*id="tab-wish"[^>]*>/)?.[0] ?? '';
    const owned = html.match(/<button[^>]*id="tab-owned"[^>]*>/)?.[0] ?? '';
    expect(wish).toMatch(/tabindex="0"/);
    expect(owned).toMatch(/tabindex="-1"/);
  });
});

// The colours, checked against the WCAG contrast formula (relative luminance, ratio of the lighter over the darker + 0.05).
const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lum = (hex: string) => {
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe('text colours reach 4.5:1 on white', () => {
  it('gray-600 (set and figure numbers) is 4.5:1 or better on white', () => {
    expect(contrast('4b5563', 'ffffff')).toBeGreaterThanOrEqual(4.5);
  });
  it('green-700 (the wishlist price) is 4.5:1 or better on white', () => {
    expect(contrast('15803d', 'ffffff')).toBeGreaterThanOrEqual(4.5);
  });
  it('the old colours were below 4.5:1 (so the test would fail without the change)', () => {
    expect(contrast('9ca3af', 'ffffff')).toBeLessThan(4.5);
    expect(contrast('16a34a', 'ffffff')).toBeLessThan(4.5);
  });
  it('the My Collection set numbers, figure numbers and wishlist price use the new colours', () => {
    expect(read('src/app/my/MyCollection.tsx')).not.toContain('text-gray-400 font-price');
    expect(read('src/app/my/FiguresList.tsx')).not.toContain('text-gray-400 font-price');
    expect(read('src/app/my/FiguresList.tsx')).toContain('text-xs text-gray-600 font-price">{f.figure_number}');
    expect(read('src/app/my/PriceNotes.tsx')).toContain('font-price font-bold text-green-700');
  });
});

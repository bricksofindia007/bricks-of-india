// The review page's "Set #" line uses the same colour as the other set numbers: gray-600, 4.5:1 or better on white.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lum = (hex: string) => {
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe('review page "Set #" line', () => {
  const src = readFileSync(join(root, 'src/app/reviews/[slug]/page.tsx'), 'utf8');
  const line = src.split('\n').find((l) => l.includes('Set #{set.set_number}')) ?? '';

  it('uses gray-600 and no longer gray-400, with the wording unchanged', () => {
    expect(line).toContain('text-gray-600');
    expect(line).not.toContain('text-gray-400');
    expect(line).toContain('>Set #{set.set_number}</p>');
  });
  it('gray-600 is 4.5:1 or better on white (7.56:1); gray-400 was 2.54:1', () => {
    expect(contrast('4b5563', 'ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('9ca3af', 'ffffff')).toBeLessThan(4.5);
  });
});

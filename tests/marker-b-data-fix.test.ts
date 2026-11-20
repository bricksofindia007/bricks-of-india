// Data fix 911 (marker B): the approved text is exact in the fix and in its rollback, and the placement arithmetic
// in the fix works on sample reviews (a JavaScript copy of the same 1-based positions the SQL uses).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const fix = readFileSync(join(root, 'supabase/data-fixes/911-marker-b-reviews-source-retailer-null.sql'), 'utf8');
const rollback = readFileSync(join(root, 'docs/data-fix-rollbacks/911-marker-b-reviews-rollback.sql'), 'utf8');

const MARKER = "Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today's.";

// The same steps as the DO block in the fix, using its 1-based positions.
function applyFix(content: string): string | null {
  if (content.includes(MARKER)) return null;
  const p = content.search(/₹\s?[0-9]/) + 1;
  if (p === 0) return null;
  const q = content.slice(p - 1).indexOf('\n\n') + 1;
  if (q === 0) return `${content}\n\n*${MARKER}*`;
  return content.slice(0, p + q - 2) + `\n\n*${MARKER}*` + content.slice(p + q - 2);
}

describe('data fix 911: the approved text', () => {
  it('the fix contains the approved marker text exactly', () => {
    expect(fix).toContain(`$m$${MARKER}$m$`);
  });
  it('the rollback removes the same text', () => {
    expect(rollback).toContain(`$m$${MARKER}$m$`);
  });
  it('the fix selects the reviews with source_retailer null and never runs without the marker guard', () => {
    expect(fix).toMatch(/WHERE source_retailer IS NULL AND position\(marker in content\) = 0/);
  });
  it('the fix asserts the 63-review base and the zero before-count in its comments', () => {
    expect(fix).toMatch(/boi:expect-before select count\(\*\) from public\.reviews where source_retailer is null/);
    expect(fix).toMatch(/must be 63/);
  });
});

describe('data fix 911: placement', () => {
  it('a rupee figure in the first of several paragraphs: the marker follows that paragraph', () => {
    const before = 'Intro line.\n\nThe set costs ₹1,299 here.\n\nClosing line.';
    expect(applyFix(before)).toBe(`Intro line.\n\nThe set costs ₹1,299 here.\n\n*${MARKER}*\n\nClosing line.`);
  });
  it('a rupee figure in the last paragraph: the marker goes at the end', () => {
    expect(applyFix('A review.\n\nCost ₹5 in total.')).toBe(`A review.\n\nCost ₹5 in total.\n\n*${MARKER}*`);
  });
  it('a rupee figure in the middle of a paragraph still uses that paragraph', () => {
    expect(applyFix('One.\n\nTwo sentences, ₹899 then more text.\n\nThree.')).toBe(
      `One.\n\nTwo sentences, ₹899 then more text.\n\n*${MARKER}*\n\nThree.`,
    );
  });
  it('a review with no rupee figure is skipped', () => {
    expect(applyFix('No price anywhere in this review.\n\nStill none.')).toBeNull();
  });
  it('a review that already holds the marker is skipped (re-running is a no-op)', () => {
    const once = applyFix('A.\n\nCost ₹5.\n\nB.');
    expect(applyFix(once as string)).toBeNull();
  });
  it('the rollback restores the review exactly', () => {
    const original = 'Intro line.\n\nThe set costs ₹1,299 here.\n\nClosing line.';
    const fixed = applyFix(original) as string;
    expect(fixed.replace(`\n\n*${MARKER}*`, '')).toBe(original);
  });
});

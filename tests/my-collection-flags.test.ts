// My Collection flags: both off by default, mirrored in both flag files, and every visible piece sits
// behind its flag, so with the flags off nothing changes on any page.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';
import { sanitizeParams } from '../src/lib/analytics';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('My Collection flags', () => {
  it('both are off', () => {
    expect(FEATURE_FLAGS.myCollectionHearts).toBe(false);
    expect(FEATURE_FLAGS.myCollectionPage).toBe(false);
  });
  it('the Python flag file agrees (both off)', () => {
    const py = read('config/feature_flags.py');
    expect(py).toMatch(/"my_collection_hearts": False/);
    expect(py).toMatch(/"my_collection_page": False/);
  });
});

describe('flags off = no visible change', () => {
  it('the My Collection page is not found while its flag is off', () => {
    const src = read('src/unrouted/my/page.tsx');
    expect(src).toMatch(/if \(!FEATURE_FLAGS\.myCollectionPage\) notFound\(\);/);
  });
  it('the price route answers 404 while its flag is off', () => {
    expect(read('src/app/api/saved-sets/route.ts')).toMatch(/if \(!FEATURE_FLAGS\.myCollectionPage\) return new NextResponse\(null, \{ status: 404 \}\);/);
  });
  it('the set card heart is gated by the hearts flag', () => {
    expect(read('src/components/sets/SetCard.tsx')).toMatch(/\{FEATURE_FLAGS\.myCollectionHearts && \(/);
  });
  it('the set page hearts and add button are gated by the hearts flag', () => {
    expect(read('src/app/sets/[slug]/page.tsx')).toMatch(/\{FEATURE_FLAGS\.myCollectionHearts && \(\s*<div className="flex flex-wrap items-center gap-3 mb-4">/);
  });
  it('no My Collection code path reads the old environment switch', () => {
    for (const f of ['src/unrouted/my/page.tsx', 'src/components/sets/SetCard.tsx', 'src/app/sets/[slug]/page.tsx', 'src/app/api/saved-sets/route.ts']) {
      expect(read(f)).not.toMatch(/NEXT_PUBLIC_BOI_SAVED_SETS/);
    }
  });
});

describe('events', () => {
  it('the four events keep only the set number and page type', () => {
    expect(sanitizeParams('heart_add', { page_type: 'set', set_number: '10307', extra: 'x' })).toEqual({ page_type: 'set', set_number: '10307' });
    expect(sanitizeParams('heart_remove', { page_type: 'sets_list', set_number: '10307' })).toEqual({ page_type: 'sets_list', set_number: '10307' });
    expect(sanitizeParams('owned_add', { page_type: 'set', set_number: '10307' })).toEqual({ page_type: 'set', set_number: '10307' });
    expect(sanitizeParams('my_sets_view', { page_type: 'sets_list', set_number: '10307' })).toEqual({ page_type: 'sets_list' });
  });
});

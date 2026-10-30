// The top-bar link to My Collection (decision D-2026-10-30-01): labelled exactly "My Collection", shown only while the
// page flag is on, in the desktop bar and the mobile drawer. Source checks (no DOM test setup in this repo).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';

const root = join(__dirname, '..');
const nav = readFileSync(join(root, 'src/components/layout/Navbar.tsx'), 'utf8');

describe('the top-bar link', () => {
  it('the page flag is off by default', () => {
    expect(FEATURE_FLAGS.myCollectionPage).toBe(false);
  });

  it('is labelled exactly My Collection and points at the page', () => {
    expect(nav).toMatch(/href="\/my"[\s\S]*?>\s*My Collection\s*<\/Link>/);
  });

  it('is shown only while the page flag is on, in the desktop bar and the mobile drawer', () => {
    const gates = nav.match(/\{FEATURE_FLAGS\.myCollectionPage && \(/g) ?? [];
    expect(gates).toHaveLength(2);
  });
});

// The Minifigures tab on My Collection is hidden at launch (owner decision D-2026-10-29-04: sets only). One flag, off in
// both flag files; the tab button and the figures view both check it. The code is kept.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('myCollectionFigures flag', () => {
  it('is off in the site flag file', () => {
    expect(FEATURE_FLAGS.myCollectionFigures).toBe(false);
  });

  it('is off in the Python mirror, and the two agree', () => {
    expect(read('config/feature_flags.py')).toMatch(/"my_collection_figures": False/);
  });
});

describe('the Minifigures tab is behind the flag', () => {
  const src = read('src/app/my/MyCollection.tsx');

  it('the tab button renders only while the flag is on', () => {
    expect(src).toMatch(/\{FEATURE_FLAGS\.myCollectionFigures && \([\s\S]*?>Minifigures<\/button>\s*\)\}/);
  });

  it('the figures view is reachable only while the flag is on', () => {
    expect(src).toMatch(/if \(kind === 'figures' && FEATURE_FLAGS\.myCollectionFigures\)/);
  });
});

// The heart and add-to-collection code loads only when the hearts flag is on. With the flag off the button module is
// never evaluated (checked at run time), and the pages that show set cards pass the flag in and import only the slot.
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const evaluated = vi.hoisted(() => ({ count: 0 }));
vi.mock('../src/components/saved/SaveButtons', () => {
  evaluated.count++;
  return {
    HeartButton: () => null,
    AddToCollectionButton: () => null,
  };
});

import { HeartSlot, CollectionSlot } from '../src/components/saved/CollectionSlots';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const SET = { set: '10307', name: 'Test set', image_url: null, pieces: 100, theme: 'Icons', year: 2024 };

describe('flag off: the button code is never evaluated', () => {
  it('the heart slot renders nothing and the button module is not evaluated', () => {
    evaluated.count = 0;
    expect(renderToStaticMarkup(<HeartSlot enabled={false} {...SET} />)).toBe('');
    expect(evaluated.count).toBe(0);
  });
  it('the add-to-collection slot renders nothing and the button module is not evaluated', () => {
    evaluated.count = 0;
    expect(renderToStaticMarkup(<CollectionSlot enabled={false} {...SET} />)).toBe('');
    expect(evaluated.count).toBe(0);
  });
});

describe('the pages pass the flag in, and import only the slot', () => {
  it('the set card imports the slot, not the button module, and gates it on the flag', () => {
    const src = read('src/components/sets/SetCard.tsx');
    expect(src).toContain("import { HeartSlot } from '@/components/saved/CollectionSlots';");
    expect(src).not.toContain('SaveButtons');
    expect(src).toMatch(/const showHeart = FEATURE_FLAGS\.myCollectionHearts && !FEATURE_FLAGS\.accountsEnabled;/);
    expect(src).toMatch(/\{showHeart && \(/);
  });
  it('the set page imports the slots, not the button module, and gates them on the flag', () => {
    const src = read('src/app/sets/[slug]/page.tsx');
    expect(src).toContain("import { HeartSlot, CollectionSlot } from '@/components/saved/CollectionSlots';");
    expect(src).not.toContain("from '@/components/saved/SaveButtons'");
    expect(src).toMatch(/\{FEATURE_FLAGS\.myCollectionHearts && \(/);
  });
  it('the slots load the button module only through a lazy import', () => {
    const src = read('src/components/saved/CollectionSlots.tsx');
    expect(src).toMatch(/lazy\(\(\) => import\('@\/components\/saved\/SaveButtons'\)/);
    expect(src).not.toMatch(/^import .*SaveButtons/m);
  });
});

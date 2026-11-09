// The share card image (option A): the two approved lines, no rupee value on any rendered card, and a switch that is off.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CARD_LINES, cardCopy, drawShareCard, CARD_SIZES, type CardCanvas, type CardFormat, type ListKind } from '@/lib/share-card';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

const KINDS: ListKind[] = ['collection', 'wishlist'];
const FORMATS: CardFormat[] = ['square', 'story'];
const COUNTS = [0, 1, 12, 1234];

// Records every word the drawing would put on the card.
function drawnWords(format: CardFormat, kind: ListKind, count: number): string[] {
  const words: string[] = [];
  const ctx = {
    fillStyle: '',
    font: '',
    textAlign: 'left',
    fillRect: () => {},
    fillText: (text: string) => { words.push(text); },
  } as unknown as CardCanvas;
  drawShareCard(ctx, format, cardCopy(kind, count));
  return words;
}

const RUPEE_OR_RS = /₹|\bRs\b|\bRs\./;

describe('share card lines', () => {
  it('the constant holds the two approved lines and nothing else', () => {
    expect(Object.keys(CARD_LINES).sort()).toEqual(['collection', 'wishlist']);
    expect(CARD_LINES.collection).toBe('My LEGO collection. Running out of shelf space, savings, and excuses.');
    expect(CARD_LINES.wishlist).toBe("My LEGO wishlist. What my bank account doesn't know won't hurt it.");
  });
  it('each card carries its own line', () => {
    for (const kind of KINDS) expect(cardCopy(kind, 3).line).toBe(CARD_LINES[kind]);
  });
});

describe('no rendered card shows a rupee value or "Rs"', () => {
  for (const kind of KINDS) {
    for (const format of FORMATS) {
      for (const count of COUNTS) {
        it(`${kind}, ${format}, ${count} sets`, () => {
          const words = drawnWords(format, kind, count);
          expect(words.length).toBeGreaterThan(0);
          for (const w of words) expect(w, w).not.toMatch(RUPEE_OR_RS);
        });
      }
    }
  }
  it('the card sizes are the two approved formats', () => {
    expect(CARD_SIZES.square).toEqual({ width: 1080, height: 1080 });
    expect(CARD_SIZES.story).toEqual({ width: 1080, height: 1920 });
  });
});

describe('the card switch is off', () => {
  it('is false in the TypeScript flags and in the Python mirror', () => {
    expect(read('src/lib/feature-flags.ts')).toMatch(/shareCardImage: false,/);
    expect(read('config/feature_flags.py')).toMatch(/"share_card_image": False,/);
  });
  it('the collection share component draws nothing unless the switch is on', () => {
    expect(read('src/components/share/CollectionShare.tsx')).toMatch(/!FEATURE_FLAGS\.shareCardImage\) return null;/);
  });
});

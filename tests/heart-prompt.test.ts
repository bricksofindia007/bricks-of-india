// The heart's approved line (D-2026-10-29-05, line 1) shows as the heart's tooltip, and as a caption under the large heart
// on a set page while the set is not saved. Source checks (no DOM test setup in this repo).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VOICE } from '../src/lib/my-collection';

const root = join(__dirname, '..');
const src = readFileSync(join(root, 'src/components/saved/SaveButtons.tsx'), 'utf8');
const heart = src.slice(src.indexOf('export function HeartButton'), src.indexOf('/** "Add to my collection"'));

describe('the heart line', () => {
  it('is the approved text, exactly', () => {
    expect(VOICE.heartPrompt).toBe('Want it? Save it to your wishlist.');
  });

  it('is the tooltip of the heart while the set is not saved', () => {
    expect(heart).toMatch(/title=\{saved \? undefined : VOICE\.heartPrompt\}/);
  });

  it('is a visible caption only under the large heart, and only while not saved', () => {
    expect(heart).toMatch(/\{!saved && size === 'lg' && <span[^>]*>\{VOICE\.heartPrompt\}<\/span>\}/);
  });

  it('the heart keeps its accessible name (save or remove), unchanged', () => {
    expect(heart).toContain('`Save ${name} to your wishlist`');
    expect(heart).toContain('`Remove ${name} from your wishlist`');
  });
});

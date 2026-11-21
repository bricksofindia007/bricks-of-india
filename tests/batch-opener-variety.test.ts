// Order 1953 decision 3: openings vary within a batch. The uniqueness threshold and the approved opener lines stay as they are.
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, BATCH_OPENING_SHAPES, VOICE_EXAMPLES } from '../src/lib/prompts/draft-prompt';
import { RECENT_OPENERS_WINDOW, reusedOpener, openingSentence } from '../src/lib/opener-pattern';

describe('buildSystemPrompt batch variety', () => {
  it('with no earlier openings the prompt is unchanged', () => {
    expect(buildSystemPrompt([])).toBe(buildSystemPrompt());
    expect(buildSystemPrompt(['   '])).toBe(buildSystemPrompt());
  });

  it('lists earlier openings and asks for a different one', () => {
    const p = buildSystemPrompt(['Your wallet is already nervous about this one.']);
    expect(p).toContain('BATCH VARIETY');
    expect(p).toContain('"Your wallet is already nervous about this one."');
    expect(p).toContain('Do not open with any of them');
    expect(p.startsWith(VOICE_EXAMPLES)).toBe(true);
  });

  it('gives consecutive drafts different hook shapes, rotated by position', () => {
    const shapes = [1, 2, 3, 4].map((n) => {
      const openers = Array.from({ length: n }, (_, i) => `Opening sentence number ${i} is here.`);
      const p = buildSystemPrompt(openers);
      return BATCH_OPENING_SHAPES.find((s) => p.includes(`open with ${s}`));
    });
    expect(shapes.every(Boolean)).toBe(true);
    expect(new Set(shapes).size).toBe(BATCH_OPENING_SHAPES.length);
  });

  it('keeps the wallet lines allowed in the opener', () => {
    const p = buildSystemPrompt(['A first opener.']);
    expect(p).toContain('wallet lines are still welcome');
  });
});

describe('opener uniqueness is unchanged', () => {
  it('still compares against the last 10 published articles', () => {
    expect(RECENT_OPENERS_WINDOW).toBe(10);
  });

  it('still flags a reused opening sentence and ignores digits and case', () => {
    const recent = ['Price just dropped to 4999 for this set. Read on.'];
    expect(reusedOpener('PRICE just dropped to 1234 for this set. New text.', recent)).not.toBeNull();
    expect(reusedOpener('A completely different first line here. More.', recent)).toBeNull();
    expect(openingSentence('<!-- x -->Hello there, friend. Rest.')).toBe('Hello there, friend.');
  });
});

import { describe, it, expect } from 'vitest';
import { reusedOpener, openingSentence, normalizeOpening, RECENT_OPENERS_WINDOW } from '../src/lib/opener-pattern';

describe('Gate 12, round 11 D1: no opener from the last 10 published articles; wallet openers allowed', () => {
  it('window is 10', () => expect(RECENT_OPENERS_WINDOW).toBe(10));
  it('BOI wallet openers are allowed when they are new', () => {
    expect(reusedOpener('Your wallet called. It wants a calm, rational discussion about ₹10,000.', ['LEGO just revealed a castle.'])).toBeNull();
    expect(reusedOpener('The wallet is already bracing itself.', [])).toBeNull();
  });
  it('the same opening sentence as a recent article is blocked, even with another set number or price', () => {
    const recent = ['Your wallet called. It wants to discuss the LEGO 10332 Medieval Town Square.'];
    expect(reusedOpener('Your wallet called. It wants to discuss the LEGO 10333.', recent)).toBe('Your wallet called.');
    expect(reusedOpener('Ten thousand pieces! Rest of article.', ['Ten thousand pieces. Something else.'])).toBe('Ten thousand pieces!');
  });
  it('a different opening sentence passes', () => {
    expect(reusedOpener('Your wallet just blinked. LEGO announced…', ['Your wallet called. It wants a word.'])).toBeNull();
  });
  it('opening sentence ignores comments and markdown markers', () => {
    expect(openingSentence('  <!-- note -->\n## Your wallet wants a word with you. More.')).toBe('Your wallet wants a word with you.');
    expect(normalizeOpening('LEGO 10332: ₹12,999!')).toBe('lego');
  });
});

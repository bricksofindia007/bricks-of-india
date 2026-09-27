import { describe, it, expect } from 'vitest';
import { bannedOpener, openingSentence } from '../src/lib/opener-pattern';

describe('Gate 12 opener pattern (#194)', () => {
  it('flags the banned openers', () => {
    expect(bannedOpener('Your wallet called. It wants a calm, rational discussion about ₹10,000.')).not.toBeNull();
    expect(bannedOpener('Your wallet just blinked. LEGO announced…')).not.toBeNull();
    expect(bannedOpener('  <!-- note -->\nYour wallet wants a word with you about this one.')).not.toBeNull();
  });
  it('allows the wallet later in the piece and other openers', () => {
    expect(bannedOpener('LEGO just revealed the 10332 Medieval Town Square. Your wallet called.')).toBeNull();
    expect(bannedOpener('Your wallet is about to have a very complicated day.')).toBeNull();
    expect(bannedOpener('Wallets everywhere called in sick.')).toBeNull();
  });
  it('opening sentence ignores comments and markdown markers', () => {
    expect(openingSentence('<!-- x -->\n## Hello there. Next.')).toBe('Hello there.');
  });
});

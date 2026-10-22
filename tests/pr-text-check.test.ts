// Queue item 13: the attribution check flags AI attribution in PR text and names the field, not the text.
import { describe, it, expect } from 'vitest';
import { hasAttribution, attributionHits } from '../scripts/ci/pr-text-check.mjs';

describe('hasAttribution', () => {
  it('flags a co-author trailer for Claude', () => {
    expect(hasAttribution('Fix sort\n\nCo-Authored-By: Claude <noreply@anthropic.com>')).toBe(true);
  });
  it('flags a generated-with line', () => {
    expect(hasAttribution('Generated with [Claude Code](https://claude.ai/code)')).toBe(true);
  });
  it('flags the Anthropic no-reply address alone', () => {
    expect(hasAttribution('note: noreply@anthropic.com')).toBe(true);
  });
  it('passes ordinary text, including the word Claude used in a product sense', () => {
    expect(hasAttribution('Add price sort aliases to /sets')).toBe(false);
    expect(hasAttribution('Claude-style summary of the board rows')).toBe(false);
  });
  it('handles empty input', () => {
    expect(hasAttribution(undefined)).toBe(false);
    expect(hasAttribution('')).toBe(false);
  });
});

describe('attributionHits', () => {
  it('names only the fields that carry the line', () => {
    const hits = attributionHits([
      { name: 'pull request title', text: 'Plain title' },
      { name: 'commit abc1234567', text: 'Co-Authored-By: Claude <x>' },
      { name: 'pull request body', text: '' },
    ]);
    expect(hits).toEqual(['commit abc1234567']);
  });
});

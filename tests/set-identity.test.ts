import { describe, it, expect } from 'vitest';
import { nameMatchesText, canonicalSetSlug, unverifiedSetCitations, citationFeedback } from '../src/lib/set-identity';

// Minimal stand-in for sb.from('sets').select().in() -- catalogue rows keyed by set_number.
function fakeSb(catalog: Record<string, string>) {
  return {
    from: () => ({
      select: () => ({
        in: async (_c: string, nums: string[]) => ({
          data: nums.filter((n) => catalog[n]).map((n) => ({ set_number: n, name: catalog[n] })),
        }),
      }),
    }),
  } as any;
}

describe('nameMatchesText', () => {
  it('matches when half the significant tokens appear', () => {
    expect(nameMatchesText('Donkey Kong Arcade', 'The LEGO Donkey Kong Arcade is here')).toBe(true);
    expect(nameMatchesText('Medieval Town Square', 'The LEGO Donkey Kong Arcade is here')).toBe(false);
  });
  it('falls back to a whole-name match for names with no significant tokens', () => {
    expect(nameMatchesText('AT-AT', 'the classic AT-AT walker')).toBe(true);
    expect(nameMatchesText('AT-AT', 'look at that')).toBe(false);
    expect(nameMatchesText('KIT', 'the KIT set')).toBe(true);
  });
});

describe('canonicalSetSlug', () => {
  it('builds number-slug', () => {
    expect(canonicalSetSlug('72051', 'Donkey Kong Arcade')).toBe('72051-donkey-kong-arcade');
  });
});

describe('unverifiedSetCitations', () => {
  const sb = fakeSb({ '10332': 'Medieval Town Square', '72051': 'Donkey Kong Arcade', '2000': 'Sally Starfish' });
  it('flags a citation whose catalogue name is not in the text (Donkey Kong incident)', async () => {
    const bad = await unverifiedSetCitations(sb, 'The LEGO Donkey Kong Arcade (10332) has a Kong-o-Matic (2000).');
    expect(bad.map((b) => b.setNumber).sort()).toEqual(['10332', '2000']);
  });
  it('passes a correct citation and ignores non-catalogue numbers', async () => {
    expect(await unverifiedSetCitations(sb, 'The LEGO Donkey Kong Arcade (72051) costs (99999).')).toEqual([]);
  });
  it('feedback names the bad citations and the rule', () => {
    const fb = citationFeedback([{ setNumber: '10332', name: 'Medieval Town Square', form: '(NNNN)' }]);
    expect(fb).toContain('10332');
    expect(fb).toContain('without parentheses');
  });
});

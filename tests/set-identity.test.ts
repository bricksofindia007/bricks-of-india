import { describe, it, expect } from 'vitest';
import { nameMatchesText, canonicalSetSlug, unverifiedSetCitations, citationFeedback, resolveSourceSet } from '../src/lib/set-identity';

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

// Review-topic cases from 21 Nov. Catalogue rows here are FIXTURES written for the test, not the real catalogue:
// each fixture lists only the rows the case needs, so a number missing from it models a catalogue gap.
describe('resolveSourceSet (review topics, 21 Nov cases)', () => {
  const URL = 'https://example.test/reviews/some-review';
  it('does not take the year 2027 from the title when the set number 75470 is not in the catalogue', async () => {
    const sb = fakeSb({ '2027': 'Mustafar Duel' });
    expect(await resolveSourceSet(sb, URL, 'Mustafar Duel 75470 review, 2027')).toBeNull();
  });
  it('takes the title set number that is in the catalogue and named in the text, not the year', async () => {
    const sb = fakeSb({ '75470': 'Mustafar Duel', '2027': 'Mustafar Duel' });
    const r = await resolveSourceSet(sb, URL, 'Mustafar Duel 75470 review, 2027');
    expect(r?.setNumber).toBe('75470');
    expect(r?.via).toBe('title');
  });
  it('does not fall through from title 11388 (not in catalogue) to 21359 in the excerpt', async () => {
    const sb = fakeSb({ '21359': 'Venetian Neighbourhood' });
    expect(await resolveSourceSet(sb, URL, '11388 Venetian Neighbourhood', 'Venetian Neighbourhood 21359 is also mentioned')).toBeNull();
  });
  it('does not fall through from title 75478 (not in catalogue) to 75172 in the title', async () => {
    const sb = fakeSb({ '75172': 'Y-wing Starfighter' });
    expect(await resolveSourceSet(sb, URL, '75478 Rebel Y-wing', 'The Y-wing Starfighter 75172 is in the article too')).toBeNull();
  });
  it('resolves a title set number that is in the catalogue and named in the text', async () => {
    const sb = fakeSb({ '21375': 'Godzilla Monster' });
    const r = await resolveSourceSet(sb, URL, '21375 Godzilla');
    expect(r?.setNumber).toBe('21375');
  });
  it('a bare number with no catalogue row (40889, 40909) is not identified', async () => {
    const sb = fakeSb({});
    expect(await resolveSourceSet(sb, URL, '40889')).toBeNull();
    expect(await resolveSourceSet(sb, URL, '40909')).toBeNull();
  });
  it('uses the excerpt set number when the title holds no set-like number', async () => {
    const sb = fakeSb({ '75172': 'Y-wing Starfighter' });
    const r = await resolveSourceSet(sb, URL, 'Y-wing review', 'The Y-wing Starfighter 75172 is back');
    expect(r?.setNumber).toBe('75172');
    expect(r?.via).toBe('excerpt');
  });
  it('a year is still used when it is the only number in the article', async () => {
    const sb = fakeSb({ '2027': 'Mustafar Duel' });
    const r = await resolveSourceSet(sb, URL, 'Mustafar Duel 2027');
    expect(r?.setNumber).toBe('2027');
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

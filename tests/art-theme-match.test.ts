// The Art theme's name match is an exact list, not a substring. Each raw theme value is checked against every curated
// theme, so each one has a single, known home (or none).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { THEMES } from '../src/lib/brand';
import { EXACT_NAME_MATCH, matchesThemeName, resolveThemeSlug } from '../src/lib/themeMapping';

const art = THEMES.find((t) => t.slug === 'art')!;
const classic = THEMES.find((t) => t.slug === 'classic')!;
const homesOf = (raw: string) =>
  THEMES.filter((t) => matchesThemeName(raw, t.name, t.slug)).map((t) => t.slug);

describe('Art: exact theme names', () => {
  it('the Art list is exactly LEGO Art and Posters and Art Prints', () => {
    expect(EXACT_NAME_MATCH.art).toEqual(['LEGO Art', 'Posters and Art Prints']);
  });
  it('the two listed names are on the Art page', () => {
    expect(homesOf('LEGO Art')).toContain('art');
    expect(homesOf('Posters and Art Prints')).toContain('art');
  });
  it('words that contain "art" inside another word are not on the Art page', () => {
    for (const raw of ['Party', 'Smart', 'Start', 'Cartoon', 'Heart', 'Parts', 'Art Prints', 'art']) {
      expect(matchesThemeName(raw, art.name, art.slug), raw).toBe(false);
    }
  });
  it('"Activity Books with LEGO Parts" is not on the Art page (it matched only through "Parts")', () => {
    expect(matchesThemeName('Activity Books with LEGO Parts', art.name, art.slug)).toBe(false);
  });
});

describe('Activity Books with LEGO Parts: no theme page', () => {
  it('no curated theme matches it', () => {
    expect(homesOf('Activity Books with LEGO Parts')).toEqual([]);
  });
  it('it stays an explicit exclusion in the mapping (no link anywhere)', () => {
    expect(resolveThemeSlug('Activity Books with LEGO Parts')).toBeNull();
  });
});

describe('Classic Castle: the Classic page', () => {
  it('the Classic name match still takes it in', () => {
    expect(matchesThemeName('Classic Castle', classic.name, classic.slug)).toBe(true);
    expect(homesOf('Classic Castle')).toEqual(['classic']);
  });
});

describe('the other curated names keep the substring rule', () => {
  it('Classic and City still match by substring', () => {
    expect(matchesThemeName('Classic Space', classic.name, classic.slug)).toBe(true);
    expect(matchesThemeName('City Advent Calendar', 'City', 'city')).toBe(true);
  });
});

describe('the index reads the Art list and no substring', () => {
  it('theme-index uses the exact list when a theme has one', () => {
    const src = readFileSync(join(__dirname, '../src/lib/theme-index.ts'), 'utf8');
    expect(src).toContain('EXACT_NAME_MATCH[slug]');
    expect(src).toContain("q.in('theme', exact)");
    expect(src).toContain("q.ilike('theme', `%${themeName}%`)");
  });
});

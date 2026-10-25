// Theme pages with no priced set: noindex, follow and out of the sitemap, behind FEATURE_FLAGS.thinThemeNoindex (off).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const flags = vi.hoisted(() => ({ thinThemeNoindex: false }));
vi.mock('../src/lib/feature-flags', () => ({ FEATURE_FLAGS: flags }));

import { themeRouteMetadata, NO_PRICED_SET_THEMES, themeIsThin } from '../src/lib/theme-metadata';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

beforeEach(() => {
  flags.thinThemeNoindex = false;
});

describe('flag off (the shipped state)', () => {
  it('every theme page stays indexed, including the five listed', () => {
    for (const slug of NO_PRICED_SET_THEMES) {
      expect(themeIsThin(slug)).toBe(false);
      expect(themeRouteMetadata(slug, 1, null).robots).toBeUndefined();
    }
  });
});

describe('flag on', () => {
  beforeEach(() => {
    flags.thinThemeNoindex = true;
  });

  it('the five listed theme pages are noindex, follow on every page number', () => {
    expect(NO_PRICED_SET_THEMES).toEqual(['nexo-knights', 'legends-of-chima', 'bionicle', 'dreamzzz', 'dots']);
    for (const slug of NO_PRICED_SET_THEMES) {
      expect(themeRouteMetadata(slug, 1, null).robots).toEqual({ index: false, follow: true });
      expect(themeRouteMetadata(slug, 3, null).robots).toEqual({ index: false, follow: true });
    }
  });

  it('other theme pages are unchanged', () => {
    expect(themeRouteMetadata('technic', 1, null).robots).toBeUndefined();
    expect(themeRouteMetadata('harry-potter', 2, null).robots).toBeUndefined();
  });
});

describe('sitemap', () => {
  it('leaves the thin themes out of the theme list, and only those', () => {
    expect(read('src/app/sitemap.ts')).toMatch(/THEMES\.filter\(\(t\) => !themeIsThin\(t\.slug\)\)/);
  });
});

// Order 0870: one switch hides unpriced sets (sitemap and set-page noindex); a second switch covers the two duplicate-review
// redirects. Switch off must equal the live site. Live behaviour is written out below from the live commit.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setRobotsNoindex } from '../src/lib/indexing-price';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

// Live (1e8bceeb): the set-page robots rule is tier3 or the noindex override only.
const liveRobots = (set: { index_tier: string; noindex_override?: boolean | null }) =>
  set.index_tier === 'tier3' || Boolean(set.noindex_override);

describe('set-page robots: switch off equals live', () => {
  const cases = [
    { index_tier: 'tier1', noindex_override: false },
    { index_tier: 'tier2', noindex_override: false },
    { index_tier: 'tier3', noindex_override: false },
    { index_tier: 'tier2', noindex_override: true },
  ];
  for (const set of cases) {
    for (const priced of [true, false]) {
      it(`${set.index_tier} override=${set.noindex_override} priced=${priced}: same answer as live`, () => {
        expect(setRobotsNoindex(set, priced, false)).toBe(liveRobots(set));
      });
    }
  }
  it('switch on: an unpriced set is noindex; a priced set is not', () => {
    expect(setRobotsNoindex({ index_tier: 'tier2', noindex_override: false }, false, true)).toBe(true);
    expect(setRobotsNoindex({ index_tier: 'tier1', noindex_override: false }, true, true)).toBe(false);
  });
  it('the set page uses the helper with the switch', () => {
    const page = read('src/app/sets/[slug]/page.tsx');
    expect(page).toMatch(/setRobotsNoindex\(set, priced, FEATURE_FLAGS\.unpricedSetsHidden\)/);
  });
});

describe('the two switches are declared off', () => {
  it('unpriced sets: both flag files, same name', () => {
    expect(read("config/feature_flags.py")).toMatch(/"unpriced_sets_hidden": True,/);
    expect(read("src/lib/feature-flags.ts")).toMatch(/unpricedSetsHidden: true,/);
  });
  it('review redirects: JSON switch is off', () => {
    expect(JSON.parse(read('config/review-redirect-switch.json')).review_duplicate_redirects).toBe(false);
  });
});

describe('review URLs: switch off equals live (both answer 200, no redirect)', () => {
  const REVIEW_SOURCES = [
    '/reviews/lego-sagrada-famlia-21065-worth-76400-2',
    '/reviews/lego-ideas-21373-downton-abbey-worth-the-wait',
  ];

  afterEach(() => {
    vi.doUnmock('node:fs');
    vi.resetModules();
  });

  it('with the switch off, neither review URL is redirected', async () => {
    vi.resetModules();
    const cfg = (await import('../next.config.mjs')).default;
    const rules = await cfg.redirects();
    const sources = rules.map((r: { source: string }) => r.source);
    for (const s of REVIEW_SOURCES) expect(sources, s).not.toContain(s);
  });

  it('with the switch off, the redirect list is the live list plus the accepted theme redirect', async () => {
    vi.resetModules();
    const cfg = (await import('../next.config.mjs')).default;
    const rules = await cfg.redirects();
    // Live has 43 permanent redirects. Main adds the minifig theme redirect (accepted, 0860), so 44 with the switch off.
    expect(rules.filter((r: { permanent?: boolean }) => r.permanent === true)).toHaveLength(44);
    expect(rules.map((r: { source: string }) => r.source)).toContain('/themes/series-16-minifigures');
  });

  it('with the switch on, both review URLs redirect as before', async () => {
    vi.resetModules();
    const real = await vi.importActual<typeof import('node:fs')>('node:fs');
    vi.doMock('node:fs', () => ({
      ...real,
      default: { ...real, readFileSync: (p: unknown, enc: unknown) =>
        String(p).endsWith('review-redirect-switch.json') ? '{"review_duplicate_redirects": true}' : real.readFileSync(p as never, enc as never) },
    }));
    const cfg = (await import('../next.config.mjs')).default;
    const rules = await cfg.redirects();
    const sources = rules.map((r: { source: string }) => r.source);
    for (const s of REVIEW_SOURCES) expect(sources, s).toContain(s);
  });
});

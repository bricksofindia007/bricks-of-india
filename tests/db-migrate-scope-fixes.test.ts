// SCOPE=fixes (order 0838, option 1): the after-apply parity passes only when the migrations still unapplied are exactly
// the set held at the start of the run, and production has nothing the repo lacks. Other scopes are unchanged.
import { describe, it, expect } from 'vitest';
import { fixesScopeParity, compareParity } from '../scripts/ci/migration-parity.mjs';

const repo = ['20261001000000', '20261002000000', '20261003000000', '20261004000000'];
const held = ['20261003000000', '20261004000000'];

describe('fixesScopeParity: held set must equal the leftover set', () => {
  it('passes when exactly the held migrations are still unapplied and nothing else differs', () => {
    const r = fixesScopeParity({ repo, prod: ['20261001000000', '20261002000000'], heldAtStart: held });
    expect(r.ok).toBe(true);
    expect(r.reasons).toEqual([]);
    expect(r.unapplied).toEqual(held);
  });
  it('passes when nothing is held and everything is applied', () => {
    const r = fixesScopeParity({ repo, prod: repo, heldAtStart: [] });
    expect(r.ok).toBe(true);
  });
  it('fails when one extra migration is unapplied that was not held at the start', () => {
    const r = fixesScopeParity({ repo, prod: ['20261001000000'], heldAtStart: held });
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/not held at the start of this run: 20261002000000/);
  });
  it('fails when a held migration was applied during the run', () => {
    const r = fixesScopeParity({ repo, prod: ['20261001000000', '20261002000000', '20261003000000'], heldAtStart: held });
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/held at the start of this run but applied now: 20261003000000/);
  });
  it('fails when production has a version the repo does not have', () => {
    const r = fixesScopeParity({ repo, prod: ['20261001000000', '20261002000000', '20269999999999'], heldAtStart: held });
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/no repo file: 20269999999999/);
  });
  it('reports every reason at once: production extras and unheld leftovers', () => {
    const r = fixesScopeParity({ repo, prod: ['20269999999999'], heldAtStart: held });
    expect(r.ok).toBe(false);
    expect(r.reasons.length).toBe(2);
  });
});

describe('other scopes keep the old rule', () => {
  it('compareParity still says ok only when nothing is unapplied on either side', () => {
    expect(compareParity(repo, repo).ok).toBe(true);
    expect(compareParity(repo, ['20261001000000', '20261002000000']).ok).toBe(false);
    expect(compareParity(repo, [...repo, '20269999999999']).ok).toBe(false);
  });
});

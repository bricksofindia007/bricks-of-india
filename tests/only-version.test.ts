// The only_version choice and the parity rule of db-migrate (order 0010 item 8). Pure functions; no database.
import { describe, it, expect } from 'vitest';
import { selectOnlyVersion, onlyVersionParity } from '../scripts/ci/only-version.mjs';

const versionOf = (f: string) => f.split('_')[0];
const pending = ['20261022180000_a.sql', '20261026100000_run_retention_stock_state.sql', '20261026140000_b.sql'];

describe('selectOnlyVersion', () => {
  it('an empty only_version keeps the old behaviour: everything pending is applied', () => {
    expect(selectOnlyVersion({ pendingMigrations: pending, onlyVersion: '', versionOf }).apply).toEqual(pending);
  });

  it('one named version: only that migration applies, the rest are held', () => {
    const r = selectOnlyVersion({ pendingMigrations: pending, onlyVersion: '20261026100000', versionOf });
    expect(r.apply).toEqual(['20261026100000_run_retention_stock_state.sql']);
    expect(r.held).toEqual(['20261022180000_a.sql', '20261026140000_b.sql']);
  });

  it('a version that is not pending is refused', () => {
    const r = selectOnlyVersion({ pendingMigrations: pending, onlyVersion: '20261026120000', versionOf });
    expect(r.error).toMatch(/not exactly one pending migration \(found 0\)/);
  });

  it('a version listed twice is refused', () => {
    const r = selectOnlyVersion({ pendingMigrations: [...pending, '20261026100000_dup.sql'], onlyVersion: '20261026100000', versionOf });
    expect(r.error).toMatch(/found 2/);
  });
});

describe('onlyVersionParity', () => {
  it('the held set is allowed to stay unapplied, nothing else', () => {
    const repo = ['20261022180000', '20261026100000', '20261026140000'];
    const ok = onlyVersionParity({ repoVersions: repo, prodVersions: ['20261026100000'], heldVersions: ['20261022180000', '20261026140000'] });
    expect(ok.ok).toBe(true);
  });

  it('fails if the named migration did not apply', () => {
    const repo = ['20261022180000', '20261026100000'];
    const bad = onlyVersionParity({ repoVersions: repo, prodVersions: ['20261022180000'], heldVersions: ['20261022180000'] });
    expect(bad.ok).toBe(false);
  });

  it('fails if the target has a version the repo does not', () => {
    const bad = onlyVersionParity({ repoVersions: ['20261026100000'], prodVersions: ['20261026100000', '20990101000000'], heldVersions: [] });
    expect(bad.ok).toBe(false);
    expect(bad.prodOnly).toEqual(['20990101000000']);
  });
});

// Tests for only-version.mjs (pure). Run: node --test scripts/ci/only-version.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectOnlyVersion, onlyVersionParity } from './only-version.mjs';

const versionOf = (f) => f.split('_')[0];
const pending = ['20261022180000_a.sql', '20261026100000_run_retention_stock_state.sql', '20261026140000_b.sql'];

test('empty only_version keeps the old behaviour: everything pending is applied', () => {
  assert.deepEqual(selectOnlyVersion({ pendingMigrations: pending, onlyVersion: '', versionOf }).apply, pending);
});

test('one named version: only that migration applies, the rest are held', () => {
  const r = selectOnlyVersion({ pendingMigrations: pending, onlyVersion: '20261026100000', versionOf });
  assert.deepEqual(r.apply, ['20261026100000_run_retention_stock_state.sql']);
  assert.deepEqual(r.held, ['20261022180000_a.sql', '20261026140000_b.sql']);
});

test('a version that is not pending is refused', () => {
  const r = selectOnlyVersion({ pendingMigrations: pending, onlyVersion: '20261026120000', versionOf });
  assert.match(r.error, /not exactly one pending migration \(found 0\)/);
});

test('a version listed twice is refused', () => {
  const r = selectOnlyVersion({ pendingMigrations: [...pending, '20261026100000_dup.sql'], onlyVersion: '20261026100000', versionOf });
  assert.match(r.error, /found 2/);
});

test('parity: the held set is allowed to stay unapplied, nothing else', () => {
  const repo = ['20261022180000', '20261026100000', '20261026140000'];
  const ok = onlyVersionParity({ repoVersions: repo, prodVersions: ['20261026100000'], heldVersions: ['20261022180000', '20261026140000'] });
  assert.equal(ok.ok, true);
});

test('parity fails if the named migration did not apply', () => {
  const repo = ['20261022180000', '20261026100000'];
  const bad = onlyVersionParity({ repoVersions: repo, prodVersions: ['20261022180000'], heldVersions: ['20261022180000'] });
  assert.equal(bad.ok, false);
});

test('parity fails if the target has a version the repo does not', () => {
  const bad = onlyVersionParity({ repoVersions: ['20261026100000'], prodVersions: ['20261026100000', '20990101000000'], heldVersions: [] });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.prodOnly, ['20990101000000']);
});
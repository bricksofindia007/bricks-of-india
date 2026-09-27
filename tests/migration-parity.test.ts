import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// @ts-expect-error -- plain .mjs module
import { compareParity, repoVersions, versionOf } from '../scripts/ci/migration-parity.mjs';

const V = ['20260927140000', '20260927150105', '20260927152208'];

describe('migration parity (FP2.3, #197)', () => {
  it('passes when repo and production match', () => {
    expect(compareParity(V, V).ok).toBe(true);
  });
  it('fails on a production-only version (drift fixture: applied outside the repo)', () => {
    const r = compareParity(V, [...V, '20260928000000']);
    expect(r.ok).toBe(false);
    expect(r.prodOnly).toEqual(['20260928000000']);
  });
  it('fails on a repo file that production never applied', () => {
    const r = compareParity([...V, '20260928000000'], V);
    expect(r.ok).toBe(false);
    expect(r.unapplied).toEqual(['20260928000000']);
  });
  it('reports a file added by the PR as pending, not a failure', () => {
    const r = compareParity([...V, '20260928000000'], V, ['20260928000000']);
    expect(r.ok).toBe(true);
    expect(r.pending).toEqual(['20260928000000']);
  });
  it('reads only top-level files; _archive/_history are ignored', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-'));
    fs.writeFileSync(path.join(d, '20260927140000_baseline.sql'), '');
    fs.mkdirSync(path.join(d, '_history'));
    fs.writeFileSync(path.join(d, '_history', '20260627185825_old.sql'), '');
    fs.writeFileSync(path.join(d, 'README.md'), '');
    expect(repoVersions(d)).toEqual(['20260927140000']);
    expect(versionOf('x/20260927140000_baseline.sql')).toBe('20260927140000');
    expect(versionOf('notes.sql')).toBeNull();
  });
});

// The held list for migration parity (order 0760): merged, deliberately not applied, and reported instead of failing.
// A new unapplied migration still fails. A stale entry fails until it is removed.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compareParity, loadHeld } from '../scripts/ci/migration-parity.mjs';

const HELD_FILE = path.join(__dirname, '..', 'scripts/ci/migration-held.json');
const REPO_DIR = path.join(__dirname, '..', 'supabase/migrations');

const BASE = ['20260927140000', '20260927150105'];
const X = '20261022180000';
const Y = '20261030090000';

describe('compareParity with the held list', () => {
  it('without a held list the result is as before: an unapplied repo file fails', () => {
    const r = compareParity([...BASE, X], BASE);
    expect(r.ok).toBe(false);
    expect(r.unapplied).toEqual([X]);
    expect(r.heldUnapplied).toEqual([]);
  });

  it('a held and unapplied version is reported as held, and the check passes', () => {
    const r = compareParity([...BASE, X], BASE, [], [X]);
    expect(r.ok).toBe(true);
    expect(r.unapplied).toEqual([]);
    expect(r.heldUnapplied).toEqual([X]);
  });

  it('a NEW unapplied version still fails even when another version is held', () => {
    const r = compareParity([...BASE, X, Y], BASE, [], [X]);
    expect(r.ok).toBe(false);
    expect(r.unapplied).toEqual([Y]);
    expect(r.heldUnapplied).toEqual([X]);
  });

  it('a held version that is now applied in production fails until its entry is removed', () => {
    const r = compareParity([...BASE, X], [...BASE, X], [], [X]);
    expect(r.ok).toBe(false);
    expect(r.staleHeld).toEqual([X]);
  });

  it('a held version with no repo file fails (stale entry)', () => {
    const r = compareParity(BASE, BASE, [], [X]);
    expect(r.ok).toBe(false);
    expect(r.staleHeld).toEqual([X]);
  });

  it('a version added by the PR under test is pending, not held', () => {
    const r = compareParity([...BASE, X], BASE, [X], [X]);
    expect(r.ok).toBe(true);
    expect(r.pending).toEqual([X]);
    expect(r.heldUnapplied).toEqual([]);
  });
});

describe('loadHeld', () => {
  const tmp = (text: string) => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'held-')), 'held.json');
    fs.writeFileSync(f, text);
    return f;
  };

  it('returns the versions of a valid list', () => {
    expect(loadHeld(tmp(JSON.stringify([{ version: X, reason: 'r', held_by: 'o' }])))).toEqual([X]);
  });
  it('rejects a bad version', () => {
    expect(() => loadHeld(tmp(JSON.stringify([{ version: '2026', reason: 'r', held_by: 'o' }])))).toThrow(/bad version/);
  });
  it('rejects an entry with no reason or no held_by', () => {
    expect(() => loadHeld(tmp(JSON.stringify([{ version: X, held_by: 'o' }])))).toThrow(/needs reason and held_by/);
    expect(() => loadHeld(tmp(JSON.stringify([{ version: X, reason: 'r' }])))).toThrow(/needs reason and held_by/);
  });
  it('rejects a list that is not an array', () => {
    expect(() => loadHeld(tmp('{}'))).toThrow(/must be a JSON array/);
  });
});

describe('the committed held list', () => {
  const list = JSON.parse(fs.readFileSync(HELD_FILE, 'utf8')) as { version: string; pr: string; held_by: string; reason: string }[];

  it('lists exactly the ten merged, unapplied migrations from the 26 to 29 Oct holds', () => {
    expect(list.map((e) => e.version).sort()).toEqual([
      '20261022180000', '20261024230000', '20261025010000', '20261026110000', '20261026120000',
      '20261026130000', '20261026140000', '20261027120000', '20261027130000', '20261029100000',
    ]);
  });

  it('every entry has a reason and who held it', () => {
    for (const e of list) {
      expect(e.reason.length, e.version).toBeGreaterThan(10);
      expect(e.held_by.length, e.version).toBeGreaterThan(3);
    }
  });

  it('every held version has a repo file (no stale entries)', () => {
    const files = fs.readdirSync(REPO_DIR);
    for (const e of list) {
      expect(files.some((f) => f.startsWith(e.version + '_')), e.version).toBe(true);
    }
  });

  it('loads through the same loader the check uses', () => {
    expect(loadHeld(HELD_FILE)).toHaveLength(10);
  });
});

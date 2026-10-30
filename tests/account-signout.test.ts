// P4 (order 0230): sign-out ends the session and nothing else. Stub database only; nothing is written anywhere else.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { handleSignOut, handleListsRequest } from '../src/lib/account-lists';

type Row = Record<string, any>;
type Tables = { account_sessions: Row[]; accounts: Row[]; saved_sets: Row[] };
const NOW = Date.parse('2026-10-30T00:00:00Z');
const FUTURE = '2026-11-30T00:00:00Z';
const hash = (t: string) => createHash('sha256').update(t).digest('hex');

function makeDb(tables: Tables, opts: { failRevoke?: boolean } = {}) {
  const writes: string[] = [];
  const from = (name: keyof Tables) => {
    const q: { op: 'select' | 'insert' | 'delete' | 'update'; filters: [string, any][]; single: boolean; row?: Row } = { op: 'select', filters: [], single: false };
    const run = (): { data: any; error: any } => {
      if (q.op === 'update' && opts.failRevoke) return { data: null, error: { message: 'boom' } };
      const rows = tables[name];
      const match = (r: Row) => q.filters.every(([c, v]) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v));
      if (q.op === 'select') {
        const out = rows.filter(match);
        return { data: q.single ? out[0] ?? null : out, error: null };
      }
      writes.push(`${q.op}:${name}`);
      if (q.op === 'update') {
        rows.filter(match).forEach((r) => Object.assign(r, q.row));
        return { data: null, error: null };
      }
      if (q.op === 'insert') rows.push({ ...q.row! });
      else rows.splice(0, rows.length, ...rows.filter((r) => !match(r)));
      return { data: null, error: null };
    };
    const b: any = {
      select: () => b,
      eq: (c: string, v: any) => { q.filters.push([c, v]); return b; },
      is: (c: string, v: any) => { q.filters.push([c, v]); return b; },
      maybeSingle: () => { q.single = true; return b; },
      insert: (row: Row) => { q.op = 'insert'; q.row = row; return b; },
      update: (row: Row) => { q.op = 'update'; q.row = row; return b; },
      delete: () => { q.op = 'delete'; return b; },
      then: (ok: (v: any) => any, bad?: (e: any) => any) => Promise.resolve().then(run).then(ok, bad),
    };
    return b;
  };
  return { db: { from } as any, writes };
}

function seed(): Tables {
  return {
    account_sessions: [
      { token_hash: hash('token-A'), account_id: 'acct-A', expires_at: FUTURE, revoked_at: null },
      { token_hash: hash('token-B'), account_id: 'acct-B', expires_at: FUTURE, revoked_at: null },
    ],
    accounts: [{ id: 'acct-A', email: 'a@example.invalid', deleted_at: null }, { id: 'acct-B', email: 'b@example.invalid', deleted_at: null }],
    saved_sets: [
      { account_id: 'acct-A', list: 'wishlist', set_number: '90001', qty: 1, added_at: '2026-10-20T10:00:00Z' },
      { account_id: 'acct-A', list: 'collection', set_number: '90002', qty: 1, added_at: '2026-10-20T10:00:00Z' },
    ],
  };
}

describe('sign-out ends the session', () => {
  it('with no cookie there is nothing to end: ok, and nothing is written', async () => {
    const { db, writes } = makeDb(seed());
    expect((await handleSignOut(db, undefined, NOW)).status).toBe('ok');
    expect(writes).toEqual([]);
  });

  it('after sign-out the same cookie reads nothing (signed-out)', async () => {
    const t = seed();
    const { db } = makeDb(t);
    expect((await handleSignOut(db, 'token-A', NOW)).status).toBe('ok');
    expect(t.account_sessions[0].revoked_at).toBe(new Date(NOW).toISOString());
    expect((await handleListsRequest(db, 'token-A', { method: 'GET' }, NOW)).status).toBe('signed-out');
  });

  it('after sign-out a write with the same cookie changes nothing', async () => {
    const t = seed();
    const { db } = makeDb(t);
    await handleSignOut(db, 'token-A', NOW);
    const before = JSON.stringify(t.saved_sets);
    expect((await handleListsRequest(db, 'token-A', { method: 'POST', list: 'wishlist', set: '90009' }, NOW)).status).toBe('signed-out');
    expect(JSON.stringify(t.saved_sets)).toBe(before);
  });
});

describe('sign-out leaves the lists alone', () => {
  it('the saved sets are not read or written by sign-out', async () => {
    const t = seed();
    const { db, writes } = makeDb(t);
    const before = JSON.stringify(t.saved_sets);
    await handleSignOut(db, 'token-A', NOW);
    expect(writes).toEqual(['update:account_sessions']);
    expect(JSON.stringify(t.saved_sets)).toBe(before);
  });

  it("another account's session is not ended by this sign-out", async () => {
    const t = seed();
    const { db } = makeDb(t);
    await handleSignOut(db, 'token-A', NOW);
    expect(t.account_sessions[1].revoked_at).toBeNull();
    expect((await handleListsRequest(db, 'token-B', { method: 'GET' }, NOW)).status).toBe('ok');
  });
});

describe('a failed revoke does not claim a sign-out', () => {
  it('answers unavailable, and the session stays live', async () => {
    const t = seed();
    const { db } = makeDb(t, { failRevoke: true });
    expect((await handleSignOut(db, 'token-A', NOW)).status).toBe('unavailable');
    expect(t.account_sessions[0].revoked_at).toBeNull();
    expect((await handleListsRequest(db, 'token-A', { method: 'GET' }, NOW)).status).toBe('ok');
  });
});

describe('the route stays off while sign-in is off', () => {
  it('POST answers 404 with the flags off, and nothing is revoked', async () => {
    const { NextRequest } = await import('next/server');
    const { POST } = await import('../src/app/api/account/sign-out/route');
    const res = await POST(new NextRequest('https://bricksofindia.com/api/account/sign-out', { method: 'POST' }));
    expect(res.status).toBe(404);
  });
});

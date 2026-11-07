// P2 (order 0230): account saved-set routes, against an in-memory stub of the database. No database is used.
// The stub applies the held rules that matter here: the primary key on saved_sets, the 500-per-list trigger (P0001), and
// row ownership by account_id. Nothing is written anywhere else.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { handleListsRequest, readAccountLists, LIST_LIMIT } from '../src/lib/account-lists';

type Row = Record<string, any>;
type Tables = { account_sessions: Row[]; accounts: Row[]; saved_sets: Row[] };
const NOW = Date.parse('2026-10-30T00:00:00Z');
const FUTURE = '2026-11-30T00:00:00Z';
const hash = (t: string) => createHash('sha256').update(t).digest('hex');

function makeDb(tables: Tables, opts: { failTable?: string } = {}) {
  const reads: string[] = [];
  const from = (name: keyof Tables) => {
    const q: { op: 'select' | 'insert' | 'delete'; filters: [string, any][]; single: boolean; row?: Row } = { op: 'select', filters: [], single: false };
    const run = (): { data: any; error: any } => {
      if (opts.failTable === name) return { data: null, error: { message: 'boom' } };
      const rows = tables[name];
      const match = (r: Row) => q.filters.every(([c, v]) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v));
      if (q.op === 'select') {
        reads.push(name);
        const out = rows.filter(match);
        return { data: q.single ? out[0] ?? null : out, error: null };
      }
      if (q.op === 'insert') {
        const r = { ...q.row! };
        if (name === 'saved_sets') {
          const dup = rows.find((x) => x.account_id === r.account_id && x.list === r.list && x.set_number === r.set_number);
          if (dup) return { data: null, error: { code: '23505', message: 'duplicate key' } };
          // The held trigger: at most LIST_LIMIT sets per account and list.
          const count = rows.filter((x) => x.account_id === r.account_id && x.list === r.list).length;
          if (count >= LIST_LIMIT) return { data: null, error: { code: 'P0001', message: 'list is full' } };
        }
        rows.push(r);
        return { data: null, error: null };
      }
      // delete
      const keep = rows.filter((r) => !match(r));
      rows.splice(0, rows.length, ...keep);
      return { data: null, error: null };
    };
    const b: any = {
      select: () => b,
      eq: (c: string, v: any) => { q.filters.push([c, v]); return b; },
      is: (c: string, v: any) => { q.filters.push([c, v]); return b; },
      maybeSingle: () => { q.single = true; return b; },
      insert: (row: Row) => { q.op = 'insert'; q.row = row; return b; },
      delete: () => { q.op = 'delete'; return b; },
      then: (ok: (v: any) => any, bad?: (e: any) => any) => Promise.resolve().then(run).then(ok, bad),
    };
    return b;
  };
  return { db: { from } as any, reads };
}

function seed(over: Partial<Tables> = {}): Tables {
  return {
    account_sessions: [
      { token_hash: hash('token-A'), account_id: 'acct-A', expires_at: FUTURE, revoked_at: null },
      { token_hash: hash('token-B'), account_id: 'acct-B', expires_at: FUTURE, revoked_at: null },
      { token_hash: hash('token-old'), account_id: 'acct-A', expires_at: '2026-10-01T00:00:00Z', revoked_at: null },
      { token_hash: hash('token-gone'), account_id: 'acct-A', expires_at: FUTURE, revoked_at: '2026-10-29T00:00:00Z' },
    ],
    accounts: [
      { id: 'acct-A', email: 'a@example.invalid', deleted_at: null },
      { id: 'acct-B', email: 'b@example.invalid', deleted_at: null },
    ],
    saved_sets: [
      { account_id: 'acct-A', list: 'wishlist', set_number: '90001', qty: 1, added_at: '2026-10-20T10:00:00Z' },
      { account_id: 'acct-B', list: 'wishlist', set_number: '90002', qty: 1, added_at: '2026-10-21T10:00:00Z' },
    ],
    ...over,
  };
}

describe('no session gives no data', () => {
  it('no cookie: signed-out, and nothing is read', async () => {
    const t = seed();
    const { db, reads } = makeDb(t);
    const r = await handleListsRequest(db, undefined, { method: 'GET' }, NOW);
    expect(r.status).toBe('signed-out');
    expect(reads).toEqual([]);
  });

  it('an unknown token is signed-out', async () => {
    const { db } = makeDb(seed());
    expect((await handleListsRequest(db, 'nobody', { method: 'GET' }, NOW)).status).toBe('signed-out');
  });

  it('an expired session is signed-out', async () => {
    const { db } = makeDb(seed());
    expect((await handleListsRequest(db, 'token-old', { method: 'GET' }, NOW)).status).toBe('signed-out');
  });

  it('a revoked session is signed-out (sign-out must end access)', async () => {
    const { db } = makeDb(seed());
    expect((await handleListsRequest(db, 'token-gone', { method: 'GET' }, NOW)).status).toBe('signed-out');
  });

  it('a write with no session changes nothing', async () => {
    const t = seed();
    const before = t.saved_sets.length;
    const { db } = makeDb(t);
    expect((await handleListsRequest(db, undefined, { method: 'POST', list: 'wishlist', set: '90009' }, NOW)).status).toBe('signed-out');
    expect(t.saved_sets.length).toBe(before);
  });
});

describe('one account cannot read or change another', () => {
  it('a live session reads only its own rows', async () => {
    const { db } = makeDb(seed());
    const r = await handleListsRequest(db, 'token-A', { method: 'GET' }, NOW);
    expect(r.status).toBe('ok');
    expect(r.lists?.wishlist.map((i) => i.set)).toEqual(['90001']);
  });

  it("account B's token does not see account A's rows", async () => {
    const { db } = makeDb(seed());
    const r = await handleListsRequest(db, 'token-B', { method: 'GET' }, NOW);
    expect(r.lists?.wishlist.map((i) => i.set)).toEqual(['90002']);
  });

  it('a write is always to the session account, never to another', async () => {
    const t = seed();
    const { db } = makeDb(t);
    await handleListsRequest(db, 'token-B', { method: 'POST', list: 'wishlist', set: '90005' }, NOW);
    expect(t.saved_sets.filter((r) => r.set_number === '90005').map((r) => r.account_id)).toEqual(['acct-B']);
  });

  it('a delete with another account token removes nothing of account A', async () => {
    const t = seed();
    const { db } = makeDb(t);
    expect((await handleListsRequest(db, 'token-B', { method: 'DELETE', list: 'wishlist', set: '90001' }, NOW)).status).toBe('ok');
    expect(t.saved_sets.some((r) => r.account_id === 'acct-A' && r.set_number === '90001')).toBe(true);
  });
});

describe('writes', () => {
  it('a new set is added to the session account', async () => {
    const t = seed();
    const { db } = makeDb(t);
    expect((await handleListsRequest(db, 'token-A', { method: 'POST', list: 'collection', set: '90003', qty: 2 }, NOW)).status).toBe('ok');
    const row = t.saved_sets.find((r) => r.set_number === '90003');
    expect(row).toMatchObject({ account_id: 'acct-A', list: 'collection', qty: 2 });
  });

  it('a set already on the list is ok and adds no second row', async () => {
    const t = seed();
    const { db } = makeDb(t);
    expect((await handleListsRequest(db, 'token-A', { method: 'POST', list: 'wishlist', set: '90001' }, NOW)).status).toBe('ok');
    expect(t.saved_sets.filter((r) => r.set_number === '90001')).toHaveLength(1);
  });

  it('a wishlist row always has qty 1', async () => {
    const t = seed();
    const { db } = makeDb(t);
    await handleListsRequest(db, 'token-A', { method: 'POST', list: 'wishlist', set: '90004', qty: 9 }, NOW);
    expect(t.saved_sets.find((r) => r.set_number === '90004')?.qty).toBe(1);
  });

  it('a bad set number or list name is invalid and writes nothing', async () => {
    const t = seed();
    const { db } = makeDb(t);
    const n = t.saved_sets.length;
    expect((await handleListsRequest(db, 'token-A', { method: 'POST', list: 'wishlist', set: 'abc' }, NOW)).status).toBe('invalid');
    expect((await handleListsRequest(db, 'token-A', { method: 'POST', list: 'owned', set: '90004' }, NOW)).status).toBe('invalid');
    expect((await handleListsRequest(db, 'token-A', { method: 'DELETE', list: 'wishlist', set: '1;drop' }, NOW)).status).toBe('invalid');
    expect(t.saved_sets.length).toBe(n);
  });

  it('removing a set that is not there is ok', async () => {
    const { db } = makeDb(seed());
    expect((await handleListsRequest(db, 'token-A', { method: 'DELETE', list: 'wishlist', set: '99999' }, NOW)).status).toBe('ok');
  });
});

describe('the 500 limit', () => {
  function fullList(account: string, list: 'wishlist' | 'collection', n = LIST_LIMIT): Row[] {
    return Array.from({ length: n }, (_, i) => ({ account_id: account, list, set_number: String(10000 + i), qty: 1, added_at: '2026-10-01T00:00:00Z' }));
  }

  it('a full list refuses one more set with limit, and adds nothing', async () => {
    const t = seed();
    // The seed already holds one wishlist set for account A, so leave exactly one free slot.
    t.saved_sets.push(...fullList('acct-A', 'wishlist', LIST_LIMIT - 2));
    const { db } = makeDb(t);
    expect((await handleListsRequest(db, 'token-A', { method: 'POST', list: 'wishlist', set: '20001' }, NOW)).status).toBe('ok');
    const n = t.saved_sets.length;
    expect((await handleListsRequest(db, 'token-A', { method: 'POST', list: 'wishlist', set: '20002' }, NOW)).status).toBe('limit');
    expect(t.saved_sets.length).toBe(n);
  });

  it('the database refusal (P0001) is mapped to limit, not unavailable', async () => {
    const t = seed({ saved_sets: [...seed().saved_sets, ...fullList('acct-A', 'wishlist', LIST_LIMIT - 2)] });
    const { db } = makeDb(t);
    expect((await handleListsRequest(db, 'token-A', { method: 'POST', list: 'wishlist', set: '20003' }, NOW)).status).toBe('ok');
    expect((await handleListsRequest(db, 'token-A', { method: 'POST', list: 'wishlist', set: '20004' }, NOW)).status).toBe('limit');
  });

  it('the limit is per list: a full wishlist does not block the collection', async () => {
    const t = seed();
    t.saved_sets.push(...fullList('acct-A', 'wishlist'));
    const { db } = makeDb(t);
    expect((await handleListsRequest(db, 'token-A', { method: 'POST', list: 'collection', set: '20005' }, NOW)).status).toBe('ok');
  });
});

describe('a failed read falls back honestly', () => {
  it('a failed session read answers unavailable (never signed-in, never data)', async () => {
    const { db } = makeDb(seed(), { failTable: 'account_sessions' });
    expect((await handleListsRequest(db, 'token-A', { method: 'GET' }, NOW)).status).toBe('unavailable');
  });

  it('a failed list read answers unavailable and returns no lists', async () => {
    const { db } = makeDb(seed(), { failTable: 'saved_sets' });
    const r = await handleListsRequest(db, 'token-A', { method: 'GET' }, NOW);
    expect(r.status).toBe('unavailable');
    expect(r.lists).toBeUndefined();
  });

  it('a failed write answers unavailable and says nothing was saved', async () => {
    const t = seed();
    const { db } = makeDb(t, { failTable: 'saved_sets' });
    expect((await handleListsRequest(db, 'token-A', { method: 'POST', list: 'wishlist', set: '90006' }, NOW)).status).toBe('unavailable');
    expect(t.saved_sets.some((r) => r.set_number === '90006')).toBe(false);
  });

  it('readAccountLists throws on a failed read (the caller decides what to show)', async () => {
    const { db } = makeDb(seed(), { failTable: 'saved_sets' });
    await expect(readAccountLists(db, 'acct-A')).rejects.toThrow('lists unreadable');
  });
});

describe('the routes stay off while sign-in is off', () => {
  it('GET answers 404 with the flags off (no session is read)', async () => {
    const { NextRequest } = await import('next/server');
    const { GET } = await import('../src/app/api/account/lists/route');
    const res = await GET(new NextRequest('https://bricksofindia.com/api/account/lists'));
    expect(res.status).toBe(404);
  });
});

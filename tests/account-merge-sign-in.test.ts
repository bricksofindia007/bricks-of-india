// P3 (order 0230): the first sign-in merge, against an in-memory stub of the database. No database is used.
// The stub is the same small model as tests/account-lists.test.ts (kept separate so each PR stands alone).
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { handleMergeRequest, mergeBrowserLists, LIST_LIMIT } from '../src/lib/account-lists';

type Row = Record<string, any>;
type Tables = { account_sessions: Row[]; accounts: Row[]; saved_sets: Row[] };
const NOW = Date.parse('2026-10-30T00:00:00Z');
const FUTURE = '2026-11-30T00:00:00Z';
const hash = (t: string) => createHash('sha256').update(t).digest('hex');

function makeDb(tables: Tables, opts: { failTable?: string; failWrites?: boolean } = {}) {
  const from = (name: keyof Tables) => {
    const q: { op: 'select' | 'insert' | 'delete'; filters: [string, any][]; single: boolean; row?: Row } = { op: 'select', filters: [], single: false };
    const run = (): { data: any; error: any } => {
      if (opts.failTable === name) return { data: null, error: { message: 'boom' } };
      if (opts.failWrites && q.op !== 'select' && name === 'saved_sets') return { data: null, error: { message: 'boom' } };
      const rows = tables[name];
      const match = (r: Row) => q.filters.every(([c, v]) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v));
      if (q.op === 'select') {
        const out = rows.filter(match);
        return { data: q.single ? out[0] ?? null : out, error: null };
      }
      if (q.op === 'insert') {
        const r = { ...q.row! };
        if (name === 'saved_sets') {
          if (rows.some((x) => x.account_id === r.account_id && x.list === r.list && x.set_number === r.set_number)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          if (rows.filter((x) => x.account_id === r.account_id && x.list === r.list).length >= LIST_LIMIT) {
            return { data: null, error: { code: 'P0001', message: 'list is full' } };
          }
        }
        rows.push(r);
        return { data: null, error: null };
      }
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
  return { db: { from } as any };
}

function seed(saved: Row[] = []): Tables {
  return {
    account_sessions: [
      { token_hash: hash('token-A'), account_id: 'acct-A', expires_at: FUTURE, revoked_at: null },
      { token_hash: hash('token-B'), account_id: 'acct-B', expires_at: FUTURE, revoked_at: null },
    ],
    accounts: [{ id: 'acct-A', email: 'a@example.invalid', deleted_at: null }, { id: 'acct-B', email: 'b@example.invalid', deleted_at: null }],
    saved_sets: saved,
  };
}
const at = (day: number) => `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`;
const acct = (set: string, day: number, list = 'wishlist', account = 'acct-A', qty = 1): Row => ({ account_id: account, list, set_number: set, qty, added_at: at(day) });
const browser = (set: string, day: number, qty?: number) => ({ set, added_at: at(day), ...(qty ? { qty } : {}) });
const rowsOf = (t: Tables, account: string, list: string) => t.saved_sets.filter((r) => r.account_id === account && r.list === list);

describe('first sign-in: the browser lists join the account', () => {
  it('browser-only sets are written with their own added_at', async () => {
    const t = seed([acct('90001', 1)]);
    const { db } = makeDb(t);
    const r = await mergeBrowserLists(db, 'acct-A', { wishlist: [browser('90002', 5)], collection: [browser('90003', 6, 2)] });
    expect(r.status).toBe('ok');
    expect(rowsOf(t, 'acct-A', 'wishlist').map((x) => x.set_number).sort()).toEqual(['90001', '90002']);
    expect(rowsOf(t, 'acct-A', 'wishlist').find((x) => x.set_number === '90002')?.added_at).toBe(at(5));
    expect(rowsOf(t, 'acct-A', 'collection').find((x) => x.set_number === '90003')?.qty).toBe(2);
  });

  it('a set on both sides appears once, and the account copy is kept', async () => {
    const t = seed([acct('90001', 1)]);
    const { db } = makeDb(t);
    await mergeBrowserLists(db, 'acct-A', { wishlist: [browser('90001', 9)], collection: [] });
    const rows = rowsOf(t, 'acct-A', 'wishlist');
    expect(rows).toHaveLength(1);
    expect(rows[0].added_at).toBe(at(1));
  });

  it('running it again adds nothing new (safe to repeat)', async () => {
    const t = seed();
    const { db } = makeDb(t);
    const lists = { wishlist: [browser('90001', 1), browser('90002', 2)], collection: [] };
    await mergeBrowserLists(db, 'acct-A', lists);
    const after1 = JSON.stringify(t.saved_sets);
    await mergeBrowserLists(db, 'acct-A', lists);
    expect(JSON.stringify(t.saved_sets)).toBe(after1);
  });

  it('duplicates in the browser list are written once, and bad items are ignored', async () => {
    const t = seed();
    const { db } = makeDb(t);
    await mergeBrowserLists(db, 'acct-A', {
      wishlist: [browser('90001', 1), browser('90001', 2), { set: 'nope', added_at: at(3) } as any, { set: '90004', added_at: 'not a date' } as any],
      collection: [],
    });
    expect(rowsOf(t, 'acct-A', 'wishlist').map((x) => x.set_number)).toEqual(['90001']);
  });
});

describe('the 500 limit on the merge', () => {
  it('over the limit, the newest are kept: older account rows outside them are removed, browser rows fill in', async () => {
    const old = Array.from({ length: LIST_LIMIT - 1 }, (_, i) => acct(String(10000 + i), 1));
    const t = seed(old);
    const { db } = makeDb(t);
    const r = await mergeBrowserLists(db, 'acct-A', { wishlist: [browser('20001', 20), browser('20002', 21), browser('20003', 22)], collection: [] });
    expect(r.status).toBe('ok');
    expect(rowsOf(t, 'acct-A', 'wishlist')).toHaveLength(LIST_LIMIT);
    const sets = rowsOf(t, 'acct-A', 'wishlist').map((x) => x.set_number);
    expect(sets).toEqual(expect.arrayContaining(['20001', '20002', '20003']));
    expect(r.dropped?.wishlist).toBe(LIST_LIMIT - 1 + 3 - LIST_LIMIT);
  });

  it('a full account list with older browser sets adds none of them', async () => {
    const full = Array.from({ length: LIST_LIMIT }, (_, i) => acct(String(10000 + i), 20));
    const t = seed(full);
    const { db } = makeDb(t);
    const r = await mergeBrowserLists(db, 'acct-A', { wishlist: [browser('20009', 1)], collection: [] });
    expect(r.status).toBe('ok');
    expect(rowsOf(t, 'acct-A', 'wishlist')).toHaveLength(LIST_LIMIT);
    expect(rowsOf(t, 'acct-A', 'wishlist').some((x) => x.set_number === '20009')).toBe(false);
    expect(r.dropped?.wishlist).toBe(1);
  });
});

describe('signed out, failed reads and other accounts', () => {
  it('no session: signed-out and nothing is written', async () => {
    const t = seed();
    const { db } = makeDb(t);
    const r = await handleMergeRequest(db, undefined, { wishlist: [browser('90001', 1)] }, NOW);
    expect(r.status).toBe('signed-out');
    expect(t.saved_sets).toHaveLength(0);
  });

  it('a failed read writes nothing and answers unavailable', async () => {
    const t = seed();
    const { db } = makeDb(t, { failTable: 'saved_sets' });
    const r = await mergeBrowserLists(db, 'acct-A', { wishlist: [browser('90001', 1)], collection: [] });
    expect(r.status).toBe('unavailable');
    expect(t.saved_sets).toHaveLength(0);
  });

  it('a failed write answers unavailable (a retry completes the merge, since it is safe to repeat)', async () => {
    const t = seed();
    const { db } = makeDb(t, { failWrites: true });
    const r = await mergeBrowserLists(db, 'acct-A', { wishlist: [browser('90001', 1)], collection: [] });
    expect(r.status).toBe('unavailable');
  });

  it("the merge writes only to the session account; account B's rows are never touched", async () => {
    const t = seed([acct('90009', 1, 'wishlist', 'acct-B')]);
    const { db } = makeDb(t);
    await handleMergeRequest(db, 'token-A', { wishlist: [browser('90001', 1)], collection: [] }, NOW);
    expect(rowsOf(t, 'acct-B', 'wishlist').map((x) => x.set_number)).toEqual(['90009']);
    expect(rowsOf(t, 'acct-A', 'wishlist').map((x) => x.set_number)).toEqual(['90001']);
  });

  it('a body that is not the expected shape adds nothing', async () => {
    const t = seed();
    const { db } = makeDb(t);
    const r = await handleMergeRequest(db, 'token-A', 'not an object', NOW);
    expect(r.status).toBe('ok');
    expect(t.saved_sets).toHaveLength(0);
  });
});

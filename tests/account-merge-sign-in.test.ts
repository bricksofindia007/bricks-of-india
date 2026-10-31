// P3 (order 0230, changed by order 0280 decision 1): the first sign-in merge, against an in-memory stub of the database.
// The merge never deletes from the account. Browser-only sets are added newest first while the list has room, in one
// batch write per list. No database is used; the stub models the primary key and the 500 limit trigger.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { handleMergeRequest, mergeBrowserLists, parseMergeBody, LIST_LIMIT, MERGE_BODY_MAX, MERGE_ITEMS_MAX } from '../src/lib/account-lists';

type Row = Record<string, any>;
type Tables = { account_sessions: Row[]; accounts: Row[]; saved_sets: Row[] };
const NOW = Date.parse('2026-10-30T00:00:00Z');
const FUTURE = '2026-11-30T00:00:00Z';
const hash = (t: string) => createHash('sha256').update(t).digest('hex');

function makeDb(tables: Tables, opts: { failTable?: string; failWrites?: boolean } = {}) {
  const writes: string[] = [];
  const from = (name: keyof Tables) => {
    const q: { op: 'select' | 'insert' | 'delete'; filters: [string, any][]; single: boolean; row?: any } = { op: 'select', filters: [], single: false };
    const run = (): { data: any; error: any } => {
      if (opts.failTable === name) return { data: null, error: { message: 'boom' } };
      if (opts.failWrites && q.op !== 'select' && name === 'saved_sets') return { data: null, error: { message: 'boom' } };
      const rows = tables[name];
      const match = (r: Row) => q.filters.every(([c, v]) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v));
      if (q.op === 'select') {
        const out = rows.filter(match);
        return { data: q.single ? out[0] ?? null : out, error: null };
      }
      writes.push(`${q.op}:${name}`);
      if (q.op === 'insert') {
        // A batch is all or nothing, like one statement: check every row first, then insert.
        const incoming: Row[] = Array.isArray(q.row) ? q.row : [q.row];
        if (name === 'saved_sets') {
          const keys = new Set<string>();
          for (const r of incoming) {
            const k = `${r.account_id}|${r.list}|${r.set_number}`;
            if (keys.has(k) || rows.some((x) => x.account_id === r.account_id && x.list === r.list && x.set_number === r.set_number)) {
              return { data: null, error: { code: '23505', message: 'duplicate key' } };
            }
            keys.add(k);
          }
          for (const r of incoming) {
            const count = rows.filter((x) => x.account_id === r.account_id && x.list === r.list).length;
            if (count >= LIST_LIMIT) return { data: null, error: { code: 'P0001', message: 'list is full' } };
          }
        }
        rows.push(...incoming.map((r) => ({ ...r })));
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
      insert: (row: any) => { q.op = 'insert'; q.row = row; return b; },
      delete: () => { q.op = 'delete'; return b; },
      then: (ok: (v: any) => any, bad?: (e: any) => any) => Promise.resolve().then(run).then(ok, bad),
    };
    return b;
  };
  return { db: { from } as any, writes };
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
  it('browser-only sets are written with their own added_at and copies', async () => {
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

describe('the merge never deletes from the account', () => {
  it('over the limit, every account row stays, and only what fits is added', async () => {
    const old = Array.from({ length: LIST_LIMIT - 1 }, (_, i) => acct(String(10000 + i), 1));
    const t = seed(old);
    const before = rowsOf(t, 'acct-A', 'wishlist').map((x) => x.set_number).sort();
    const { db, writes } = makeDb(t);
    const r = await mergeBrowserLists(db, 'acct-A', { wishlist: [browser('20001', 20), browser('20002', 21), browser('20003', 22)], collection: [] });
    expect(r.status).toBe('ok');
    const after = rowsOf(t, 'acct-A', 'wishlist').map((x) => x.set_number);
    expect(after).toEqual(expect.arrayContaining(before));
    expect(after).toHaveLength(LIST_LIMIT);
    expect(writes.some((w) => w.startsWith('delete'))).toBe(false);
    expect(r.dropped?.wishlist).toBe(2);
  });
});

describe('the 500 limit on the merge', () => {
  it('room is the space left: the newest browser set that fits is added first', async () => {
    const t = seed(Array.from({ length: LIST_LIMIT - 2 }, (_, i) => acct(String(10000 + i), 1)));
    const { db } = makeDb(t);
    const r = await mergeBrowserLists(db, 'acct-A', {
      wishlist: [browser('20001', 5), browser('20002', 9), browser('20003', 7)],
      collection: [],
    });
    const sets = rowsOf(t, 'acct-A', 'wishlist').map((x) => x.set_number);
    expect(sets).toContain('20002');
    expect(sets).toContain('20003');
    expect(sets).not.toContain('20001');
    expect(r.dropped?.wishlist).toBe(1);
  });

  it('a full account list adds none of the browser sets, and each one is counted', async () => {
    const t = seed(Array.from({ length: LIST_LIMIT }, (_, i) => acct(String(10000 + i), 20)));
    const { db } = makeDb(t);
    const r = await mergeBrowserLists(db, 'acct-A', { wishlist: [browser('20009', 1), browser('20010', 2)], collection: [] });
    expect(rowsOf(t, 'acct-A', 'wishlist')).toHaveLength(LIST_LIMIT);
    expect(r.dropped?.wishlist).toBe(2);
  });

  it('the limit is per list: a full wishlist does not block the collection', async () => {
    const t = seed(Array.from({ length: LIST_LIMIT }, (_, i) => acct(String(10000 + i), 20)));
    const { db } = makeDb(t);
    const r = await mergeBrowserLists(db, 'acct-A', { wishlist: [], collection: [browser('30001', 3, 1)] });
    expect(rowsOf(t, 'acct-A', 'collection').map((x) => x.set_number)).toEqual(['30001']);
    expect(r.dropped?.collection).toBe(0);
  });
});

describe('batching and what is read', () => {
  it('one batch write per list that has something to add', async () => {
    const t = seed();
    const { db, writes } = makeDb(t);
    await mergeBrowserLists(db, 'acct-A', { wishlist: [browser('90001', 1)], collection: [browser('90002', 2)] });
    expect(writes.filter((w) => w === 'insert:saved_sets')).toHaveLength(2);
  });

  it('nothing to add means no write at all', async () => {
    const t = seed([acct('90001', 1)]);
    const { db, writes } = makeDb(t);
    await mergeBrowserLists(db, 'acct-A', { wishlist: [browser('90001', 1)], collection: [] });
    expect(writes).toEqual([]);
  });

  it('at most 500 items are read from each browser list; the rest are ignored', async () => {
    const t = seed();
    const { db } = makeDb(t);
    const big = Array.from({ length: MERGE_ITEMS_MAX + 100 }, (_, i) => browser(String(10000 + i), 1));
    const r = await mergeBrowserLists(db, 'acct-A', { wishlist: big, collection: [] });
    expect(rowsOf(t, 'acct-A', 'wishlist')).toHaveLength(MERGE_ITEMS_MAX);
    expect(rowsOf(t, 'acct-A', 'wishlist').some((x) => x.set_number === String(10000 + MERGE_ITEMS_MAX))).toBe(false);
    expect(r.dropped?.wishlist).toBe(0);
  });

  it('a body over the size limit is refused before it is parsed', () => {
    const big = JSON.stringify({ wishlist: [], pad: 'x'.repeat(MERGE_BODY_MAX) });
    expect(big.length).toBeGreaterThan(MERGE_BODY_MAX);
    expect(parseMergeBody(big)).toBeNull();
  });

  it('a body that is not JSON is refused; a small JSON body is parsed', () => {
    expect(parseMergeBody('{not json')).toBeNull();
    expect(parseMergeBody('{"wishlist":[]}')).toEqual({ wishlist: [] });
  });
});

describe('signed out, failed reads and other accounts', () => {
  it('no session: signed-out and nothing is written', async () => {
    const t = seed();
    const { db, writes } = makeDb(t);
    const r = await handleMergeRequest(db, undefined, { wishlist: [browser('90001', 1)] }, NOW);
    expect(r.status).toBe('signed-out');
    expect(t.saved_sets).toHaveLength(0);
    expect(writes).toEqual([]);
  });

  it('a failed read writes nothing and answers unavailable', async () => {
    const t = seed();
    const { db } = makeDb(t, { failTable: 'saved_sets' });
    const r = await mergeBrowserLists(db, 'acct-A', { wishlist: [browser('90001', 1)], collection: [] });
    expect(r.status).toBe('unavailable');
    expect(t.saved_sets).toHaveLength(0);
  });

  it('a failed write answers unavailable, and the batch wrote nothing', async () => {
    const t = seed();
    const { db } = makeDb(t, { failWrites: true });
    const r = await mergeBrowserLists(db, 'acct-A', { wishlist: [browser('90001', 1)], collection: [] });
    expect(r.status).toBe('unavailable');
    expect(t.saved_sets).toHaveLength(0);
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

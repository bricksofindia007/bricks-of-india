// The names option on the account read (order 0290 item 1, 2h): the My Collection page gets each set's name and image.
// Stub database only. The stub models the sessions, the accounts, the saved sets and the sets table.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { handleListsRequest, readAccountLists } from '../src/lib/account-lists';

type Row = Record<string, any>;
type Tables = { account_sessions: Row[]; accounts: Row[]; saved_sets: Row[]; sets: Row[] };
const NOW = Date.parse('2026-10-30T00:00:00Z');
const FUTURE = '2026-11-30T00:00:00Z';
const hash = (t: string) => createHash('sha256').update(t).digest('hex');

function makeDb(tables: Tables, opts: { failTable?: string } = {}) {
  const reads: string[] = [];
  const from = (name: keyof Tables) => {
    const q: { filters: [string, any][]; ins: [string, any[]][]; single: boolean } = { filters: [], ins: [], single: false };
    const run = () => {
      if (opts.failTable === name) return { data: null, error: { message: 'boom' } };
      reads.push(name);
      const rows = tables[name];
      const match = (r: Row) => q.filters.every(([c, v]) => r[c] === v) && q.ins.every(([c, vs]) => vs.includes(r[c]));
      const out = rows.filter(match);
      return { data: q.single ? out[0] ?? null : out, error: null };
    };
    const b: any = {
      select: () => b,
      eq: (c: string, v: any) => { q.filters.push([c, v]); return b; },
      in: (c: string, vs: any[]) => { q.ins.push([c, vs]); return b; },
      is: () => b,
      maybeSingle: () => { q.single = true; return b; },
      then: (ok: (v: any) => any, bad?: (e: any) => any) => Promise.resolve().then(run).then(ok, bad),
    };
    return b;
  };
  return { db: { from } as any, reads };
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
      { account_id: 'acct-A', list: 'collection', set_number: '90002', qty: 2, added_at: '2026-10-21T10:00:00Z' },
      { account_id: 'acct-B', list: 'wishlist', set_number: '90009', qty: 1, added_at: '2026-10-22T10:00:00Z' },
    ],
    sets: [
      { set_number: '90001', name: 'Fixture Starship A', image_url: null, pieces: 1200, theme: 'Fixture Space', year: 2024 },
      { set_number: '90002', name: 'Fixture Castle B', image_url: null, pieces: 800, theme: 'Fixture Castle', year: 2023 },
      { set_number: '90009', name: 'Fixture Other C', image_url: null, pieces: 10, theme: 'Fixture', year: 2025 },
    ],
  };
}

describe('the names option', () => {
  it('each row gets its set name, image, pieces, theme and year', async () => {
    const { db } = makeDb(seed());
    const lists = await readAccountLists(db, 'acct-A', true);
    expect(lists.wishlist[0]).toMatchObject({ set: '90001', name: 'Fixture Starship A', pieces: 1200, theme: 'Fixture Space', year: 2024 });
    expect(lists.collection[0]).toMatchObject({ set: '90002', name: 'Fixture Castle B', qty: 2 });
  });

  it('without the option, the sets table is not read at all', async () => {
    const { db, reads } = makeDb(seed());
    const lists = await readAccountLists(db, 'acct-A', false);
    expect(reads).not.toContain('sets');
    expect(lists.wishlist[0].name).toBeUndefined();
  });

  it('a set missing from the sets table gets no name (never a guessed one)', async () => {
    const t = seed();
    t.saved_sets.push({ account_id: 'acct-A', list: 'wishlist', set_number: '99999', qty: 1, added_at: '2026-10-25T10:00:00Z' });
    const { db } = makeDb(t);
    const lists = await readAccountLists(db, 'acct-A', true);
    expect(lists.wishlist.find((i) => i.set === '99999')?.name).toBeNull();
  });

  it('a failed names read throws, so the caller answers unavailable and the page falls back', async () => {
    const { db } = makeDb(seed(), { failTable: 'sets' });
    await expect(readAccountLists(db, 'acct-A', true)).rejects.toThrow('names unreadable');
    const r = await handleListsRequest(db, 'token-A', { method: 'GET', names: true }, NOW);
    expect(r.status).toBe('unavailable');
    expect(r.lists).toBeUndefined();
  });

  it('with no session, names are not read: signed-out', async () => {
    const { db, reads } = makeDb(seed());
    const r = await handleListsRequest(db, undefined, { method: 'GET', names: true }, NOW);
    expect(r.status).toBe('signed-out');
    expect(reads).toEqual([]);
  });

  it("one account's names never include another account's rows", async () => {
    const { db } = makeDb(seed());
    const r = await handleListsRequest(db, 'token-A', { method: 'GET', names: true }, NOW);
    const all = [...(r.lists?.wishlist ?? []), ...(r.lists?.collection ?? [])].map((i) => i.set);
    expect(all.sort()).toEqual(['90001', '90002']);
    expect(all).not.toContain('90009');
  });
});

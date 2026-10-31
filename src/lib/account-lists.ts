// Account saved sets, read and write (P2 of the S5 plan, order 0230). Server only. Every function takes the database
// handle it is given, so tests run with a stub. The rows are always the signed-in account's own (account_id from the
// session, never from the request). Answers are neutral codes; no visitor text comes from here (R1, G19).
// Failure behaviour (G14): an unreadable session or list answers "unavailable"; nothing is guessed.
import type { createServerClient } from '@/lib/supabase';
import { accountForSession } from '@/lib/signin-store';
import { sessionTokenHash } from '@/lib/account-session';

type Db = ReturnType<typeof createServerClient>;

export const LIST_LIMIT = 500;
const SET_RE = /^[0-9]{3,7}(-[0-9]{1,2})?$/;

export type ListName = 'wishlist' | 'collection';
export const LISTS: readonly ListName[] = ['wishlist', 'collection'];
/** A saved set. The names fields come from the sets table only when the read asks for names (the My Collection page). */
export type ListRow = {
  set: string;
  qty: number;
  added_at: string;
  name?: string | null;
  image_url?: string | null;
  pieces?: number | null;
  theme?: string | null;
  year?: number | null;
};
export type Lists = Record<ListName, ListRow[]>;

export type ListStatus = 'ok' | 'limit' | 'invalid' | 'signed-out' | 'unavailable';
/** lists is set only by a successful read. */
export type ListResult = { status: ListStatus; lists?: Lists };

export function isListName(v: unknown): v is ListName {
  return typeof v === 'string' && (LISTS as readonly string[]).includes(v);
}

/**
 * The account's two lists. Throws when a read fails (the caller answers "unavailable"). With names, each row also gets
 * the set's name, image, pieces, theme and year from the sets table; a failed names read throws too, so the page falls
 * back to the browser lists rather than showing bare numbers.
 */
export async function readAccountLists(db: Db, accountId: string, withNames = false): Promise<Lists> {
  const { data, error } = await db
    .from('saved_sets')
    .select('list, set_number, qty, added_at')
    .eq('account_id', accountId);
  if (error) throw new Error('lists unreadable');
  const lists: Lists = { wishlist: [], collection: [] };
  for (const r of (data ?? []) as { list: string; set_number: string; qty: number; added_at: string }[]) {
    if (!isListName(r.list)) continue;
    lists[r.list].push({ set: r.set_number, qty: r.qty, added_at: r.added_at });
  }
  if (withNames) {
    const numbers = [...new Set([...lists.wishlist, ...lists.collection].map((i) => i.set))];
    if (numbers.length > 0) {
      const { data: sets, error: sErr } = await db
        .from('sets')
        .select('set_number, name, image_url, pieces, theme, year')
        .in('set_number', numbers);
      if (sErr) throw new Error('names unreadable');
      const byNumber = new Map(((sets ?? []) as { set_number: string; name: string; image_url: string | null; pieces: number | null; theme: string | null; year: number | null }[]).map((s) => [s.set_number, s]));
      for (const list of LISTS) {
        for (const row of lists[list]) {
          const s = byNumber.get(row.set);
          row.name = s?.name ?? null;
          row.image_url = s?.image_url ?? null;
          row.pieces = s?.pieces ?? null;
          row.theme = s?.theme ?? null;
          row.year = s?.year ?? null;
        }
      }
    }
  }
  lists.wishlist.sort((a, b) => (a.added_at < b.added_at ? 1 : -1));
  lists.collection.sort((a, b) => (a.added_at < b.added_at ? 1 : -1));
  return lists;
}

/**
 * Adds a set to one of the account's lists. A set already on the list is a no-op (ok). A full list answers "limit".
 * The 500 limit is also enforced by the database trigger (held migration 20261024230000); this check maps its refusal.
 */
export async function addAccountSet(db: Db, accountId: string, list: ListName, setNumber: string, qty: number, addedAt: string): Promise<ListResult> {
  if (!SET_RE.test(setNumber)) return { status: 'invalid' };
  const existing = await db
    .from('saved_sets')
    .select('set_number')
    .eq('account_id', accountId)
    .eq('list', list)
    .eq('set_number', setNumber)
    .maybeSingle();
  if (existing.error) return { status: 'unavailable' };
  if (existing.data) return { status: 'ok' };
  const { error } = await db.from('saved_sets').insert({
    account_id: accountId,
    list,
    set_number: setNumber,
    qty: list === 'collection' ? Math.max(1, Math.min(999, qty)) : 1,
    added_at: addedAt,
  });
  if (!error) return { status: 'ok' };
  if (error.code === 'P0001' || /list is full/.test(error.message ?? '')) return { status: 'limit' };
  return { status: 'unavailable' };
}

/** Removes a set from one of the account's lists. Removing a set that is not there is ok. */
export async function removeAccountSet(db: Db, accountId: string, list: ListName, setNumber: string): Promise<ListResult> {
  if (!SET_RE.test(setNumber)) return { status: 'invalid' };
  const { error } = await db
    .from('saved_sets')
    .delete()
    .eq('account_id', accountId)
    .eq('list', list)
    .eq('set_number', setNumber);
  return error ? { status: 'unavailable' } : { status: 'ok' };
}

export type ListsRequest =
  | { method: 'GET'; names?: boolean }
  | { method: 'POST'; list: unknown; set: unknown; qty?: unknown }
  | { method: 'DELETE'; list: unknown; set: unknown };

/**
 * The whole decision for one request, given the session cookie value. No cookie or a dead session is "signed-out"
 * and reads nothing. The account id comes only from the session.
 */
export async function handleListsRequest(
  db: Db,
  token: string | undefined,
  req: ListsRequest,
  now: number,
): Promise<ListResult> {
  if (!token) return { status: 'signed-out' };
  let account: { id: string } | null;
  try {
    account = await accountForSession(db, sessionTokenHash(token), now);
  } catch {
    return { status: 'unavailable' };
  }
  if (!account) return { status: 'signed-out' };

  if (req.method === 'GET') {
    try {
      return { status: 'ok', lists: await readAccountLists(db, account.id, req.names === true) };
    } catch {
      return { status: 'unavailable' };
    }
  }
  if (!isListName(req.list) || typeof req.set !== 'string') return { status: 'invalid' };
  if (req.method === 'POST') {
    const qty = typeof req.qty === 'number' && Number.isInteger(req.qty) ? req.qty : 1;
    return addAccountSet(db, account.id, req.list, req.set, qty, new Date(now).toISOString());
  }
  return removeAccountSet(db, account.id, req.list, req.set);
}

// ---- P3: first sign-in merge (order 0210 item 2 rule, in account-merge.ts) ----

export type BrowserItem = { set: string; added_at: string; qty?: number };
export type BrowserLists = Record<ListName, BrowserItem[]>;
export type MergeResult = { status: ListStatus; dropped?: Record<ListName, number> };

const isBrowserItem = (v: unknown): v is BrowserItem =>
  !!v && typeof v === 'object' && typeof (v as BrowserItem).set === 'string' && SET_RE.test((v as BrowserItem).set)
  && typeof (v as BrowserItem).added_at === 'string' && Number.isFinite(Date.parse((v as BrowserItem).added_at));

/** A merge body larger than this (in characters) is refused before it is read. */
export const MERGE_BODY_MAX = 60_000;
/** At most this many items are read from each browser list; the rest are ignored. */
export const MERGE_ITEMS_MAX = 500;

/** The body as text to a value, or null when it is too big or not JSON. */
export function parseMergeBody(text: string): unknown | null {
  if (text.length > MERGE_BODY_MAX) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const cleanQty = (q: unknown): number => (typeof q === 'number' && Number.isInteger(q) && q >= 1 && q <= 999 ? q : 1);

/**
 * Joins the browser lists to the account's lists, once, on first sign-in (order 0280 decision 1).
 * Never deletes from the account: the account copy is the record. Browser-only sets are added newest first, and only
 * while the list has room under the limit; the rest are not added and only counted. One batch write per list.
 * Running it again adds nothing new (idempotent). A failed read or write answers unavailable.
 */
export async function mergeBrowserLists(db: Db, accountId: string, browser: BrowserLists): Promise<MergeResult> {
  let account: Lists;
  try {
    account = await readAccountLists(db, accountId);
  } catch {
    return { status: 'unavailable' };
  }
  const dropped: Record<ListName, number> = { wishlist: 0, collection: 0 };
  for (const list of LISTS) {
    const onAccount = new Set(account[list].map((i) => i.set));
    let room = LIST_LIMIT - account[list].length;
    const seen = new Map<string, BrowserItem>();
    const sent = Array.isArray(browser[list]) ? browser[list].slice(0, MERGE_ITEMS_MAX) : [];
    for (const item of sent) {
      if (!isBrowserItem(item) || seen.has(item.set) || onAccount.has(item.set)) continue;
      seen.set(item.set, item);
    }
    const candidates = [...seen.values()].sort((a, b) => {
      if (a.added_at !== b.added_at) return a.added_at < b.added_at ? 1 : -1;
      return a.set < b.set ? -1 : a.set > b.set ? 1 : 0;
    });
    const rows: BrowserItem[] = [];
    for (const item of candidates) {
      if (room > 0) {
        rows.push(item);
        room -= 1;
      } else {
        dropped[list] += 1;
      }
    }
    if (rows.length === 0) continue;
    const { error } = await db.from('saved_sets').insert(
      rows.map((i) => ({
        account_id: accountId,
        list,
        set_number: i.set,
        qty: list === 'collection' ? cleanQty(i.qty) : 1,
        added_at: i.added_at,
      })),
    );
    if (error) return { status: 'unavailable' };
  }
  return { status: 'ok', dropped };
}

/** The merge request: signed-in only. The account comes from the session; the body is the browser's two lists. */
export async function handleMergeRequest(db: Db, token: string | undefined, body: unknown, now: number): Promise<MergeResult> {
  if (!token) return { status: 'signed-out' };
  let account: { id: string } | null;
  try {
    account = await accountForSession(db, sessionTokenHash(token), now);
  } catch {
    return { status: 'unavailable' };
  }
  if (!account) return { status: 'signed-out' };
  const b = (body ?? {}) as Partial<Record<ListName, unknown>>;
  const browser: BrowserLists = {
    wishlist: Array.isArray(b.wishlist) ? (b.wishlist as BrowserItem[]) : [],
    collection: Array.isArray(b.collection) ? (b.collection as BrowserItem[]) : [],
  };
  return mergeBrowserLists(db, account.id, browser);
}

// ---- P4: sign-out. Ends this session only. Saved sets and the browser lists are not touched. ----

/**
 * Revokes the session behind the cookie. No cookie: nothing to end, ok. A failed revoke answers unavailable, so the
 * caller keeps the cookie (the session is still live, and the answer must not claim a sign-out).
 */
export async function handleSignOut(db: Db, token: string | undefined, now: number): Promise<{ status: 'ok' | 'unavailable' }> {
  if (!token) return { status: 'ok' };
  const { error } = await db
    .from('account_sessions')
    .update({ revoked_at: new Date(now).toISOString() })
    .eq('token_hash', sessionTokenHash(token));
  return error ? { status: 'unavailable' } : { status: 'ok' };
}

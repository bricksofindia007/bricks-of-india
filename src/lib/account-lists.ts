// Account saved sets, read and write (P2 of the S5 plan, order 0230). Server only. Every function takes the database
// handle it is given, so tests run with a stub. The rows are always the signed-in account's own (account_id from the
// session, never from the request). Answers are neutral codes; no visitor text comes from here (R1, G19).
// Failure behaviour (G14): an unreadable session or list answers "unavailable"; nothing is guessed.
import type { createServerClient } from '@/lib/supabase';
import { accountForSession } from '@/lib/signin-store';
import { sessionTokenHash } from '@/lib/account-session';
import { mergeOnSignIn } from '@/lib/account-merge';

type Db = ReturnType<typeof createServerClient>;

export const LIST_LIMIT = 500;
const SET_RE = /^[0-9]{3,7}(-[0-9]{1,2})?$/;

export type ListName = 'wishlist' | 'collection';
export const LISTS: readonly ListName[] = ['wishlist', 'collection'];
export type ListRow = { set: string; qty: number; added_at: string };
export type Lists = Record<ListName, ListRow[]>;

export type ListStatus = 'ok' | 'limit' | 'invalid' | 'signed-out' | 'unavailable';
/** lists is set only by a successful read. */
export type ListResult = { status: ListStatus; lists?: Lists };

export function isListName(v: unknown): v is ListName {
  return typeof v === 'string' && (LISTS as readonly string[]).includes(v);
}

/** The account's two lists. Throws when the read fails (the caller answers "unavailable"). */
export async function readAccountLists(db: Db, accountId: string): Promise<Lists> {
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
  | { method: 'GET' }
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
      return { status: 'ok', lists: await readAccountLists(db, account.id) };
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

/**
 * Joins the browser lists to the account's lists once, on first sign-in. Only browser-only sets are written, and only
 * those that survive the limit (newest kept). Running it again adds nothing new (idempotent). Nothing is written on a
 * failed read, and the browser lists are not changed here.
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
    const seen = new Set<string>();
    const incoming: BrowserItem[] = [];
    for (const item of Array.isArray(browser[list]) ? browser[list] : []) {
      if (!isBrowserItem(item) || seen.has(item.set)) continue;
      seen.add(item.set);
      incoming.push(item);
    }
    const onAccount = new Set(account[list].map((i) => i.set));
    const merged = mergeOnSignIn(
      account[list].map((i) => ({ set: i.set, added_at: i.added_at })),
      incoming.map((i) => ({ set: i.set, added_at: i.added_at })),
    );
    dropped[list] = merged.dropped;
    // Over the limit the newest are kept, so the account's own older rows outside that set are removed first (the
    // rule drops them). Removing first keeps the list under the database limit for the writes that follow.
    const kept = new Set(merged.list.map((r) => r.set));
    for (const a of account[list]) {
      if (kept.has(a.set)) continue;
      const r = await removeAccountSet(db, accountId, list, a.set);
      if (r.status === 'unavailable') return { status: 'unavailable' };
    }
    const byBrowser = new Map(incoming.map((i) => [i.set, i]));
    for (const row of merged.list) {
      if (onAccount.has(row.set)) continue;
      const src = byBrowser.get(row.set);
      if (!src) continue;
      const r = await addAccountSet(db, accountId, list, row.set, src.qty ?? 1, src.added_at);
      if (r.status === 'unavailable') return { status: 'unavailable' };
      if (r.status === 'limit') dropped[list] += 1;
    }
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

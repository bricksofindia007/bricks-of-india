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
export async function addAccountSet(db: Db, accountId: string, list: ListName, setNumber: string, qty: number, now: number): Promise<ListResult> {
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
    added_at: new Date(now).toISOString(),
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
    return addAccountSet(db, account.id, req.list, req.set, qty, now);
  }
  return removeAccountSet(db, account.id, req.list, req.set);
}

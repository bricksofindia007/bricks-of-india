'use client';

// One account read per page view, shared by the hearts and lists on the page (order 0280 decision 3). It asks the
// lists route once (with names when the page asks for them). While accounts are off (enabled false) it asks nothing:
// every visitor is then treated as a guest. A failed read is "unavailable", never "signed in" and never "signed out".
// Saves made on the page are applied to the shared lists at once, so nothing else is asked. Nothing is stored in the browser.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ListName, ListRow, Lists } from '@/lib/account-lists';

export type SessionStatus = 'unknown' | 'signed-in' | 'signed-out' | 'unavailable';

/** 200 is signed in; 401 and 404 are signed out (404 = accounts off); anything else is unavailable. */
export function sessionStatusFromHttp(code: number): SessionStatus {
  if (code === 200) return 'signed-in';
  if (code === 401 || code === 404) return 'signed-out';
  return 'unavailable';
}

/** The lists after one successful save (or removal) of a set. Pure. */
export function applyLocalChange(lists: Lists, list: ListName, set: string, row: ListRow | null): Lists {
  const rest = lists[list].filter((i) => i.set !== set);
  return { ...lists, [list]: row ? [row, ...rest] : rest };
}

export type AccountLists = {
  status: SessionStatus;
  lists: Lists | null;
  changeLocal: (list: ListName, set: string, row: ListRow | null) => void;
};

const AccountContext = createContext<AccountLists | null>(null);

export function AccountSessionProvider({ enabled, withNames = false, children }: { enabled: boolean; withNames?: boolean; children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>(enabled ? 'unknown' : 'signed-out');
  const [lists, setLists] = useState<Lists | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus('signed-out');
      setLists(null);
      return;
    }
    let live = true;
    fetch(`/api/account/lists${withNames ? '?names=1' : ''}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!live) return;
        const s = sessionStatusFromHttp(r.status);
        if (s !== 'signed-in') {
          setStatus(s);
          setLists(null);
          return;
        }
        const j = (await r.json().catch(() => null)) as { lists?: Lists } | null;
        if (!live) return;
        if (j?.lists) {
          setStatus('signed-in');
          setLists(j.lists);
        } else {
          setStatus('unavailable');
          setLists(null);
        }
      })
      .catch(() => {
        if (live) {
          setStatus('unavailable');
          setLists(null);
        }
      });
    return () => { live = false; };
  }, [enabled, withNames]);

  const changeLocal = useCallback(
    (list: ListName, set: string, row: ListRow | null) => setLists((prev) => (prev ? applyLocalChange(prev, list, set, row) : prev)),
    [],
  );
  const value = useMemo<AccountLists>(() => ({ status, lists, changeLocal }), [status, lists, changeLocal]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

/** The session status and the shared lists. null on a page with no provider (the caller keeps the browser path). */
export function useAccountLists(): AccountLists | null {
  return useContext(AccountContext);
}

/** The session status. 'unknown' on a page with no provider, and nothing guest-only is shown. */
export function useAccountSession(): SessionStatus {
  return useContext(AccountContext)?.status ?? 'unknown';
}

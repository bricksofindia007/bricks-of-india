'use client';

// One account read per page view, shared by the hearts and lists on the page (order 0280 decision 3). It asks the
// lists route once. While accounts are off (enabled false) it asks nothing: every visitor is then treated as a guest.
// A failed read is "unavailable", never "signed in" and never "signed out" (no false claim). Nothing is stored.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type SessionStatus = 'unknown' | 'signed-in' | 'signed-out' | 'unavailable';

/** 200 is signed in; 401 and 404 are signed out (404 = accounts off); anything else is unavailable. */
export function sessionStatusFromHttp(code: number): SessionStatus {
  if (code === 200) return 'signed-in';
  if (code === 401 || code === 404) return 'signed-out';
  return 'unavailable';
}

const SessionContext = createContext<SessionStatus>('unknown');

export function AccountSessionProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>(enabled ? 'unknown' : 'signed-out');
  useEffect(() => {
    if (!enabled) {
      setStatus('signed-out');
      return;
    }
    let live = true;
    fetch('/api/account/lists', { cache: 'no-store' })
      .then((r) => { if (live) setStatus(sessionStatusFromHttp(r.status)); })
      .catch(() => { if (live) setStatus('unavailable'); });
    return () => { live = false; };
  }, [enabled]);
  return <SessionContext.Provider value={status}>{children}</SessionContext.Provider>;
}

/** The session state for this page. Without a provider it is 'unknown', and nothing guest-only is shown. */
export function useAccountSession(): SessionStatus {
  return useContext(SessionContext);
}

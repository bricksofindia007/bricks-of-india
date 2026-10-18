'use client';

import type { ReactNode } from 'react';
import { useActionState } from 'react';
import { logoutEverywhere, type LogoutEverywhereState } from './actions';

// Ends every admin session. The page passes the signed field as children (a hidden input for this action).
// A failure is shown on the page; it is never reported as a sign-out.
export function LogoutEverywhereButton({ children }: { children?: ReactNode }) {
  const [state, action, pending] = useActionState<LogoutEverywhereState, FormData>(logoutEverywhere, null);
  return (
    <form action={action} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
      {children}
      <button
        type="submit"
        disabled={pending}
        style={{ padding: '6px 14px', background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, fontSize: 12, cursor: pending ? 'wait' : 'pointer', fontFamily: 'inherit' }}
      >
        Log out everywhere
      </button>
      {state?.error && (
        <span role="alert" style={{ fontSize: 12, color: '#FCA5A5' }}>
          {state.error}
        </span>
      )}
    </form>
  );
}

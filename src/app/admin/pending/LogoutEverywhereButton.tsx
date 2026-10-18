'use client';

import type { ReactNode } from 'react';
import { useActionState } from 'react';
import { logoutEverywhere, type LogoutEverywhereState } from './actions';
import { LogoutEverywhereView } from './LogoutEverywhereView';

// Ends every admin session. The page passes the signed field as children (a hidden input for this action).
// A failure is shown on the page; it is never reported as a sign-out.
export function LogoutEverywhereButton({ children }: { children?: ReactNode }) {
  const [state, action, pending] = useActionState<LogoutEverywhereState, FormData>(logoutEverywhere, null);
  return (
    <LogoutEverywhereView action={action} state={state} pending={pending}>
      {children}
    </LogoutEverywhereView>
  );
}

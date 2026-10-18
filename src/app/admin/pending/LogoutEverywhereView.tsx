import type { ReactNode } from 'react';

// Presentational form for "Log out everywhere". The state comes in as a prop, so the text an admin reads (the
// error, when the sessions could not be ended) can be tested on the server. The client button passes its state here.
export function LogoutEverywhereView({
  action,
  state,
  pending = false,
  children,
}: {
  action: (formData: FormData) => void;
  state: { error: string } | null;
  pending?: boolean;
  children?: ReactNode;
}) {
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

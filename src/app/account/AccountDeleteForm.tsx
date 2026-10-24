'use client';

// Delete my account: asks for a code to the account's own address, then deletes on the right code. Button and heading
// words come from the approved deletion text. Other labels are neutral placeholders until the owner names words (issue 787).
// Nothing is stored in the browser. Failure behaviour: a failed request shows the server's line, and nothing is deleted.
import { useState } from 'react';

type Step = 'start' | 'code' | 'done';

async function post(path: string, payload?: unknown): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  return (await res.json().catch(() => ({ ok: false, message: 'Something went wrong. Try again.' }))) as { ok: boolean; message?: string };
}

export function AccountDeleteForm() {
  const [step, setStep] = useState<Step>('start');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onStart() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await post('/account/delete/request');
      setMessage(r.message ?? null);
      if (r.ok) setStep('code');
    } catch {
      setMessage('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await post('/account/delete/confirm', { code });
      if (r.ok) setStep('done');
      else setMessage(r.message ?? null);
    } catch {
      setMessage('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'done') return <p role="status">{message ?? 'Your account has been deleted.'}</p>;

  return step === 'start' ? (
    <div className="space-y-4">
      <button type="button" onClick={onStart} disabled={busy} className="rounded-full border px-4 py-2 text-sm font-semibold">
        Delete my account
      </button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </div>
  ) : (
    <form onSubmit={(e) => { e.preventDefault(); onConfirm(); }} className="space-y-4">
      <label className="block">
        <span className="block text-sm">Code</span>
        <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <button type="submit" disabled={busy} className="rounded-full border px-4 py-2 text-sm font-semibold">Confirm</button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
  );
}

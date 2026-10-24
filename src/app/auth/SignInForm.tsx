'use client';

// Sign-in form: email, the 18+ box for a new address, then the six-digit code. Labels are neutral placeholders until the
// owner names words. Nothing is stored in the browser. Failure behaviour: any failed request shows the server's line.
import { useState, type FormEvent } from 'react';
import { AGE_RULE_COPY } from '@/lib/legal-copy';

type Step = 'email' | 'code' | 'done';

export function SignInForm() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(path: string, payload: unknown): Promise<{ ok: boolean; message?: string }> {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return (await res.json().catch(() => ({ ok: false, message: 'Something went wrong. Try again.' }))) as { ok: boolean; message?: string };
  }

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const r = await post('/auth/code', { email, ageConfirmed });
      setMessage(r.message ?? null);
      if (r.ok) setStep('code');
    } catch {
      setMessage('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const r = await post('/auth/verify', { email, code });
      if (r.ok) setStep('done');
      else setMessage(r.message ?? null);
    } catch {
      setMessage('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'done') return <p role="status">Signed in.</p>;

  return step === 'email' ? (
    <form onSubmit={onEmail} className="space-y-4">
      <label className="block">
        <span className="block text-sm">Email</span>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ageConfirmed} onChange={(e) => setAgeConfirmed(e.target.checked)} />
        {AGE_RULE_COPY.signUpCheckbox}
      </label>
      <button type="submit" disabled={busy} className="rounded-full border px-4 py-2 text-sm font-semibold">Send code</button>
      <a href={`/auth/google/start?age=${ageConfirmed ? 1 : 0}`} className="block text-sm underline">Continue with Google</a>
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
  ) : (
    <form onSubmit={onCode} className="space-y-4">
      <label className="block">
        <span className="block text-sm">Code</span>
        <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <button type="submit" disabled={busy} className="rounded-full border px-4 py-2 text-sm font-semibold">Sign in</button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
  );
}

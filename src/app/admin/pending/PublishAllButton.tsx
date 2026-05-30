'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { publishAll } from './actions';

interface Props {
  count: number;
}

export function PublishAllButton({ count }: Props) {
  const [state,  setState]  = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ published: number; failed: number } | null>(null);
  const router = useRouter();

  async function handleClick() {
    if (state !== 'idle') return;
    setState('loading');
    try {
      const res = await publishAll();
      setResult({ published: res.published, failed: res.failed });
      setState('done');
      if (res.published > 0) router.refresh();
    } catch {
      setState('error');
    }
  }

  if (count === 0) return null;

  if (state === 'done' && result) {
    return (
      <span style={{ fontSize: 13, fontWeight: 700, color: result.published > 0 ? '#16A34A' : '#6B7280' }}>
        {result.published > 0 ? `✓ ${result.published} published` : 'Nothing passed lint'}
        {result.failed > 0 && <span style={{ color: '#DC2626' }}> · {result.failed} failed</span>}
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>
        ✗ Batch publish failed — check logs
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      style={{
        padding: '7px 16px', background: '#006CB7', color: '#fff',
        border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
        cursor: state === 'loading' ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', opacity: state === 'loading' ? 0.6 : 1,
      }}
    >
      {state === 'loading' ? 'Publishing…' : `↑ Publish All (${count} ready)`}
    </button>
  );
}

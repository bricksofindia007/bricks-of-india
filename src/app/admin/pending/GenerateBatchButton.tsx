'use client';

import { useState } from 'react';
import { triggerBatchGeneration } from './actions';

interface Props {
  count: number;
}

export function GenerateBatchButton({ count }: Props) {
  const [state,    setState]    = useState<'idle' | 'loading' | 'started' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleClick() {
    if (state !== 'idle') return;
    setState('loading');
    const result = await triggerBatchGeneration();
    if (result.ok) {
      setState('started');
    } else {
      setErrorMsg(result.error ?? 'Unknown error');
      setState('error');
    }
  }

  if (count === 0) return null;

  if (state === 'started') {
    return (
      <span style={{ fontSize: 13, color: '#16A34A', fontWeight: 700 }}>
        ✓ Generation started — check back in ~40 minutes
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span style={{ fontSize: 13, color: '#DC2626' }} title={errorMsg}>
        ✗ Dispatch failed — check GH_DISPATCH_TOKEN
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      style={{
        padding: '7px 16px', background: '#F7A800', color: '#0F2D6B',
        border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
        cursor: state === 'loading' ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', opacity: state === 'loading' ? 0.6 : 1,
      }}
    >
      {state === 'loading' ? '…' : `✦ Generate All (${count} approved)`}
    </button>
  );
}

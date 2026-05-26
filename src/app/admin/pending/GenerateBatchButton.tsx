'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { generateOneForBatch } from './actions';

const DELAY_MS = 7000; // Gemini free tier: 10 RPM

interface Props {
  draftIds: string[];
}

export function GenerateBatchButton({ draftIds }: Props) {
  const router = useRouter();
  const [phase, setPhase]     = useState<'idle' | 'running' | 'done'>('idle');
  const [done, setDone]       = useState(0);
  const [okCount, setOkCount] = useState(0);
  const [failMsgs, setFailMsgs] = useState<string[]>([]);
  const total = draftIds.length;

  const run = useCallback(async () => {
    if (phase !== 'idle' || total === 0) return;
    setPhase('running');
    setDone(0); setOkCount(0); setFailMsgs([]);

    let ok = 0;
    const errs: string[] = [];

    for (let i = 0; i < draftIds.length; i++) {
      if (i > 0) await new Promise<void>(r => setTimeout(r, DELAY_MS));
      const result = await generateOneForBatch(draftIds[i]);
      if (result.ok) {
        ok++;
        setOkCount(ok);
      } else {
        errs.push(result.error);
        setFailMsgs([...errs]);
      }
      setDone(i + 1);
    }

    setPhase('done');
    router.refresh();
  }, [draftIds, phase, router, total]);

  if (total === 0) return null;

  if (phase === 'idle') {
    return (
      <button
        onClick={run}
        style={{ padding: '7px 16px', background: '#F7A800', color: '#0F2D6B', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        ✦ Generate All ({total})
      </button>
    );
  }

  if (phase === 'running') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: '#6B7280' }}>
          ✦ Generating {done}/{total}…
        </span>
        {failMsgs.length > 0 && (
          <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>
            {failMsgs.length} failed
          </span>
        )}
      </div>
    );
  }

  // done
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 13, color: '#16A34A', fontWeight: 700 }}>
        ✓ {okCount}/{total} generated
      </span>
      {failMsgs.length > 0 && (
        <span title={failMsgs.join('\n')} style={{ fontSize: 12, color: '#DC2626', fontWeight: 600, cursor: 'help', textDecoration: 'underline dotted' }}>
          {failMsgs.length} failed (hover)
        </span>
      )}
    </div>
  );
}

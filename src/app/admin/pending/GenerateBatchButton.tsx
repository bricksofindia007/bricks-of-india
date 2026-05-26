'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { generateOneForBatch } from './actions';

const INTER_CALL_MS  = 7000;  // Gemini free tier: 10 RPM
const RETRY_WAIT_MS  = 30000; // wait before 503 retry pass
const SUMMARY_SHOW_S = 30;    // seconds to display summary before page refresh

function is503(error: string): boolean {
  return error.includes('503');
}

type Phase = 'idle' | 'running' | 'waiting-retry' | 'retrying' | 'done';

interface Props {
  draftIds: string[];
}

export function GenerateBatchButton({ draftIds }: Props) {
  const router = useRouter();
  const total  = draftIds.length;

  const [phase,         setPhase]         = useState<Phase>('idle');
  const [done,          setDone]          = useState(0);
  const [okCount,       setOkCount]       = useState(0);
  const [retryQueued,   setRetryQueued]   = useState(0);  // 503s pending retry
  const [retryProgress, setRetryProgress] = useState({ done: 0, total: 0 });
  const [failMsgs,      setFailMsgs]      = useState<string[]>([]);  // permanent only
  const [refreshIn,     setRefreshIn]     = useState<number | null>(null);

  // Countdown + auto-refresh after done
  useEffect(() => {
    if (phase !== 'done') return;
    setRefreshIn(SUMMARY_SHOW_S);
    const tick = setInterval(() => {
      setRefreshIn(prev => {
        if (prev === null || prev <= 1) { clearInterval(tick); router.refresh(); return null; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [phase, router]);

  const run = useCallback(async () => {
    if (phase !== 'idle' || total === 0) return;
    setPhase('running');
    setDone(0); setOkCount(0); setRetryQueued(0); setRetryProgress({ done: 0, total: 0 }); setFailMsgs([]);

    let ok = 0;
    const permFails: string[] = [];
    const toRetry:   string[] = [];

    // ── Initial pass ──────────────────────────────────────────────────────────
    for (let i = 0; i < draftIds.length; i++) {
      if (i > 0) await new Promise<void>(r => setTimeout(r, INTER_CALL_MS));
      const result = await generateOneForBatch(draftIds[i]);
      if (result.ok) {
        ok++;
        setOkCount(ok);
      } else if (is503(result.error)) {
        toRetry.push(draftIds[i]);
        setRetryQueued(toRetry.length);
      } else {
        permFails.push(result.error);
        setFailMsgs([...permFails]);
      }
      setDone(i + 1);
    }

    // ── 503 retry pass (once, 30s delay before first call) ────────────────────
    if (toRetry.length > 0) {
      setPhase('waiting-retry');
      await new Promise<void>(r => setTimeout(r, RETRY_WAIT_MS));
      setPhase('retrying');
      setRetryProgress({ done: 0, total: toRetry.length });

      for (let i = 0; i < toRetry.length; i++) {
        if (i > 0) await new Promise<void>(r => setTimeout(r, INTER_CALL_MS));
        const result = await generateOneForBatch(toRetry[i]);
        if (result.ok) {
          ok++;
          setOkCount(ok);
        } else {
          // 503 twice = permanently failed
          permFails.push(result.error);
          setFailMsgs([...permFails]);
        }
        setRetryProgress({ done: i + 1, total: toRetry.length });
      }
    }

    setPhase('done');
  }, [draftIds, phase, total]);

  if (total === 0) return null;

  // ── Idle ──────────────────────────────────────────────────────────────────
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

  // ── Running (initial pass) ─────────────────────────────────────────────────
  if (phase === 'running') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: '#6B7280' }}>
          ✦ Generating {done}/{total}…
        </span>
        {retryQueued > 0 && (
          <span style={{ fontSize: 12, color: '#92400E' }}>{retryQueued} to retry</span>
        )}
        {failMsgs.length > 0 && (
          <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>{failMsgs.length} failed</span>
        )}
      </div>
    );
  }

  // ── Waiting before retry ───────────────────────────────────────────────────
  if (phase === 'waiting-retry') {
    return (
      <span style={{ fontSize: 13, color: '#92400E' }}>
        Pausing 30s before retrying {retryQueued} 503{retryQueued !== 1 ? 's' : ''}…
      </span>
    );
  }

  // ── Retry pass ─────────────────────────────────────────────────────────────
  if (phase === 'retrying') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: '#92400E' }}>
          ↺ Retrying {retryProgress.done}/{retryProgress.total}…
        </span>
        {failMsgs.length > 0 && (
          <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>{failMsgs.length} failed</span>
        )}
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 13, color: '#16A34A', fontWeight: 700 }}>
        ✓ {okCount}/{total} generated
      </span>
      {failMsgs.length > 0 && (
        <span
          title={failMsgs.join('\n')}
          style={{ fontSize: 12, color: '#DC2626', fontWeight: 600, cursor: 'help', textDecoration: 'underline dotted' }}
        >
          {failMsgs.length} failed (hover)
        </span>
      )}
      {refreshIn !== null && (
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>refreshing in {refreshIn}s</span>
      )}
    </div>
  );
}

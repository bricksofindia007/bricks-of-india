'use client';
import { useEffect } from 'react';
import { trackKeyEvent } from '@/lib/key-events';

// Fires the standee key event once and records the visit. Failures are silent: the page works without them.
export function StandeeLanding({ tag }: { tag: string }) {
  useEffect(() => {
    trackKeyEvent('standee_visit', { page_type: 'home', source: tag });
    fetch('/api/standee-visit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tag }),
      keepalive: true,
    }).catch(() => undefined);
  }, [tag]);
  return null;
}

'use client';

import { useEffect, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { VOICE, CHANGED_EVENT } from '@/lib/my-collection';
import { loadFigures, saveFigures, addFigure, removeFigure } from '@/lib/cmf-figures';

// Save heart for one collectible minifigure, by figure id, in this browser only. Shares the store with My Collection.
export function FigureHeart({ figureId, name }: { figureId: string; name: string }) {
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setSaved(loadFigures().some((f) => f.id === figureId.toLowerCase()));
    sync();
    window.addEventListener(CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(CHANGED_EVENT, sync); window.removeEventListener('storage', sync); };
  }, [figureId]);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const list = loadFigures();
    if (list.some((f) => f.id === figureId.toLowerCase())) {
      if (saveFigures(removeFigure(list, figureId))) {
        trackEvent('heart_remove', { page_type: 'cmf_tracker' });
        setNote(VOICE.heartRemoved);
      }
      return;
    }
    const r = addFigure(list, figureId, new Date().toISOString());
    if (r.status === 'limit') return setNote(VOICE.limitReached);
    if (r.status === 'added' && saveFigures(r.list)) {
      trackEvent('heart_add', { page_type: 'cmf_tracker' });
      setNote(VOICE.heartAdded);
    }
  };

  return (
    <span style={{ position: 'absolute', top: 4, right: 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${name} from your saved figures` : `Save ${name} to your saved figures`}
        style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.92)', color: saved ? '#DC2626' : '#9AA5B4', cursor: 'pointer', lineHeight: 1 }}
      >
        <span aria-hidden="true">{saved ? '♥' : '♡'}</span>
      </button>
      {note && <span role="status" style={{ fontSize: '0.6rem', background: '#fff', padding: '2px 4px', borderRadius: 4, marginTop: 2 }}>{note}</span>}
    </span>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CHANGED_EVENT } from '@/lib/my-collection';
import { loadFigures, saveFigures, removeFigure, readFigures, type FigureRef, type FigureRow, type FigureReader } from '@/lib/cmf-figures';

// Saved collectible minifigures (CMF). Names, series and images only: there is no price column, so no price is shown.
export function FiguresList() {
  const [refs, setRefs] = useState<FigureRef[]>([]);
  const [rows, setRows] = useState<FigureRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => setRefs(loadFigures());
    load();
    window.addEventListener(CHANGED_EVENT, load);
    window.addEventListener('storage', load);
    return () => { window.removeEventListener(CHANGED_EVENT, load); window.removeEventListener('storage', load); };
  }, []);

  // One batched read per page view, through the anonymous client (the table allows public reads).
  const ids = refs.map((r) => r.id).join(',');
  useEffect(() => {
    let live = true;
    if (!ids) { setRows([]); setLoading(false); return; }
    if (!supabase) { setRows(null); setLoading(false); return; }
    setLoading(true);
    readFigures(supabase as unknown as FigureReader, ids.split(',')).then((r) => {
      if (live) { setRows(r); setLoading(false); }
    });
    return () => { live = false; };
  }, [ids]);

  const remove = (id: string) => saveFigures(removeFigure(refs, id));

  if (loading) {
    return <p aria-hidden="true" className="h-4 w-40 bg-surface rounded animate-pulse" />;
  }
  if (rows === null) {
    return <p role="alert" className="text-sm text-gray-600">Figures are unavailable right now.</p>;
  }
  if (rows.length === 0) {
    return <p className="text-gray-600">Nothing saved yet. Your wallet admires your patience.</p>;
  }
  const byId = new Map(rows.map((r) => [r.id, r]));
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {refs.filter((r) => byId.has(r.id)).map((r) => {
        const f = byId.get(r.id)!;
        return (
          <li key={f.id} className="border border-border rounded-xl p-3 flex gap-3">
            <div className="w-20 h-20 shrink-0 bg-surface rounded flex items-center justify-center overflow-hidden">
              {f.image_url ? <img src={f.image_url} alt={f.name} loading="lazy" className="object-contain w-full h-full p-1" /> : null}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-bold text-dark leading-tight">{f.name}</p>
              <p className="text-xs text-gray-500">{f.series_name}</p>
              <p className="text-xs text-gray-400 font-price">{f.figure_number}</p>
              <button type="button" onClick={() => remove(f.id)} className="mt-2 text-xs underline text-gray-500">Remove</button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

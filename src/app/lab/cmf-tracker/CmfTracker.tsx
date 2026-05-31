'use client';

import { useState } from 'react';
import type { SeriesData } from './page';

const STORE_LABELS: Record<string, string> = {
  toycra:       'Toycra',
  mybrickhouse: 'MyBrickHouse',
};

function fmtInr(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

// "Series 28 Minifigures" → "Series 28"  |  "Collectible Minifigures" → "Collectible"
function shortLabel(theme: string): string {
  return theme.replace(' Minifigures', '').replace('Collectible', 'Classic');
}

function tabLabel(s: SeriesData): string {
  return `${shortLabel(s.theme)} (${s.year})`;
}

export function CmfTracker({ seriesList }: { seriesList: SeriesData[] }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  // owned: series index → set of owned set_numbers
  const [owned, setOwned] = useState<Record<number, Set<string>>>({});

  const series = seriesList[selectedIdx];
  if (!series) return null;

  const ownedSet  = owned[selectedIdx] ?? new Set<string>();
  const count     = ownedSet.size;
  const total     = series.figures.length;
  const pct       = total > 0 ? Math.round((count / total) * 100) : 0;
  const complete  = count === total && total > 0;

  // Best price per store, and overall cheapest
  const bestByStore = new Map<string, number>();
  for (const p of series.prices) {
    const cur = bestByStore.get(p.store_id);
    if (cur === undefined || p.price_inr < cur) bestByStore.set(p.store_id, p.price_inr);
  }
  const cheapest = series.prices.length > 0
    ? series.prices.reduce((m, p) => p.price_inr < m.price_inr ? p : m)
    : null;

  function toggle(setNum: string) {
    setOwned(prev => {
      const next = new Set(prev[selectedIdx] ?? []);
      if (next.has(setNum)) next.delete(setNum); else next.add(setNum);
      return { ...prev, [selectedIdx]: next };
    });
  }

  function reset() {
    setOwned(prev => ({ ...prev, [selectedIdx]: new Set() }));
  }

  return (
    <div style={{ padding: '20px 24px 48px' }}>

      {/* Series selector — horizontal scroll strip */}
      <div style={{ overflowX: 'auto', marginBottom: 24, paddingBottom: 4 }}>
        <div style={{ display: 'flex', gap: 8, minWidth: 'max-content' }}>
          {seriesList.map((s, idx) => {
            const active = idx === selectedIdx;
            return (
              <button
                key={s.theme}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                style={{
                  padding: '6px 16px', borderRadius: 20, border: '2px solid',
                  borderColor: active ? '#F7A800' : '#e5e7eb',
                  background: active ? '#F7A800' : '#fff',
                  color: active ? '#fff' : '#374151',
                  fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}
              >
                {tabLabel(s)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Series info block */}
      <div style={{
        background: '#F8F9FA', borderRadius: 14, padding: '18px 20px',
        marginBottom: 20, border: '1px solid rgba(0,0,0,0.06)',
      }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--boi-text)' }}>
              {series.theme}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9AA5B4', marginTop: 2 }}>
              {series.year} · {total} figures
            </div>
          </div>
          {count > 0 && (
            <button
              type="button"
              onClick={reset}
              style={{
                fontSize: '0.72rem', color: '#9AA5B4', background: 'none',
                border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0,
              }}
            >
              Reset
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: complete ? '#16a34a' : 'var(--boi-text)' }}>
              {complete ? `Complete set! All ${total} collected` : `${count} of ${total} collected`}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#9AA5B4' }}>{pct}%</span>
          </div>
          <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: complete ? '#16a34a' : '#F7A800',
              width: `${pct}%`,
              transition: 'width 0.2s ease',
            }} />
          </div>
        </div>

        {/* Store price */}
        <div style={{ marginTop: 14, fontSize: '0.8rem' }}>
          {cheapest ? (
            <span>
              <span style={{ color: '#374151' }}>
                Packs available at{' '}
                <strong>{STORE_LABELS[cheapest.store_id] ?? cheapest.store_id}</strong> for{' '}
                <strong style={{ color: 'var(--color-primary-dark)' }}>{fmtInr(cheapest.price_inr)}</strong>
                {' '}(blind bag)
              </span>
              {cheapest.store_id === 'toycra' && cheapest.price_inr >= 500 && (
                <span style={{ color: '#16a34a', fontWeight: 700, marginLeft: 8 }}>
                  · {fmtInr(Math.round(cheapest.price_inr * 0.88))} with ABHINAV12
                </span>
              )}
            </span>
          ) : (
            <span style={{ color: '#9AA5B4' }}>
              Not currently in Indian stores — check BrickOwl or grey market
            </span>
          )}
        </div>
      </div>

      {/* Figure grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
        {series.figures.map(fig => {
          const isOwned = ownedSet.has(fig.set_number);
          return (
            <button
              key={fig.set_number}
              type="button"
              onClick={() => toggle(fig.set_number)}
              style={{
                border: `2px solid ${isOwned ? '#F7A800' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: 12,
                background: isOwned ? '#FFFBF0' : '#fff',
                padding: '10px 8px 12px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                cursor: 'pointer', textAlign: 'center', position: 'relative',
                boxShadow: isOwned
                  ? '0 0 0 3px rgba(247,168,0,0.18)'
                  : '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'border-color 0.12s, background 0.12s, box-shadow 0.12s',
              }}
            >
              {/* Owned badge */}
              {isOwned && (
                <div style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#F7A800',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: '#fff', fontSize: '0.6rem', fontWeight: 900, lineHeight: 1 }}>✓</span>
                </div>
              )}

              {/* Image or placeholder */}
              <div style={{ width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {fig.image_url
                  ? <img src={fig.image_url} alt={fig.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>🧍</span>}
              </div>

              {/* Name + number */}
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--boi-text)', lineHeight: 1.3 }}>
                {fig.name}
              </div>
              <div style={{ fontSize: '0.6rem', color: '#9AA5B4' }}>#{fig.set_number}</div>
            </button>
          );
        })}
      </div>

      {/* Footer note */}
      <p style={{ fontSize: '0.72rem', color: '#CBD5E0', marginTop: 32, textAlign: 'center' }}>
        Showing CMF series 2010–2026 · All 29 series · Progress resets on refresh
      </p>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import type { SeriesData, FigureData } from './page';

const STORE_LABELS: Record<string, string> = {
  toycra:       'Toycra',
  mybrickhouse: 'MyBrickHouse',
};

function fmtInr(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

// "Series 28 Minifigures" → "Series 28"  |  "Collectible Minifigures" → "Classic"
function shortLabel(theme: string): string {
  return theme.replace(' Minifigures', '').replace('Collectible', 'Classic');
}

function tabLabel(s: SeriesData): string {
  return `${shortLabel(s.theme)} (${s.year})`;
}

/** Enlarge-on-click lightbox — larger image, name, figure number. Closes
 * on backdrop click, close button, or Escape. Pure presentation, no
 * tracked/saved state of any kind. */
function FigureLightbox({ figure, onClose }: { figure: FigureData; onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${figure.name}, larger image`}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15, 23, 42, 0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20, padding: '28px 28px 24px',
          maxWidth: 380, width: '100%', textAlign: 'center', position: 'relative',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 12, right: 12,
            width: 32, height: 32, borderRadius: '50%',
            border: 'none', background: '#F1F3F5', color: '#374151',
            fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>

        <div style={{ width: 220, height: 220, margin: '8px auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {figure.image_url
            ? <img src={figure.image_url} alt={figure.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            : <span style={{ fontSize: '4rem', lineHeight: 1 }}>🧍</span>}
        </div>

        <div style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '1.15rem', color: 'var(--boi-text)' }}>
          {figure.name}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#9AA5B4', marginTop: 4 }}>
          Figure #{figure.set_number}
        </div>
      </div>
    </div>
  );
}

export function MinifigHq({ seriesList }: { seriesList: SeriesData[] }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [lightboxFigure, setLightboxFigure] = useState<FigureData | null>(null);

  const series = seriesList[selectedIdx];
  if (!series) return null;

  const total = series.figures.length;

  // Best price per store, and overall cheapest
  const cheapest = series.prices.length > 0
    ? series.prices.reduce((m, p) => p.price_inr < m.price_inr ? p : m)
    : null;

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
        <div style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--boi-text)' }}>
          {series.theme}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9AA5B4', marginTop: 2 }}>
          {series.year} · {total} figures
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

      {/* Figure grid — click to enlarge */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
        {series.figures.map(fig => (
          <button
            key={fig.set_number}
            type="button"
            onClick={() => setLightboxFigure(fig)}
            aria-label={`Enlarge ${fig.name}`}
            style={{
              border: '2px solid rgba(0,0,0,0.08)',
              borderRadius: 12,
              background: '#fff',
              padding: '10px 8px 12px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              cursor: 'pointer', textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'border-color 0.12s, box-shadow 0.12s',
            }}
          >
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
        ))}
      </div>

      {/* Footer note */}
      <p style={{ fontSize: '0.72rem', color: '#CBD5E0', marginTop: 32, textAlign: 'center' }}>
        Showing CMF series 2010–2026 · All 29 series · Click any figure to enlarge
      </p>

      {lightboxFigure && (
        <FigureLightbox figure={lightboxFigure} onClose={() => setLightboxFigure(null)} />
      )}
    </div>
  );
}

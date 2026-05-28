import Link from 'next/link';
import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase';
import { slugify } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Retirement Radar | Bricks of India Lab',
  description: 'LEGO sets retiring soon in India — 90-day window. Buy before they\'re gone. Updated weekly.',
  alternates: { canonical: 'https://bricksofindia.com/lab/retiring-soon' },
};

const STORE_LABELS: Record<string, string> = {
  toycra:       'Toycra',
  mybrickhouse: 'MyBrickHouse',
  jaiman:       'Jaiman Toys',
};

function fmtInr(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface RetSet {
  set_number: string;
  name:       string;
  theme:      string | null;
  pieces:     number | null;
  image_url:  string | null;
  lego_mrp_inr: number | null;
  retirement_date: string;
  best_price: number | null;
  store_id:   string | null;
}

export default async function RetiringSoonPage() {
  const supabase = createServerClient();

  const { data: setsRaw } = await supabase
    .from('sets')
    .select('set_number, name, theme, pieces, image_url, lego_mrp_inr, retirement_date')
    .eq('is_retiring_soon', true)
    .not('retirement_date', 'is', null)
    .order('retirement_date', { ascending: true });

  const sets = (setsRaw ?? []) as {
    set_number: string; name: string; theme: string | null; pieces: number | null;
    image_url: string | null; lego_mrp_inr: number | null; retirement_date: string;
  }[];

  const setNumbers = sets.map(s => s.set_number);

  const bestPrices = new Map<string, { price: number; store_id: string }>();
  if (setNumbers.length > 0) {
    const { data: pricesData } = await supabase
      .from('store_prices')
      .select('set_id, store_id, price_inr')
      .eq('in_stock', true)
      .not('price_inr', 'is', null)
      .in('set_id', setNumbers);

    for (const p of (pricesData ?? []) as { set_id: string; store_id: string; price_inr: number }[]) {
      const cur = bestPrices.get(p.set_id);
      if (!cur || p.price_inr < cur.price) {
        bestPrices.set(p.set_id, { price: p.price_inr, store_id: p.store_id });
      }
    }
  }

  const results: RetSet[] = sets.map(s => {
    const bp = bestPrices.get(s.set_number);
    return {
      set_number:      s.set_number,
      name:            s.name,
      theme:           s.theme,
      pieces:          s.pieces,
      image_url:       s.image_url,
      lego_mrp_inr:    s.lego_mrp_inr,
      retirement_date: s.retirement_date,
      best_price:      bp?.price ?? null,
      store_id:        bp?.store_id ?? null,
    };
  });

  // Group by retirement date
  const dateGroups = new Map<string, RetSet[]>();
  for (const r of results) {
    const group = dateGroups.get(r.retirement_date) ?? [];
    group.push(r);
    dateGroups.set(r.retirement_date, group);
  }

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: 'var(--font-inter), sans-serif', color: 'var(--boi-text)' }}>

      {/* Header — lab tool pattern */}
      <div style={{ padding: '20px 28px 0', borderLeft: '4px solid #F7A800', margin: '8px 24px 0' }}>
        <Link href="/lab" style={{ color: 'var(--boi-blue)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
          ← The Lab
        </Link>
        <h1 style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '1.7rem', color: 'var(--boi-text)', margin: '4px 0 2px' }}>
          Retirement Radar
        </h1>
        <p style={{ color: 'var(--boi-text-secondary)', fontSize: '0.85rem', margin: '0 0 2px' }}>
          {results.length} LEGO set{results.length !== 1 ? 's' : ''} retiring in the next 90 days. Buy before they&apos;re gone.
        </p>
        <p style={{ color: '#CBD5E0', fontSize: '0.72rem', margin: 0 }}>
          Data from Brickset · Updated weekly · Sorted by retirement date
        </p>
      </div>

      {/* Grouped by date */}
      <div style={{ padding: '24px 24px 48px' }}>
        {results.length === 0 ? (
          <p style={{ color: '#9AA5B4', fontSize: '0.9rem' }}>No sets retiring in the next 90 days. Check back soon.</p>
        ) : (
          Array.from(dateGroups.entries()).map(([date, group]) => {
            const days = daysUntil(date);
            const urgencyColor = days <= 30 ? '#dc2626' : days <= 60 ? '#F7A800' : '#64748b';

            return (
              <div key={date} style={{ marginBottom: 36 }}>
                {/* Date header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--boi-text)' }}>
                    Retiring {fmtDate(date)}
                  </span>
                  <span style={{
                    background: urgencyColor, color: '#fff',
                    borderRadius: 20, padding: '2px 10px',
                    fontSize: '0.72rem', fontWeight: 700,
                  }}>
                    {days} day{days !== 1 ? 's' : ''} left
                  </span>
                  <span style={{ color: '#CBD5E0', fontSize: '0.72rem' }}>
                    {group.length} set{group.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Set grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                  {group.map(r => {
                    const slug      = `${r.set_number}-${slugify(r.name)}`;
                    const storeName = r.store_id ? (STORE_LABELS[r.store_id] ?? r.store_id) : null;
                    const isToycra  = r.store_id === 'toycra';
                    const discounted = isToycra && r.best_price && r.best_price >= 500
                      ? Math.round(r.best_price * 0.88)
                      : null;

                    return (
                      <div key={r.set_number} style={{
                        border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden',
                        background: '#fff', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                      }}>
                        {/* Urgency stripe */}
                        <div style={{ height: 3, background: urgencyColor }} />

                        {/* Image */}
                        <div style={{ background: '#F8F9FA', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 110 }}>
                          {r.image_url
                            ? <img src={r.image_url} alt={r.name} style={{ maxHeight: 90, maxWidth: '90%', objectFit: 'contain' }} />
                            : <span style={{ fontSize: '2rem' }}>🧱</span>}
                        </div>

                        {/* Body */}
                        <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div>
                            <Link
                              href={`/sets/${slug}`}
                              style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--boi-text)', textDecoration: 'none', lineHeight: 1.3, display: 'block' }}
                            >
                              {r.name}
                            </Link>
                            <div style={{ fontSize: '0.68rem', color: '#9AA5B4', marginTop: 2 }}>
                              #{r.set_number}
                              {r.theme  ? ` · ${r.theme}`                             : ''}
                              {r.pieces ? ` · ${r.pieces.toLocaleString('en-IN')} pcs` : ''}
                            </div>
                          </div>

                          {/* Price */}
                          <div style={{ marginTop: 'auto', paddingTop: 6 }}>
                            {r.best_price ? (
                              <>
                                {storeName && (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', background: '#EEF2FF', borderRadius: 6, padding: '1px 7px', marginBottom: 4 }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>{storeName}</span>
                                  </div>
                                )}
                                <div>
                                  <span style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--color-primary-dark)', lineHeight: 1 }}>
                                    {fmtInr(r.best_price)}
                                  </span>
                                </div>
                                {discounted && (
                                  <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700 }}>
                                    {fmtInr(discounted)} with ABHINAV12
                                  </div>
                                )}
                              </>
                            ) : r.lego_mrp_inr ? (
                              <div style={{ fontSize: '0.75rem', color: '#9AA5B4' }}>
                                MRP {fmtInr(r.lego_mrp_inr)}
                                <div style={{ fontSize: '0.65rem', color: '#CBD5E0' }}>Not in stock online</div>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.72rem', color: '#CBD5E0' }}>Price unavailable</div>
                            )}
                          </div>

                          <Link
                            href={`/sets/${slug}`}
                            style={{
                              marginTop: 6, display: 'block', textAlign: 'center',
                              background: 'var(--color-primary-dark)', color: '#fff',
                              fontWeight: 700, fontSize: '0.78rem',
                              padding: '7px 12px', borderRadius: 8, textDecoration: 'none',
                              boxShadow: '0 2px 0 rgba(0,0,0,0.18)',
                            }}
                          >
                            View Set →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

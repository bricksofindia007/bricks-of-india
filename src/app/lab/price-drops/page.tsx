import Link from 'next/link';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { createServerClient } from '@/lib/supabase';
import { slugify } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'LEGO Price Drops in India — Bricks of India',
  description:
    'Daily LEGO price drops across Indian stores — Toycra, MyBrickHouse, Jaiman Toys. ' +
    'Sorted by biggest drop. Updated every day from live store data.',
  alternates: { canonical: 'https://bricksofindia.com/lab/price-drops' },
};

const STORE_LABELS: Record<string, string> = {
  toycra:       'Toycra',
  mybrickhouse: 'MyBrickHouse',
  jaiman:       'Jaiman Toys',
};
const STORE_IDS = ['toycra', 'mybrickhouse', 'jaiman'];

function fmtInr(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface DropRow {
  set_id:    string;
  store_id:  string;
  old_price: number;
  new_price: number;
  drop_inr:  number;
  drop_pct:  number;
  scraped_at: string;
  name:      string;
  theme:     string | null;
  image_url: string | null;
}

interface Props {
  searchParams: { store?: string; theme?: string; pct?: string };
}

export default async function PriceDropsPage({ searchParams }: Props) {
  const supabase     = createServerClient();
  const storeFilter  = searchParams.store  || '';
  const themeFilter  = searchParams.theme  || '';
  const pctFilter    = parseInt(searchParams.pct || '0', 10);

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const PAGE  = 1000;

  // ── 1. Current prices from store_prices ──────────────────────────────────────
  const currentMap = new Map<string, { price: number; scraped_at: string }>();
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await supabase
      .from('store_prices')
      .select('set_id, store_id, price_inr, scraped_at')
      .not('price_inr', 'is', null)
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data as { set_id: string; store_id: string; price_inr: number; scraped_at: string }[]) {
      currentMap.set(`${r.set_id}:${r.store_id}`, { price: r.price_inr, scraped_at: r.scraped_at });
    }
    if (data.length < PAGE) break;
  }

  // ── 2. Baseline prices: oldest 5 pages of price_history in the 30-day window ─
  // Order ASC → first occurrence per (set_id, store_id) = oldest available price.
  const baselineMap = new Map<string, number>();
  for (let page = 0; page < 5; page++) {
    const { data } = await supabase
      .from('price_history')
      .select('set_id, store_id, price_inr')
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data as { set_id: string; store_id: string; price_inr: number }[]) {
      const key = `${r.set_id}:${r.store_id}`;
      if (!baselineMap.has(key)) baselineMap.set(key, r.price_inr);
    }
    if (data.length < PAGE) break;
  }

  // ── 3. Compute drops ──────────────────────────────────────────────────────────
  type RawDrop = { set_id: string; store_id: string; old_price: number; new_price: number; drop_inr: number; drop_pct: number; scraped_at: string };
  const rawDrops: RawDrop[] = [];

  for (const [key, cur] of Array.from(currentMap.entries())) {
    const baseline = baselineMap.get(key);
    if (!baseline) continue;
    if (cur.price >= baseline) continue;
    const drop_inr = baseline - cur.price;
    const drop_pct = (drop_inr / baseline) * 100;
    if (drop_inr < 200 && drop_pct < 5) continue;
    const [set_id, store_id] = key.split(':');
    rawDrops.push({ set_id, store_id, old_price: baseline, new_price: cur.price, drop_inr, drop_pct, scraped_at: cur.scraped_at });
  }

  // ── 4. Fetch set metadata for matched set_ids ─────────────────────────────────
  const setIds = Array.from(new Set(rawDrops.map(d => d.set_id)));
  const setsMap = new Map<string, { name: string; theme: string | null; image_url: string | null }>();
  for (let i = 0; i < setIds.length; i += 200) {
    const { data } = await supabase
      .from('sets')
      .select('set_number, name, theme, image_url')
      .in('set_number', setIds.slice(i, i + 200));
    for (const s of (data ?? []) as { set_number: string; name: string; theme: string | null; image_url: string | null }[]) {
      setsMap.set(s.set_number, { name: s.name, theme: s.theme, image_url: s.image_url });
    }
  }

  // ── 5. Build full rows ────────────────────────────────────────────────────────
  let allRows: DropRow[] = rawDrops
    .map(d => {
      const set = setsMap.get(d.set_id);
      if (!set) return null;
      return { ...d, name: set.name, theme: set.theme, image_url: set.image_url };
    })
    .filter((r): r is DropRow => r !== null);

  // Unique themes for filter (before applying theme filter)
  const allThemes = Array.from(new Set(allRows.map(r => r.theme).filter((t): t is string => !!t))).sort();

  // Apply filters
  if (storeFilter) allRows = allRows.filter(r => r.store_id === storeFilter);
  if (themeFilter) allRows = allRows.filter(r => r.theme === themeFilter);
  if (pctFilter)   allRows = allRows.filter(r => r.drop_pct >= pctFilter);

  // Sort: biggest ₹ drop first
  allRows.sort((a, b) => b.drop_inr - a.drop_inr);

  const hasFilters = !!(storeFilter || themeFilter || pctFilter);

  const selectStyle: CSSProperties = {
    padding: '6px 10px', borderRadius: 8, border: '1px solid #E4E7EB',
    fontSize: '0.82rem', color: 'var(--boi-text)', background: '#fff',
    fontFamily: 'inherit', cursor: 'pointer',
  };

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: 'var(--font-inter), sans-serif', color: 'var(--boi-text)' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 28px 0', borderLeft: '4px solid #F7A800', margin: '8px 24px 0' }}>
        <Link href="/lab" style={{ color: 'var(--boi-blue)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
          ← The Lab
        </Link>
        <h1 style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '1.7rem', color: 'var(--boi-text)', margin: '4px 0 2px' }}>
          Price Drop Board
        </h1>
        <p style={{ color: 'var(--boi-text-secondary)', fontSize: '0.85rem', margin: '0 0 2px' }}>
          {allRows.length} price drop{allRows.length !== 1 ? 's' : ''} in the last 30 days
          {hasFilters ? ' (filtered)' : ' — min ₹200 or 5%'}
        </p>
        <p style={{ color: '#CBD5E0', fontSize: '0.72rem', margin: 0 }}>
          Toycra · MyBrickHouse · Jaiman Toys · Scraped daily · Sorted by biggest ₹ drop
        </p>
      </div>

      {/* ── Filters ── */}
      <form method="get" style={{ display: 'flex', gap: 10, padding: '16px 24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select name="store" defaultValue={storeFilter} style={selectStyle}>
          <option value="">All Stores</option>
          {STORE_IDS.map(s => (
            <option key={s} value={s}>{STORE_LABELS[s]}</option>
          ))}
        </select>

        <select name="theme" defaultValue={themeFilter} style={selectStyle}>
          <option value="">All Themes</option>
          {allThemes.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select name="pct" defaultValue={String(pctFilter)} style={selectStyle}>
          <option value="0">Any % drop</option>
          <option value="10">10%+ drop</option>
          <option value="20">20%+ drop</option>
          <option value="30">30%+ drop</option>
        </select>

        <button
          type="submit"
          style={{ padding: '7px 16px', background: '#F7A800', color: '#0F2D6B', border: 'none', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Filter
        </button>
        {hasFilters && (
          <Link href="/lab/price-drops" style={{ fontSize: '0.75rem', color: '#9AA5B4', textDecoration: 'none' }}>
            Clear filters
          </Link>
        )}
      </form>

      {/* ── Grid ── */}
      <div style={{ padding: '0 24px 48px' }}>
        {allRows.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#9AA5B4' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📉</div>
            <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 6px', color: 'var(--boi-text)' }}>
              No price drops in the last 30 days
            </p>
            <p style={{ fontSize: '0.82rem', margin: 0 }}>
              {hasFilters ? 'Try clearing your filters.' : 'Check back soon. Our scrapers run daily.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
            {allRows.map(r => {
              const slug      = `${r.set_id}-${slugify(r.name)}`;
              const storeName = STORE_LABELS[r.store_id] ?? r.store_id;
              const isToycra  = r.store_id === 'toycra';
              const discounted = isToycra && r.new_price >= 500 ? Math.round(r.new_price * 0.88) : null;

              return (
                <div key={`${r.set_id}:${r.store_id}`} style={{
                  border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden',
                  background: '#fff', display: 'flex', flexDirection: 'column',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}>
                  {/* Saffron drop stripe */}
                  <div style={{ height: 3, background: '#F7A800' }} />

                  {/* Image */}
                  <div style={{ background: '#F8F9FA', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 110 }}>
                    {r.image_url
                      ? <img src={r.image_url} alt={r.name} style={{ maxHeight: 90, maxWidth: '90%', objectFit: 'contain' }} />
                      : <span style={{ fontSize: '2rem' }}>🧱</span>
                    }
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
                        #{r.set_id}{r.theme ? ` · ${r.theme}` : ''}
                      </div>
                    </div>

                    {/* Store badge */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', background: '#EEF2FF', borderRadius: 6, padding: '1px 7px', alignSelf: 'flex-start' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>{storeName}</span>
                    </div>

                    {/* Price: old → new + drop badge */}
                    <div style={{ marginTop: 2 }}>
                      <div style={{ fontSize: '0.72rem', color: '#9AA5B4', textDecoration: 'line-through' }}>
                        {fmtInr(r.old_price)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--color-primary-dark)', lineHeight: 1 }}>
                          {fmtInr(r.new_price)}
                        </span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#16a34a', background: '#DCFCE7', padding: '1px 6px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                          -{fmtInr(r.drop_inr)} ({r.drop_pct.toFixed(0)}% off)
                        </span>
                      </div>
                      {discounted && (
                        <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700 }}>
                          {fmtInr(discounted)} with ABHINAV12
                        </div>
                      )}
                    </div>

                    {/* Date */}
                    <div style={{ fontSize: '0.65rem', color: '#CBD5E0', marginTop: 2 }}>
                      Updated {fmtDate(r.scraped_at)}
                    </div>

                    <Link
                      href={`/sets/${slug}`}
                      style={{
                        marginTop: 'auto', display: 'block', textAlign: 'center',
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
        )}
      </div>
    </div>
  );
}

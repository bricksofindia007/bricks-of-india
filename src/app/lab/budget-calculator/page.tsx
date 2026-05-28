import Link from 'next/link';
import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase';
import { slugify } from '@/lib/utils';
import { BudgetForm } from './BudgetForm';

export const metadata: Metadata = {
  title: 'Budget Calculator | Bricks of India Lab',
  description: 'Find the best LEGO sets for your budget — live Indian store prices across Toycra, MyBrickHouse, and Jaiman Toys. Updated every 6 hours.',
  alternates: { canonical: 'https://bricksofindia.com/lab/budget-calculator' },
};

const STORE_LABELS: Record<string, string> = {
  toycra:       'Toycra',
  mybrickhouse: 'MyBrickHouse',
  jaiman:       'Jaiman Toys',
};

interface SetResult {
  set_number: string;
  name:       string;
  theme:      string | null;
  pieces:     number | null;
  image_url:  string | null;
  best_price: number;
  store_id:   string;
}

function fmtInr(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export default async function BudgetCalculatorPage({
  searchParams,
}: {
  searchParams: { min?: string; max?: string };
}) {
  const min = Math.max(0, parseInt(searchParams.min ?? '1000', 10) || 0);
  const max = Math.max(min, parseInt(searchParams.max ?? '5000', 10) || 5000);

  const supabase = createServerClient();

  // Paginate store_prices — PostgREST caps at 1000 rows
  const PAGE = 1000;
  const allPrices: { set_id: string; store_id: string; price_inr: number }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await supabase
      .from('store_prices')
      .select('set_id, store_id, price_inr')
      .eq('in_stock', true)
      .not('price_inr', 'is', null)
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    allPrices.push(...(data as typeof allPrices));
    if (data.length < PAGE) break;
  }

  // Best price per set (lowest across all stores)
  const bestBySet = new Map<string, { price: number; store_id: string }>();
  for (const p of allPrices) {
    const cur = bestBySet.get(p.set_id);
    if (!cur || p.price_inr < cur.price) {
      bestBySet.set(p.set_id, { price: p.price_inr, store_id: p.store_id });
    }
  }

  // Filter to budget range
  const inBudget = [...bestBySet.entries()]
    .filter(([, v]) => v.price >= min && v.price <= max)
    .map(([set_id, v]) => ({ set_id, ...v }));

  let results: SetResult[] = [];

  if (inBudget.length > 0) {
    const setNumbers = inBudget.map((r) => r.set_id);
    const { data: setsData } = await supabase
      .from('sets')
      .select('set_number, name, theme, pieces, image_url')
      .in('set_number', setNumbers);

    const setMap = new Map((setsData ?? []).map((s: any) => [s.set_number, s]));

    results = inBudget
      .map(({ set_id, price, store_id }) => {
        const s = setMap.get(set_id);
        if (!s) return null;
        return {
          set_number: s.set_number as string,
          name:       s.name as string,
          theme:      (s.theme as string | null) ?? null,
          pieces:     (s.pieces as number | null) ?? null,
          image_url:  (s.image_url as string | null) ?? null,
          best_price: price,
          store_id,
        };
      })
      .filter((r): r is SetResult => r !== null)
      .sort((a, b) => (b.pieces ?? 0) - (a.pieces ?? 0));
  }

  const fmtRange =
    min === 0
      ? `under ${fmtInr(max)}`
      : max >= 999999
      ? `above ${fmtInr(min)}`
      : `between ${fmtInr(min)} and ${fmtInr(max)}`;

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: 'var(--font-inter), sans-serif', color: 'var(--boi-text)' }}>

      {/* Header — lab tool pattern */}
      <div style={{ padding: '20px 28px 0', borderLeft: '4px solid #F7A800', margin: '8px 24px 0' }}>
        <Link href="/lab" style={{ color: 'var(--boi-blue)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
          ← The Lab
        </Link>
        <h1 style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '1.7rem', color: 'var(--boi-text)', margin: '4px 0 2px' }}>
          Budget Calculator
        </h1>
        <p style={{ color: 'var(--boi-text-secondary)', fontSize: '0.85rem', margin: '0 0 2px' }}>
          Find the best LEGO sets for your budget — live Indian store prices.
        </p>
        <p style={{ color: '#CBD5E0', fontSize: '0.72rem', margin: 0 }}>
          Updated every 6 hours · Toycra, MyBrickHouse, Jaiman Toys · Sorted by piece count
        </p>
      </div>

      {/* Input section */}
      <div style={{ padding: '24px 28px 8px' }}>
        <BudgetForm defaultMin={min} defaultMax={max} />
      </div>

      {/* Result count */}
      <div style={{ padding: '8px 28px 0', fontSize: '0.82rem', fontWeight: 700, color: results.length > 0 ? 'var(--boi-saffron)' : '#9AA5B4' }}>
        {results.length > 0
          ? `${results.length} set${results.length !== 1 ? 's' : ''} available ${fmtRange} right now`
          : `No sets currently in stock ${fmtRange} — try widening your budget`}
      </div>

      {/* Results grid */}
      <div style={{ padding: '14px 24px 48px' }}>
        {results.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {results.map((r) => {
              const slug        = `${r.set_number}-${slugify(r.name)}`;
              const storeName   = STORE_LABELS[r.store_id] ?? r.store_id;
              const isToycra    = r.store_id === 'toycra';
              const discounted  = isToycra && r.best_price >= 500
                ? Math.round(r.best_price * 0.88)
                : null;

              return (
                <div key={r.set_number} style={{
                  border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, overflow: 'hidden',
                  background: '#fff', display: 'flex', flexDirection: 'column',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}>
                  {/* Image */}
                  <div style={{ background: '#F8F9FA', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 130 }}>
                    {r.image_url
                      ? <img src={r.image_url} alt={r.name} style={{ maxHeight: 110, maxWidth: '90%', objectFit: 'contain' }} />
                      : <span style={{ fontSize: '2.5rem' }}>🧱</span>}
                  </div>

                  {/* Body */}
                  <div style={{ padding: '12px 14px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div>
                      <Link
                        href={`/sets/${slug}`}
                        style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--boi-text)', textDecoration: 'none', lineHeight: 1.35, display: 'block' }}
                      >
                        {r.name}
                      </Link>
                      <div style={{ fontSize: '0.7rem', color: '#9AA5B4', marginTop: 2 }}>
                        #{r.set_number}
                        {r.theme ? ` · ${r.theme}` : ''}
                        {r.pieces ? ` · ${r.pieces.toLocaleString('en-IN')} pcs` : ''}
                      </div>
                    </div>

                    {/* Store badge */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', background: '#EEF2FF', borderRadius: 6, padding: '2px 8px', width: 'fit-content' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                        {storeName}
                      </span>
                    </div>

                    {/* Price */}
                    <div>
                      <span style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '1.4rem', color: 'var(--color-primary-dark)', lineHeight: 1 }}>
                        {fmtInr(r.best_price)}
                      </span>
                      {discounted && (
                        <div style={{ fontSize: '0.75rem', marginTop: 3 }}>
                          <span style={{ color: '#16a34a', fontWeight: 700 }}>
                            {fmtInr(discounted)} with ABHINAV12
                          </span>
                          <span style={{ color: '#CBD5E0', marginLeft: 4 }}>· 12% off above ₹500</span>
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <Link
                      href={`/sets/${slug}`}
                      style={{
                        marginTop: 'auto', display: 'block', textAlign: 'center',
                        background: 'var(--color-primary-dark)', color: '#fff',
                        fontWeight: 700, fontSize: '0.82rem',
                        padding: '9px 16px', borderRadius: 10, textDecoration: 'none',
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
        ) : null}
      </div>
    </div>
  );
}

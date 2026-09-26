import Link from 'next/link';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/metadata';
import { createServerClient } from '@/lib/supabase';
import { slugify } from '@/lib/utils';
import { PRICE_CADENCE, READ_REVALIDATE_SECONDS } from '@/lib/price-freshness';
import { getDeals } from '@/lib/price-summary';
import { PriceAge } from '@/components/ui/PriceAge';

export const metadata: Metadata = buildMetadata({
  title: 'India Deals Today — The Lab',
  description: 'Every LEGO set currently discounted across Indian stores — Toycra and MyBrickHouse. Sorted by discount %. Updated ' + PRICE_CADENCE + '.',
  path: '/lab/deals',
});

// Hourly ISR (PR-B). Without a revalidate this page was built once, fully
// static, and changed only on deploy.
export const revalidate = 3600; // = READ_REVALIDATE_SECONDS (segment config must be a literal)

const STORE_LABELS: Record<string, string> = {
  toycra:       'Toycra',
  mybrickhouse: 'MyBrickHouse',
};

interface DealRow {
  set_id:      string;
  store_id:    string;
  price_inr:   number;
  product_url: string;
  scraped_at:  string;
  stores:      string[];   // every store at the best price (R5)
  discountPct: number;
  set: {
    set_number:    string;
    name:          string;
    lego_mrp_inr:  number;
    image_url:     string | null;
    theme:         string | null;
  };
}

export default async function DealsPage() {
  const supabase = createServerClient({ revalidate: READ_REVALIDATE_SECONDS });

  // PR-B: same locked rules as /deals (public.set_price_summary): a deal is a
  // fresh in-stock listed price >= 10% below the R2 MRP anchor. Replaces a
  // 300-row, catalogue-MRP-only calculation that counted any discount > 0.
  const summaries = await getDeals(supabase);
  const ids = summaries.map((d) => d.set_id);
  const setMap = new Map<string, DealRow['set']>();
  const urlMap = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const [{ data: setRows }, { data: spRows }] = await Promise.all([
      supabase.from('sets').select('set_number, name, lego_mrp_inr, image_url, theme').in('set_number', chunk),
      supabase.from('store_prices').select('set_id, store_id, product_url').eq('in_stock', true).in('set_id', chunk),
    ]);
    for (const r of setRows ?? []) setMap.set(r.set_number, r as DealRow['set']);
    for (const r of spRows ?? []) urlMap.set(`${r.set_id}:${r.store_id}`, r.product_url);
  }
  const deals: DealRow[] = summaries.flatMap((d) => {
    const set = setMap.get(d.set_id);
    const store = d.best_store_ids?.[0];
    if (!set || !store || d.best_price_inr == null || d.anchor_mrp_inr == null) return [];
    return [{
      set_id: d.set_id,
      store_id: store,
      stores: d.best_store_ids ?? [store],
      price_inr: d.best_price_inr,
      product_url: urlMap.get(`${d.set_id}:${store}`) ?? '',
      scraped_at: d.best_scraped_at ?? '',
      discountPct: Math.floor(d.discount_pct ?? 0),
      set: { ...set, lego_mrp_inr: d.anchor_mrp_inr },
    }];
  });

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: 'var(--font-inter), sans-serif', color: 'var(--boi-text)' }}>

      {/* Header — matches the lab tool pattern */}
      <div style={{ padding: '20px 28px 0', borderLeft: '4px solid #F7A800', margin: '8px 24px 0' }}>
        <Link href="/lab" style={{ color: 'var(--boi-blue)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
          ← The Lab
        </Link>
        <h1 style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '1.7rem', color: 'var(--boi-text)', margin: '4px 0 2px' }}>
          India Deals Today
        </h1>
        <p style={{ color: 'var(--boi-text-secondary)', fontSize: '0.85rem', margin: '0 0 2px' }}>
          Your wallet is already open. We found the discounts. The stores did not make this easy.
        </p>
        <p style={{ color: '#CBD5E0', fontSize: '0.72rem', margin: 0 }}>
          Scraped {PRICE_CADENCE} · Toycra, MyBrickHouse · Sorted by discount %
        </p>
      </div>

      {/* Deal count chip */}
      {deals.length > 0 && (
        <div style={{ padding: '10px 28px 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--boi-saffron)' }}>
          {deals.length} set{deals.length !== 1 ? 's' : ''} at least 10% below MRP right now
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '14px 24px 40px' }}>
        {deals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏷️</div>
            <h2 style={{ fontFamily: 'var(--font-fredoka)', fontSize: '1.4rem', color: 'var(--boi-text)', margin: '0 0 10px' }}>
              Nothing 10% or more below MRP right now.
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--boi-text-secondary)', maxWidth: 360, margin: '0 auto 20px' }}>
              The stores are doing their best. Their best is not good enough. Scrapers run {PRICE_CADENCE} — check back later.
            </p>
            <Link
              href="/sets"
              style={{ display: 'inline-block', background: 'var(--color-primary-dark)', color: '#fff', fontWeight: 700, fontSize: '0.82rem', padding: '10px 20px', borderRadius: 10, textDecoration: 'none' }}
            >
              Browse all sets →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
            {deals.map((deal) => (
              <DealCard key={`${deal.set_id}-${deal.store_id}`} deal={deal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DealCard({ deal }: { deal: DealRow }) {
  const storeName = deal.stores.map((id) => STORE_LABELS[id] ?? id).join(' & ');
  const setSlug   = `${deal.set.set_number}-${slugify(deal.set.name)}`;



  return (
    <div style={{
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: 14,
      overflow: 'hidden',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>

      {/* Image area */}
      <div style={{ background: '#F8F9FA', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 140, position: 'relative' }}>
        {deal.set.image_url ? (
          <img
            src={deal.set.image_url}
            alt={deal.set.name}
            style={{ maxHeight: 120, maxWidth: '90%', objectFit: 'contain' }}
          />
        ) : (
          <span style={{ fontSize: '2.5rem' }}>🧱</span>
        )}
        {/* Discount badge */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'var(--boi-saffron)', color: '#fff',
          fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '0.88rem',
          padding: '3px 10px', borderRadius: 20, lineHeight: 1.5,
        }}>
          {deal.discountPct}% OFF
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* Set name + number */}
        <div>
          <Link
            href={`/sets/${setSlug}`}
            style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--boi-text)', textDecoration: 'none', lineHeight: 1.35, display: 'block' }}
          >
            {deal.set.name}
          </Link>
          <div style={{ fontSize: '0.7rem', color: '#9AA5B4', marginTop: 2 }}>
            #{deal.set.set_number}{deal.set.theme ? ` · ${deal.set.theme}` : ''}
          </div>
        </div>

        {/* Store badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', background: '#EEF2FF', borderRadius: 6, padding: '2px 8px', width: 'fit-content' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>{storeName}</span>
        </div>

        {/* Prices */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '1.4rem', color: 'var(--color-primary-dark)', lineHeight: 1 }}>
            ₹{deal.price_inr.toLocaleString('en-IN')}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#CBD5E0', textDecoration: 'line-through' }}>
            ₹{deal.set.lego_mrp_inr.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Freshness */}
        <div style={{ fontSize: '0.65rem', color: '#CBD5E0' }}><PriceAge scrapedAt={deal.scraped_at || null} /></div>

        {/* CTA */}
        <a
          href={deal.product_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 'auto',
            display: 'block', textAlign: 'center',
            background: 'var(--color-primary-dark)', color: '#fff',
            fontWeight: 700, fontSize: '0.82rem',
            padding: '9px 16px', borderRadius: 10,
            textDecoration: 'none',
            boxShadow: '0 2px 0 rgba(0,0,0,0.18)',
          }}
        >
          Buy on {storeName} →
        </a>
      </div>
    </div>
  );
}

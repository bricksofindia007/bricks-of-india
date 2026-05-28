import Link from 'next/link';
import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase';
import { CmfTracker } from './CmfTracker';

export const metadata: Metadata = {
  title: 'CMF Tracker | Bricks of India Lab',
  description: 'Browse every LEGO Collectible Minifigures series from 2020–2026 and track which figures you own.',
  alternates: { canonical: 'https://bricksofindia.com/lab/cmf-tracker' },
};

export type FigureData = {
  set_number: string;
  name:       string;
  image_url:  string | null;
};

export type PriceData = {
  store_id:  string;
  price_inr: number;
};

export type SeriesData = {
  theme:   string;
  year:    number;
  figures: FigureData[];
  prices:  PriceData[];
};

// Names that indicate a bundle/pack, not an individual figure
const BUNDLE_RE = /complete|sealed box|\b6.?pack\b|sealed|\bbox\b/i;

function sortBySetNum(a: FigureData, b: FigureData): number {
  // "71051-10" → 10, "71051-1" → 1, "71051" → 0
  const nA = parseInt(a.set_number.split('-')[1] ?? '0', 10);
  const nB = parseInt(b.set_number.split('-')[1] ?? '0', 10);
  return nA - nB;
}

export default async function CmfTrackerPage() {
  const supabase = createServerClient();

  // All CMF rows — Series X Minifigures + Collectible Minifigures
  const { data: rawRows } = await supabase
    .from('sets')
    .select('set_number, name, year, theme, image_url')
    .ilike('theme', '%Minifigures%')
    .order('set_number', { ascending: true });

  // Filter out bundles/packs — keep individual figures only
  const figures = (rawRows ?? []).filter(r => !BUNDLE_RE.test(r.name)) as {
    set_number: string; name: string; year: number; theme: string; image_url: string | null;
  }[];

  // Group by theme
  const byTheme = new Map<string, typeof figures>();
  for (const f of figures) {
    const g = byTheme.get(f.theme) ?? [];
    g.push(f);
    byTheme.set(f.theme, g);
  }

  // Build SeriesData[], newest year first
  const seriesList: SeriesData[] = Array.from(byTheme.entries())
    .map(([theme, figs]) => {
      const year = Math.max(...figs.map(f => f.year ?? 0));
      const sorted = [...figs].sort(sortBySetNum);
      return {
        theme,
        year,
        figures: sorted.map(f => ({ set_number: f.set_number, name: f.name, image_url: f.image_url })),
        prices: [] as PriceData[],
      };
    })
    .sort((a, b) => b.year - a.year || b.theme.localeCompare(a.theme));

  // Fetch store prices for all figure set_numbers
  const allNums = figures.map(f => f.set_number);
  if (allNums.length > 0) {
    const { data: priceRows } = await supabase
      .from('store_prices')
      .select('set_id, store_id, price_inr')
      .eq('in_stock', true)
      .not('price_inr', 'is', null)
      .in('set_id', allNums);

    // Map set_number → series index
    const numToIdx = new Map<string, number>();
    for (let i = 0; i < seriesList.length; i++) {
      for (const f of seriesList[i].figures) numToIdx.set(f.set_number, i);
    }

    for (const p of (priceRows ?? []) as { set_id: string; store_id: string; price_inr: number }[]) {
      const idx = numToIdx.get(p.set_id);
      if (idx !== undefined) {
        seriesList[idx].prices.push({ store_id: p.store_id, price_inr: p.price_inr });
      }
    }
  }

  const totalFigures = figures.length;

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: 'var(--font-inter), sans-serif', color: 'var(--boi-text)' }}>

      {/* Header — lab tool pattern */}
      <div style={{ padding: '20px 28px 0', borderLeft: '4px solid #F7A800', margin: '8px 24px 0' }}>
        <Link href="/lab" style={{ color: 'var(--boi-blue)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
          ← The Lab
        </Link>
        <h1 style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '1.7rem', color: 'var(--boi-text)', margin: '4px 0 2px' }}>
          CMF Tracker
        </h1>
        <p style={{ color: 'var(--boi-text-secondary)', fontSize: '0.85rem', margin: '0 0 2px' }}>
          Browse every Collectible Minifigures series and track what you own.
        </p>
        <p style={{ color: '#CBD5E0', fontSize: '0.72rem', margin: 0 }}>
          {seriesList.length} series · {totalFigures} figures · 2020–2026
        </p>
      </div>

      <CmfTracker seriesList={seriesList} />
    </div>
  );
}

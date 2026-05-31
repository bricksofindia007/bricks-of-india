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

  // Fetch individual figures from cmf_figures (populated by sync-cmf-figures.mjs)
  const { data: rawRows } = await supabase
    .from('cmf_figures')
    .select('figure_number, series_set_number, name, year, image_url, series_name, figure_index')
    .order('series_set_number', { ascending: true })
    .order('figure_index',       { ascending: true });

  type CmfRow = { figure_number: string; series_set_number: string; name: string; year: number | null; image_url: string | null; series_name: string; figure_index: number };

  // Group by series_set_number, preserving figure order
  const bySeriesMap = new Map<string, SeriesData>();
  for (const row of (rawRows ?? []) as CmfRow[]) {
    if (!bySeriesMap.has(row.series_set_number)) {
      bySeriesMap.set(row.series_set_number, {
        theme:   row.series_name,
        year:    row.year ?? 0,
        figures: [],
        prices:  [],
      });
    }
    bySeriesMap.get(row.series_set_number)!.figures.push({
      set_number: row.figure_number,
      name:       row.name,
      image_url:  row.image_url ?? null,
    });
  }

  // Build SeriesData[], newest year first; track series_set_number → index for price mapping
  const seriesSetToIdx = new Map<string, number>();
  const seriesList: SeriesData[] = Array.from(bySeriesMap.entries())
    .sort(([, a], [, b]) => b.year - a.year || b.theme.localeCompare(a.theme))
    .map(([key, val], i) => { seriesSetToIdx.set(key, i); return val; });

  // Fetch store prices by base series set_number (blind-bag level, not individual figures)
  const allSeriesNums = Array.from(bySeriesMap.keys());
  if (allSeriesNums.length > 0) {
    const { data: priceRows } = await supabase
      .from('store_prices')
      .select('set_id, store_id, price_inr')
      .eq('in_stock', true)
      .not('price_inr', 'is', null)
      .in('set_id', allSeriesNums);

    for (const p of (priceRows ?? []) as { set_id: string; store_id: string; price_inr: number }[]) {
      const idx = seriesSetToIdx.get(p.set_id);
      if (idx !== undefined) seriesList[idx].prices.push({ store_id: p.store_id, price_inr: p.price_inr });
    }
  }

  const totalFigures = seriesList.reduce((sum, s) => sum + s.figures.length, 0);

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

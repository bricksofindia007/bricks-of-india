import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { searchSets } from '@/lib/rebrickable';

const PAGE_SIZE = 24;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set',
    );
  }
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const theme = searchParams.get('theme') ?? '';
  const priceMin = searchParams.get('price_min') ? parseInt(searchParams.get('price_min')!) : null;
  const priceMax = searchParams.get('price_max') ? parseInt(searchParams.get('price_max')!) : null;

  try {
    const supabase = getSupabase();
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('sets')
      .select('*, prices(*)', { count: 'exact' })
      .order('year', { ascending: false })
      .range(from, to);

    if (q) query = query.or(`name.ilike.%${q}%,set_number.ilike.%${q}%`);
    if (theme) query = query.ilike('theme', `%${theme}%`);
    if (priceMin !== null) query = query.gte('lego_mrp_inr', priceMin);
    if (priceMax !== null) query = query.lte('lego_mrp_inr', priceMax);

    const { data, count, error } = await query;

    if (!error && data && data.length > 0) {
      return NextResponse.json({ sets: data, total: count ?? 0 });
    }

    // Supabase returned nothing — fall back to Rebrickable for plain text searches
    if (q && !theme && priceMin === null && priceMax === null) {
      const result = await searchSets(q, page, PAGE_SIZE);
      if (result.results.length > 0) {
        const sets = result.results.map((s) => ({
          id: s.set_num,
          set_number: s.set_num.replace(/-\d+$/, ''),
          rebrickable_id: s.set_num,
          name: s.name,
          year: s.year,
          theme: '',
          subtheme: null,
          pieces: s.num_parts,
          minifigs: null,
          image_url: s.set_img_url,
          description: null,
          age_range: null,
          lego_mrp_inr: null,
          created_at: '',
          updated_at: '',
          prices: [],
        }));
        return NextResponse.json({ sets, total: result.count });
      }
    }
  } catch (err) {
    console.error('Search API error:', err);
    return NextResponse.json(
      { sets: [], total: 0, error: 'Search failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({ sets: [], total: 0 });
}

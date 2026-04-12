import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { searchSets } from '@/lib/rebrickable';

const PAGE_SIZE = 48;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase env vars');
  }
  return createClient(url, key);
}

/** Strip Rebrickable variant suffix: "75192-1" → "75192" */
function stripSuffix(setNum: string): string {
  return setNum.replace(/-\d+$/, '');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const themeFilter = searchParams.get('theme') ?? '';
  const priceMin = searchParams.get('price_min') ? parseInt(searchParams.get('price_min')!) : null;
  const priceMax = searchParams.get('price_max') ? parseInt(searchParams.get('price_max')!) : null;

  // ── Rebrickable-first path (plain text search, no price filter) ─────────────
  // Price/theme filters can't be applied to Rebrickable, so those go Supabase-only.
  const useRebrickable = !!q && !themeFilter && priceMin === null && priceMax === null;

  if (useRebrickable) {
    try {
      const rbResult = await searchSets(q, page, PAGE_SIZE);

      if (rbResult.results.length > 0) {
        // Hydrate with Supabase price/MRP data where available
        const setNumbers = rbResult.results.map((s) => stripSuffix(s.set_num));

        const supabase = getSupabase();
        const { data: supabaseSets } = await supabase
          .from('sets')
          .select('id, set_number, lego_mrp_inr, age_range, theme, subtheme, minifigs, prices(*)')
          .in('set_number', setNumbers);

        const supabaseMap = new Map<string, any>(
          (supabaseSets ?? []).map((s) => [s.set_number, s]),
        );

        const sets = rbResult.results.map((rb) => {
          const sn = stripSuffix(rb.set_num);
          const sup = supabaseMap.get(sn);
          return {
            id:            sup?.id ?? rb.set_num,
            set_number:    sn,
            rebrickable_id: rb.set_num,
            name:          rb.name,
            year:          rb.year,
            theme:         sup?.theme ?? '',
            subtheme:      sup?.subtheme ?? null,
            pieces:        rb.num_parts ?? null,
            minifigs:      sup?.minifigs ?? null,
            image_url:     rb.set_img_url ?? null,
            description:   null,
            age_range:     sup?.age_range ?? null,
            lego_mrp_inr:  sup?.lego_mrp_inr ?? null,
            created_at:    '',
            updated_at:    '',
            prices:        sup?.prices ?? [],
          };
        });

        return NextResponse.json({ sets, total: rbResult.count });
      }
    } catch (err) {
      console.error('[Search] Rebrickable search error:', err);
      // Fall through to Supabase
    }
  }

  // ── Supabase fallback — used when: ──────────────────────────────────────────
  //   • theme or price filter is active (Rebrickable has no filter API)
  //   • Rebrickable returned 0 results or errored
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
    if (themeFilter) query = query.ilike('theme', `%${themeFilter}%`);
    if (priceMin !== null) query = query.gte('lego_mrp_inr', priceMin);
    if (priceMax !== null) query = query.lte('lego_mrp_inr', priceMax);

    const { data, count, error } = await query;

    if (error) {
      console.error('[Search] Supabase error:', error.message);
      return NextResponse.json({ sets: [], total: 0, error: 'Search failed' }, { status: 500 });
    }

    return NextResponse.json({ sets: data ?? [], total: count ?? 0 });
  } catch (err) {
    console.error('[Search] Fatal error:', err);
    return NextResponse.json({ sets: [], total: 0, error: 'Search failed' }, { status: 500 });
  }
}

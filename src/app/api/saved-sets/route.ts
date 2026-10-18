import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '@/lib/get-secret';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { isSetNumber, PRICE_READ_CAP } from '@/lib/my-collection';

// Today's best price and store for the sets in a visitor's My Collection, one call per page view.
// Returns the best price, its store ids, and store names. Nothing else. Names and pieces come from
// the visitor's own copy. Off while the My Collection flag is off (404). At most PRICE_READ_CAP sets per call.
// If prices cannot be read, the page says so and still shows names and pieces.

const SITE_HOSTS = new Set(['bricksofindia.com', 'www.bricksofindia.com']);

/** Only requests from the site itself. */
function siteOnly(req: NextRequest): boolean {
  const sfs = req.headers.get('sec-fetch-site');
  if (sfs) return sfs === 'same-origin';
  const ref = req.headers.get('referer');
  if (!ref) return false;
  try {
    const host = new URL(ref).host;
    return SITE_HOSTS.has(host) || host === req.nextUrl.host;
  } catch {
    return false;
  }
}

/**
 * The only place this route gets a database key: a read-only key. Without it, the route answers unavailable.
 */
function priceReader() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const limited = getSecret('SUPABASE_PRICE_READER_KEY');
  if (url && limited) return createClient(url, limited, { auth: { persistSession: false } });
  return null;
}

export async function GET(request: NextRequest) {
  if (!FEATURE_FLAGS.myCollectionPage) return new NextResponse(null, { status: 404 });
  if (!siteOnly(request)) return new NextResponse(null, { status: 403 });

  const raw = (request.nextUrl.searchParams.get('ids') ?? '').split(',').map((s) => s.trim());
  const ids = [...new Set(raw.filter(isSetNumber))].sort();
  if (ids.length > PRICE_READ_CAP) return NextResponse.json({ error: 'too many sets' }, { status: 400 });

  const sb = priceReader();
  if (!sb) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  const prices = new Map<string, { best_price_inr: number | null; best_store_ids: string[] | null }>();
  let storeNames: Record<string, string> = {};
  if (ids.length) {
    const { data, error } = await sb.from('set_price_summary').select('set_id, best_price_inr, best_store_ids').in('set_id', ids);
    if (error) {
      console.error('[my-collection] price read failed:', error.message);
      return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    }
    for (const r of data ?? []) {
      prices.set(r.set_id, { best_price_inr: r.best_price_inr == null ? null : Number(r.best_price_inr), best_store_ids: r.best_store_ids ?? null });
    }
    // Store names come from the store list, not from this file. If that read fails, the ids are shown as they are.
    const reg = await sb.from('stores').select('id, name').eq('display_enabled', true);
    if (!reg.error) storeNames = Object.fromEntries((reg.data ?? []).map((s) => [s.id, s.name]));
  }

  const sets = ids.map((set) => ({
    set_number: set,
    ...(prices.get(set) ?? { best_price_inr: null, best_store_ids: null }),
  }));

  return NextResponse.json({ sets, store_names: storeNames }, { headers: { 'Cache-Control': 'private, max-age=300', Vary: 'Sec-Fetch-Site, Referer' } });
}

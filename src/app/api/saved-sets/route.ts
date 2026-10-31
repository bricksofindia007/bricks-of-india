import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '@/lib/get-secret';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { isSetNumber, PRICE_READ_CAP } from '@/lib/my-collection';
import { loadStoredRate } from '@/lib/usd-rate-server';

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
  const usd = new Map<string, number>();
  const stored = new Map<string, number>();
  // The LEGO India list price (lego_mrp_inr), for every set that has one (order 0350 item 2: the rule counts it).
  const listPrice = new Map<string, number>();
  // Retired flag from the sets table. Unknown (null) when that read fails: the page then never treats a set as retired.
  const retired = new Map<string, boolean>();
  // Release year, for the pre-2020 rule (D-2026-10-30-09). Null when unknown.
  const year = new Map<string, number>();
  if (ids.length) {
    const { data, error } = await sb.from('set_price_summary').select('set_id, best_price_inr, best_store_ids').in('set_id', ids);
    if (error) {
      console.error('[my-collection] price read failed:', error.message);
      return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    }
    for (const r of data ?? []) {
      prices.set(r.set_id, { best_price_inr: r.best_price_inr == null ? null : Number(r.best_price_inr), best_store_ids: r.best_store_ids ?? null });
    }
    // US retail price in dollars, for worth estimates. Until the column exists, or if it cannot be read,
    // there are no US prices: the total says so by not counting them, and the prices above are unaffected.
    // The stored rupee estimate is a fallback for the page only; it is never a price and is never summed.
    // The stored rupee figure is an estimate worked out from the US price. It is used only for rows that are not
    // verified, and is returned under an estimate field, never as a price.
    const us = await sb.from('sets').select('set_number, us_price_usd, lego_mrp_inr, mrp_verified, retired, year').in('set_number', ids);
    if (us.error) console.error('[my-collection] US price read unavailable:', us.error.message);
    else for (const r of us.data ?? []) {
      retired.set(r.set_number, r.retired === true);
      if (r.year != null) year.set(r.set_number, Number(r.year));
      if (r.us_price_usd != null) usd.set(r.set_number, Number(r.us_price_usd));
      // Verified LEGO India price (mrp_verified true) is the list price. An unverified one is a US-based estimate.
      if (r.lego_mrp_inr != null && r.mrp_verified === true) listPrice.set(r.set_number, Number(r.lego_mrp_inr));
      if (r.lego_mrp_inr != null && r.mrp_verified !== true) stored.set(r.set_number, Number(r.lego_mrp_inr));
    }
    // Store names come from the store list, not from this file. If that read fails, the ids are shown as they are.
    const reg = await sb.from('stores').select('id, name').eq('display_enabled', true);
    if (!reg.error) storeNames = Object.fromEntries((reg.data ?? []).map((s) => [s.id, s.name]));
  }

  const sets = ids.map((set) => ({
    set_number: set,
    ...(prices.get(set) ?? { best_price_inr: null, best_store_ids: null }),
    us_price_usd: usd.get(set) ?? null,
    stored_estimate_inr: stored.get(set) ?? null,
    list_price_inr: listPrice.get(set) ?? null,
    retired: retired.get(set) ?? null,
    year: year.get(set) ?? null,
  }));

  // The stored USD to INR rate, for estimates only. A failed or unset read is null: the page then shows no estimate.
  let usdInr: Awaited<ReturnType<typeof loadStoredRate>> = null;
  if (ids.length) {
    try { usdInr = await loadStoredRate(); } catch (e) { console.error('[my-collection] rate read unavailable:', (e as Error).message); }
  }
  return NextResponse.json({ sets, store_names: storeNames, usd_inr: usdInr }, { headers: { 'Cache-Control': 'private, max-age=300', Vary: 'Sec-Fetch-Site, Referer' } });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '@/lib/get-secret';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { isSetNumber, PRICE_READ_CAP } from '@/lib/my-collection';

// Last observed Indian price and its date, for up to 150 sets. Output is only { set_number, price_inr, observed_at }
// per set: no other price-table column is ever returned.
// Off while the My Collection flag is off (404). Only requests from the site itself are answered.
// A failed read, or no read key, answers 503: the page then shows the approved line, never a guess.
// Limits: at most PRICE_READ_CAP sets per call (150), responses cached for an hour, privately.
// TODO after release: add a Cloudflare rate rule on this path. It is not in code, by design (rules live at the edge).

const LAST_SEEN_MAX_IDS = PRICE_READ_CAP;
const LAST_SEEN_CACHE_SECONDS = 3600;
const SITE_HOSTS = new Set(['bricksofindia.com', 'www.bricksofindia.com']);

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

/** The read key. The function is granted to the server role only (see the migration). Without the key: unavailable. */
function reader() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getSecret('SUPABASE_PRICE_READER_KEY');
  if (url && key) return createClient(url, key, { auth: { persistSession: false } });
  return null;
}

export async function GET(request: NextRequest) {
  if (!FEATURE_FLAGS.myCollectionPage) return new NextResponse(null, { status: 404 });
  if (!siteOnly(request)) return new NextResponse(null, { status: 403 });

  const ids = [...new Set((request.nextUrl.searchParams.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
  if (ids.length > LAST_SEEN_MAX_IDS) return NextResponse.json({ error: `at most ${LAST_SEEN_MAX_IDS} sets` }, { status: 400 });
  const valid = ids.filter(isSetNumber);

  const headers = { 'Cache-Control': `private, max-age=${LAST_SEEN_CACHE_SECONDS}`, Vary: 'Sec-Fetch-Site' };
  if (valid.length === 0) return NextResponse.json({ prices: [] }, { headers });

  const sb = reader();
  if (!sb) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  const { data, error } = await sb.rpc('get_last_seen_prices', { p_set_numbers: valid });
  if (error) {
    console.error('[last-seen] read failed:', error.message);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
  const prices = ((data ?? []) as Array<{ set_id: string; price_inr: number; observed_at: string }>).map((r) => ({
    set_number: String(r.set_id),
    price_inr: Number(r.price_inr),
    observed_at: r.observed_at,
  }));
  return NextResponse.json({ prices }, { headers });
}

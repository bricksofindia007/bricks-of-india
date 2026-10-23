import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '@/lib/get-secret';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { isStandeeTag } from '@/lib/standee';

// Counts one standee visit for a tag on the closed list. One write per call. Off while the standee flag is off (404).
// Failure behaviour: any problem with the write is logged with a fixed message and the answer is still 204, so the
// visitor's page is never affected. Bad input is refused with 400 and nothing is written. Never cached.
export async function POST(req: NextRequest) {
  if (!FEATURE_FLAGS.standeeTracking) return new NextResponse(null, { status: 404 });
  let body: unknown;
  try { body = await req.json(); } catch { return new NextResponse(null, { status: 400 }); }
  const tag = (body as { tag?: unknown } | null)?.tag;
  if (!isStandeeTag(tag)) return new NextResponse(null, { status: 400 });
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const key = getSecret('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('missing settings');
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await sb.rpc('record_standee_visit', { p_tag: tag });
    if (error) console.error('[standee] count not recorded');
  } catch {
    console.error('[standee] count not recorded');
  }
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

// POST /api/revalidate (FP1.6 §3): the snapshot publisher asks for the pages
// of sets that changed (first listing, last listing gone, price/stock change)
// to be regenerated now instead of at their time-based TTL. Signed; see
// src/lib/snapshot/revalidate-auth.ts. Failure behaviour (G14): any failure
// returns 401 and revalidates nothing; pages then wait for their TTL and show
// "as of {time}", older but never wrong.
import { revalidatePath, revalidateTag } from 'next/cache';
import { getSecret } from '@/lib/get-secret';
import { verifyRevalidate, rememberNonce } from '@/lib/snapshot/revalidate-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.text();
  const nowS = Math.floor(Date.now() / 1000);
  const v = await verifyRevalidate({
    key: getSecret('SITE_REVALIDATE_HMAC_KEY') ?? undefined,
    ts: req.headers.get('x-boi-ts'), nonce: req.headers.get('x-boi-nonce'), sig: req.headers.get('x-boi-sig'),
    body, nowS, seenNonce: (n) => rememberNonce(n, nowS),
  });
  if (!v.ok) {
    console.log(`revalidate rejected: ${v.reason}`);
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: { 'x-robots-tag': 'noindex' } });
  }
  for (const t of v.tags) revalidateTag(t);
  for (const p of v.paths) revalidatePath(p);
  return Response.json({ revalidated: { paths: v.paths.length, tags: v.tags.length } }, { headers: { 'x-robots-tag': 'noindex' } });
}

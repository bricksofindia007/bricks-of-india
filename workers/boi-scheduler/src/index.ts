// boi-scheduler (FP1.1 PR 1 + FP5.9, approved P5 Step 5; ADR 0003). A small, separate Worker:
//  - POST /publish: the ONLY writer of the snapshot KV namespace (HMAC-signed, see auth.ts)
//  - GET  /health:  its own heartbeat + the latest snapshot heartbeat (no secrets)
//  - cron: writes its own heartbeat (G13) and, when enabled, dispatches one scrape per retailer (FP5.9)
// The site Worker only ever READS this namespace (PR 2). A site deploy can't break publishing, and
// publishing can't break the site.
//
// Failure behaviour (G14):
//  - an auth/validation failure returns 401 and writes nothing;
//  - a KV write error after validation returns 500. meta:heartbeat is written LAST, so a partly
//    written batch leaves the old heartbeat, and readers treat the snapshot as not fresh and fall back.
//  - The dispatcher is inert unless BOTH the BOI_SCHEDULER_DISPATCH_TOKEN secret exists AND
//    flag:v1.dispatch_enabled is true (set only after Abhinav confirms the token, P5).
import { verifyAndParse } from './auth';

export interface Env {
  BOI_SNAPSHOTS: KVNamespace;
  SNAPSHOT_HMAC_KEY?: string;
  BOI_SCHEDULER_DISPATCH_TOKEN?: string;
  TARGET: string;            // 'production' | 'staging' (from wrangler vars)
  GITHUB_REPO: string;       // 'bricksofindia007/bricks-of-india'
}

const VERSION = 'boi-scheduler/1';
// FP5.9: one cron per retailer, offset so they don't pile up. The cron expression maps to the store.
const CRON_STORE: Record<string, string> = { '0 */6 * * *': 'mybrickhouse', '5 */6 * * *': 'toycra' };
const NONCE_TTL_S = 600;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'x-robots-tag': 'noindex' } });

async function publish(req: Request, env: Env): Promise<Response> {
  const body = await req.text();
  const v = await verifyAndParse({
    key: env.SNAPSHOT_HMAC_KEY, ts: req.headers.get('x-boi-ts'), nonce: req.headers.get('x-boi-nonce'),
    sig: req.headers.get('x-boi-sig'), body, nowS: Math.floor(Date.now() / 1000),
  });
  if (!v.ok) { console.log(`publish rejected: ${v.reason}`); return json(401, { error: 'unauthorized' }); }
  const nonceKey = `meta:nonce:${req.headers.get('x-boi-nonce')}`;
  if (await env.BOI_SNAPSHOTS.get(nonceKey)) { console.log('publish rejected: reused nonce'); return json(401, { error: 'unauthorized' }); }
  await env.BOI_SNAPSHOTS.put(nonceKey, '1', { expirationTtl: NONCE_TTL_S });
  try {
    for (const w of v.writes) await env.BOI_SNAPSHOTS.put(w.key, JSON.stringify(w.value));
  } catch (e) {
    console.log(`publish write error after validation: ${(e as Error).message}`);
    return json(500, { error: 'write failed; heartbeat not advanced' });
  }
  return json(200, { written: v.writes.length });
}

async function health(env: Env): Promise<Response> {
  const [self, snap] = await Promise.all([env.BOI_SNAPSHOTS.get('meta:scheduler:heartbeat', 'json'), env.BOI_SNAPSHOTS.get('meta:heartbeat', 'json')]);
  return json(200, { version: VERSION, target: env.TARGET, scheduler: self ?? null, snapshot: snap ?? null });
}

async function dispatch(env: Env, store: string, slot: string): Promise<void> {
  const flags = ((await env.BOI_SNAPSHOTS.get('flag:v1', 'json')) ?? {}) as { dispatch_enabled?: boolean };
  if (!env.BOI_SCHEDULER_DISPATCH_TOKEN || flags.dispatch_enabled !== true || env.TARGET !== 'production') return; // inert
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/scrape-prices.yml/dispatches`;
  let status = 0;
  for (const waitS of [0, 30, 90]) {  // retry twice (FP5.9)
    if (waitS) await new Promise((r) => setTimeout(r, waitS * 1000));
    const r = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${env.BOI_SCHEDULER_DISPATCH_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': VERSION, 'content-type': 'application/json' },
      body: JSON.stringify({ ref: 'main', inputs: { store } }) });
    status = r.status;
    if (r.ok) break;
  }
  const note = { slot, store, dispatched_at: new Date().toISOString(), http_status: status };
  await env.BOI_SNAPSHOTS.put(`meta:dispatch:${store}`, JSON.stringify(note));
  if (status < 200 || status >= 300) await env.BOI_SNAPSHOTS.put('meta:dispatch_fail', JSON.stringify(note));
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (req.method === 'POST' && pathname === '/publish') return publish(req, env);
    if (req.method === 'GET' && pathname === '/health') return health(env);
    return json(404, { error: 'not found' });
  },
  async scheduled(ev: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const slot = new Date(ev.scheduledTime).toISOString();
    await env.BOI_SNAPSHOTS.put('meta:scheduler:heartbeat', JSON.stringify({ at: new Date().toISOString(), slot, cron: ev.cron, version: VERSION, target: env.TARGET }));
    const store = CRON_STORE[ev.cron];
    if (store) ctx.waitUntil(dispatch(env, store, slot));
  },
};

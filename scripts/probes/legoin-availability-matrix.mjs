#!/usr/bin/env node
/**
 * lego.in availability matrix (#450, P14 Phase 1.2). READ-ONLY.
 *
 * Why the live scraper reads every MyBrickHouse/lego.in variant as
 * available:false on a GitHub runner while curl on the same runner reads
 * ~97% true. Fetches products.json page 1 once per case, changing one
 * variable at a time (host, client, request headers), and records for each
 * case: redirect hops with status, all response headers (cookie NAMES only),
 * body sha256, products, variants, available true/false.
 *
 * Writes nothing anywhere except the local --out directory. No database, no
 * secrets, no IndexNow. ~1 GET per case, 2 s apart.
 *
 * Usage: node scripts/probes/legoin-availability-matrix.mjs --out <dir>
 *          [--only <regex on case id>] [--with-sequence]
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fetchAllProducts } from '../lib/retailer-fetch.mjs';

const args = process.argv.slice(2);
const OUT = args[args.indexOf('--out') + 1] || 'out/legoin-matrix';
fs.mkdirSync(OUT, { recursive: true });
const ONLY = args.includes('--only') ? new RegExp(args[args.indexOf('--only') + 1]) : null;
const WITH_SEQUENCE = args.includes('--with-sequence');

const SCRAPER_UA = 'BricksOfIndia/1.0 (+https://bricksofindia.com)'; // scripts/lib/retailer-fetch.mjs:52
const SCRAPER_HEADERS = { 'User-Agent': SCRAPER_UA, Accept: 'application/json' };
const HOSTS = { old: 'lego.mybrickhouse.com', new: 'lego.in' };
const PAUSE_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// ── What does Node's fetch actually send? Capture it on a loopback server. ──
async function captureNodeFetchHeaders(headers) {
  let seen;
  const srv = http.createServer((req, res) => { seen = req.headers; res.end('{}'); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const { port } = srv.address();
  await fetch(`http://127.0.0.1:${port}/`, { headers });
  srv.close();
  return seen;
}
async function captureCurlHeaders(curlArgs) {
  let seen;
  const srv = http.createServer((req, res) => { seen = req.headers; res.end('{}'); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const { port } = srv.address();
  await new Promise((resolve) => {
    import('node:child_process').then(({ execFile }) =>
      execFile('curl', ['-s', '-o', process.platform === 'win32' ? 'NUL' : '/dev/null', ...curlArgs, `http://127.0.0.1:${port}/`], () => resolve()));
  });
  srv.close();
  return seen;
}

function summarise(body) {
  let json;
  try { json = JSON.parse(body.toString('utf8')); } catch { return { json: false }; }
  const products = json.products ?? [];
  let variants = 0, t = 0, f = 0;
  for (const p of products) for (const v of p.variants ?? []) { variants++; if (v.available === true) t++; else if (v.available === false) f++; }
  return { json: true, products: products.length, variants, available_true: t, available_false: f };
}
function headerList(h) {
  // h: array of [name, value]; cookie values never recorded.
  return h.map(([k, v]) => (k.toLowerCase() === 'set-cookie' ? [k, `${String(v).split('=')[0]}=<value not recorded>`] : [k, v]));
}

// ── Node fetch case: manual redirect walk so every hop is recorded ──
async function nodeCase(url, headers) {
  const hops = [];
  let current = url, res;
  for (let i = 0; i < 6; i++) {
    res = await fetch(current, { headers, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    const loc = res.headers.get('location');
    hops.push({ url: current, status: res.status, location: loc });
    if (res.status >= 300 && res.status < 400 && loc) { await res.arrayBuffer(); current = new URL(loc, current).href; continue; }
    break;
  }
  const body = Buffer.from(await res.arrayBuffer());
  const hdrs = [];
  res.headers.forEach((v, k) => { if (k !== 'set-cookie') hdrs.push([k, v]); });
  for (const c of res.headers.getSetCookie?.() ?? []) hdrs.push(['set-cookie', c]);
  return { hops, response_headers: headerList(hdrs), body };
}

// ── curl case: -D per hop via --location + --dump-header ──
function curlCase(url, curlArgs, tag) {
  const bodyFile = path.join(OUT, `${tag}.body`);
  const hdrFile = path.join(OUT, `${tag}.hdr`);
  const w = execFileSync('curl', ['-s', '-L', '--max-redirs', '5', '--max-time', '30', '-D', hdrFile, '-o', bodyFile,
    '-w', '%{http_code} %{num_redirects} %{url_effective}', ...curlArgs, url]).toString();
  const raw = fs.readFileSync(hdrFile, 'utf8');
  fs.unlinkSync(hdrFile);
  const blocks = raw.split(/\r?\n\r?\n/).filter((b) => b.trim());
  const hops = [], all = [];
  for (const b of blocks) {
    const lines = b.split(/\r?\n/);
    const status = Number((lines[0].match(/^HTTP\/\S+\s+(\d+)/) || [])[1]);
    const hs = lines.slice(1).map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim().toLowerCase(), l.slice(i + 1).trim()]; });
    hops.push({ status, location: (hs.find(([k]) => k === 'location') || [])[1] ?? null });
    all.push(hs);
  }
  const body = fs.readFileSync(bodyFile);
  fs.unlinkSync(bodyFile);
  return { hops, response_headers: headerList(all.at(-1) ?? []), curl_write_out: w, body };
}

async function main() {
  const env = {
    started_at: new Date().toISOString(),
    runner: process.env.GITHUB_ACTIONS ? `github ${process.env.RUNNER_OS} ${process.env.RUNNER_ARCH}` : 'local',
    node: process.version,
    curl: execFileSync('curl', ['--version']).toString().split('\n')[0],
  };
  const sent = {
    node_scraper_headers: await captureNodeFetchHeaders(SCRAPER_HEADERS),
    node_no_extra: await captureNodeFetchHeaders({}),
    curl_default: await captureCurlHeaders([]),
    curl_scraper_headers: await captureCurlHeaders(['-A', SCRAPER_UA, '-H', 'Accept: application/json']),
  };
  // Node's own defaults beyond what we set -- the candidate variables for curl.
  const nd = sent.node_scraper_headers;
  const NODE_EXTRAS = { 'accept-language': nd['accept-language'], 'sec-fetch-mode': nd['sec-fetch-mode'], 'accept-encoding': nd['accept-encoding'] };
  const curlH = (h) => Object.entries(h).filter(([, v]) => v != null).flatMap(([k, v]) => ['-H', `${k}: ${v}`]);
  const scraperCurl = ['-A', SCRAPER_UA, '-H', 'Accept: application/json'];

  const cases = [];
  for (const [hk, host] of Object.entries(HOSTS)) {
    const url = `https://${host}/products.json?limit=250&page=1`;
    // Node client
    cases.push({ id: `${hk}.node.scraper-fn`, host, client: 'node: fetchAllProducts() (scraper function, all pages)', run: async () => {
      const t0 = Date.now(); const products = await fetchAllProducts(host, '/products.json');
      const body = Buffer.from(JSON.stringify({ products }));
      return { hops: [{ note: 'fetchAllProducts follows redirects itself (fetch default redirect:"follow"); see the node.scraper-headers case for hops' }], response_headers: [], body, ms: Date.now() - t0 };
    } });
    cases.push({ id: `${hk}.node.scraper-headers`, host, client: 'node fetch', headers: 'scraper (UA + Accept json)', run: () => nodeCase(url, SCRAPER_HEADERS) });
    cases.push({ id: `${hk}.node.curl-headers`, host, client: 'node fetch', headers: "curl's (UA curl/x, Accept */*)", run: () => nodeCase(url, { 'User-Agent': sent.curl_default['user-agent'], Accept: '*/*' }) });
    cases.push({ id: `${hk}.node.no-extra`, host, client: 'node fetch', headers: 'none set by us', run: () => nodeCase(url, {}) });
    // curl client
    cases.push({ id: `${hk}.curl.scraper-headers`, host, client: 'curl', headers: 'scraper (UA + Accept json)', run: () => curlCase(url, scraperCurl, `${hk}-curl-scraper`) });
    cases.push({ id: `${hk}.curl.default`, host, client: 'curl', headers: "curl's defaults", run: () => curlCase(url, [], `${hk}-curl-default`) });
    // curl + node's extra defaults, one at a time, then all together
    for (const [k, v] of Object.entries(NODE_EXTRAS)) {
      if (v == null) continue;
      cases.push({ id: `${hk}.curl.scraper+${k}`, host, client: 'curl', headers: `scraper + ${k}: ${v}`, run: () => curlCase(url, [...scraperCurl, ...curlH({ [k]: v }), ...(k === 'accept-encoding' ? ['--compressed'] : [])], `${hk}-curl-${k}`) });
    }
    cases.push({ id: `${hk}.curl.scraper+all-node-extras`, host, client: 'curl', headers: 'scraper + every node default', run: () => curlCase(url, [...scraperCurl, ...curlH(NODE_EXTRAS), '--compressed'], `${hk}-curl-allnode`) });
  }

  // The live scraper's exact order (scrape-now.mjs:167-172): supabase-js loaded,
  // Toycra's feed fetched first, then MyBrickHouse, through fetchAllProducts.
  if (WITH_SEQUENCE) {
    cases.push({ id: 'seq.scrape-now-order', host: HOSTS.old, client: 'fetchAllProducts: toycra then lego.mybrickhouse.com (scrape-now order)', run: async () => {
      await import('@supabase/supabase-js'); // loaded, never instantiated (no secrets)
      const toycra = await fetchAllProducts('www.toycra.com', '/collections/lego/products.json');
      await sleep(400);
      const products = await fetchAllProducts(HOSTS.old, '/products.json');
      return { hops: [{ note: `toycra fetched first: ${toycra.length} products` }], response_headers: [], body: Buffer.from(JSON.stringify({ products })) };
    } });
  }

  const selected = ONLY ? cases.filter((c) => ONLY.test(c.id)) : cases;
  const results = [];
  for (const c of selected) {
    let r;
    try { r = await c.run(); } catch (e) { r = { error: String(e.message ?? e) }; }
    const row = { id: c.id, host: c.host, client: c.client, headers: c.headers ?? 'scraper', at: new Date().toISOString(), ...r };
    if (r.body) { row.body_sha256 = sha256(r.body); row.body_bytes = r.body.length; Object.assign(row, summarise(r.body)); delete row.body; }
    results.push(row);
    console.log(`${row.id.padEnd(40)} hops=${JSON.stringify((row.hops || []).map((h) => h.status ?? '-'))} products=${row.products ?? '-'} variants=${row.variants ?? '-'} true=${row.available_true ?? '-'} false=${row.available_false ?? '-'} sha=${(row.body_sha256 || '').slice(0, 12)}${row.error ? ' ERROR ' + row.error : ''}`);
    await sleep(PAUSE_MS);
  }
  env.runtime = process.env.MATRIX_RUNTIME || 'node';
  fs.writeFileSync(path.join(OUT, 'matrix.json'),JSON.stringify({ env, request_headers_sent: sent, cases: results }, null, 2));
  console.log('\nrequest headers actually sent (captured on loopback):');
  for (const [k, v] of Object.entries(sent)) console.log(`  ${k}: ${JSON.stringify(v)}`);
  console.log(`\nwrote ${path.join(OUT, 'matrix.json')}`);
}
main().catch((e) => { console.error(e); process.exit(1); });

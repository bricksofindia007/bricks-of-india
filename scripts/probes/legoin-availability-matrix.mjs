#!/usr/bin/env node
/**
 * lego.in availability matrix (#450, P14 Phase 1.2-1.5). READ-ONLY.
 *
 * Why the live scraper reads every MyBrickHouse/lego.in variant as
 * available:false on a GitHub runner while curl on a runner reads ~97% true.
 * Every case runs back to back in this one process (so one runner, one job),
 * changing one variable at a time (host, client, request headers). The first
 * case is the live scraper's exact order: its own fetchAllProducts(), Toycra
 * first, then MyBrickHouse (scrape-now.mjs:167-172).
 *
 * Per case: runner public IP (echo service, fetched right before the case),
 * UTC time, redirect hops with status, ALL response headers of every page
 * (cookie NAMES only), body sha256, products, variants, available true/false.
 * Page 1's raw body is saved for any case that reads all unavailable, plus one
 * good reference body, and the two are diffed field by field.
 *
 * Writes nothing anywhere except the local --out directory. No database, no
 * secrets, no IndexNow. ~1 GET per case, 2 s apart.
 *
 * Usage: node scripts/probes/legoin-availability-matrix.mjs --out <dir>
 */
import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fetchAllProducts } from '../lib/retailer-fetch.mjs';

const args = process.argv.slice(2);
const OUT = args[args.indexOf('--out') + 1] || 'out/legoin-matrix';
const BODIES = path.join(OUT, 'bodies');
fs.mkdirSync(BODIES, { recursive: true });

const SCRAPER_UA = 'BricksOfIndia/1.0 (+https://bricksofindia.com)'; // scripts/lib/retailer-fetch.mjs:52
const SCRAPER_HEADERS = { 'User-Agent': SCRAPER_UA, Accept: 'application/json' };
const HOSTS = { old: 'lego.mybrickhouse.com', new: 'lego.in' };
const IP_ECHO = 'https://api.ipify.org?format=json';
const PAUSE_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const NULL_DEV = process.platform === 'win32' ? 'NUL' : '/dev/null';

function publicIp() {
  try { return JSON.parse(execFileSync('curl', ['-s', '--max-time', '10', IP_ECHO]).toString()).ip; }
  catch (e) { return `unavailable (${e.message})`; }
}

// What does each client actually send? Capture it on a loopback server.
async function captureOnLoopback(send) {
  let seen;
  const srv = http.createServer((req, res) => { seen = req.headers; res.end('{}'); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${srv.address().port}/`;
  await send(url);
  srv.close();
  delete seen.host;
  return seen;
}
// Async: a sync exec would block this process's own loopback server.
const curlSend = (curlArgs) => (url) => new Promise((resolve) => execFile('curl', ['-s', '--max-time', '10', '-o', NULL_DEV, ...curlArgs, url], () => resolve()));

function counts(body) {
  let json;
  try { json = JSON.parse(body.toString('utf8')); } catch { return { json: false }; }
  const products = json.products ?? [];
  let variants = 0, t = 0, f = 0;
  for (const p of products) for (const v of p.variants ?? []) { variants++; if (v.available === true) t++; else if (v.available === false) f++; }
  return { json: true, products: products.length, variants, available_true: t, available_false: f };
}
const maskCookies = (pairs) => pairs.map(([k, v]) => (k.toLowerCase() === 'set-cookie' ? [k, `${String(v).split('=')[0]}=<value not recorded>`] : [k, v]));
function fetchHeaders(res) {
  const out = [];
  res.headers.forEach((v, k) => { if (k !== 'set-cookie') out.push([k, v]); });
  for (const c of res.headers.getSetCookie?.() ?? []) out.push(['set-cookie', c]);
  return maskCookies(out);
}

// The scraper's own function, unchanged: wrap globalThis.fetch only to observe
// each response (status, final URL, headers, body sha256, page-1 body).
async function scraperFn(domain, pathName) {
  const pages = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const res = await realFetch(input, init);
    const buf = Buffer.from(await res.clone().arrayBuffer());
    pages.push({ url: String(input), status: res.status, redirected: res.redirected, final_url: res.url, response_headers: fetchHeaders(res), body_sha256: sha256(buf), ...counts(buf), _body: buf });
    return res;
  };
  try { await fetchAllProducts(domain, pathName); } finally { globalThis.fetch = realFetch; }
  return pages;
}

async function nodeCase(url, headers) {
  const hops = [];
  let current = url, res;
  for (let i = 0; i < 6; i++) {
    res = await fetch(current, { headers, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    const loc = res.headers.get('location');
    hops.push({ url: current, status: res.status, location: loc, response_headers: fetchHeaders(res) });
    if (res.status >= 300 && res.status < 400 && loc) { await res.arrayBuffer(); current = new URL(loc, current).href; continue; }
    break;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return [{ url, status: res.status, final_url: current, hops, response_headers: hops.at(-1).response_headers, body_sha256: sha256(buf), ...counts(buf), _body: buf }];
}

function curlCase(url, curlArgs, tag) {
  const bodyFile = path.join(OUT, `${tag}.body.tmp`);
  const hdrFile = path.join(OUT, `${tag}.hdr.tmp`);
  const w = execFileSync('curl', ['-s', '-L', '--max-redirs', '5', '--max-time', '30', '-D', hdrFile, '-o', bodyFile,
    '-w', '%{http_code} %{num_redirects} %{url_effective}', ...curlArgs, url]).toString();
  const raw = fs.readFileSync(hdrFile, 'utf8');
  const buf = fs.readFileSync(bodyFile);
  fs.unlinkSync(hdrFile); fs.unlinkSync(bodyFile);
  const hops = raw.split(/\r?\n\r?\n/).filter((b) => b.trim()).map((b) => {
    const lines = b.split(/\r?\n/);
    const hs = lines.slice(1).map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim().toLowerCase(), l.slice(i + 1).trim()]; });
    return { status: Number((lines[0].match(/^HTTP\/\S+\s+(\d+)/) || [])[1]), location: (hs.find(([k]) => k === 'location') || [])[1] ?? null, response_headers: maskCookies(hs) };
  });
  const [code, , effective] = w.split(' ');
  return [{ url, status: Number(code), final_url: effective, hops, response_headers: hops.at(-1)?.response_headers ?? [], body_sha256: sha256(buf), ...counts(buf), _body: buf }];
}

// Field-by-field diff of two products.json bodies, matched on product id.
function diffBodies(badBuf, goodBuf) {
  const bad = JSON.parse(badBuf.toString('utf8')).products ?? [];
  const good = new Map((JSON.parse(goodBuf.toString('utf8')).products ?? []).map((p) => [p.id, p]));
  const fields = {}, examples = {};
  const note = (k, id, a, b) => { fields[k] = (fields[k] || 0) + 1; (examples[k] ??= []).length < 3 && examples[k].push({ product_id: id, bad: a, good: b }); };
  let compared = 0, onlyBad = 0;
  for (const p of bad) {
    const g = good.get(p.id); if (!g) { onlyBad++; continue; }
    compared++; good.delete(p.id);
    for (const k of new Set([...Object.keys(p), ...Object.keys(g)])) {
      if (k === 'variants') continue;
      if (JSON.stringify(p[k]) !== JSON.stringify(g[k])) note(`product.${k}`, p.id, p[k], g[k]);
    }
    const gv = new Map((g.variants ?? []).map((v) => [v.id, v]));
    for (const v of p.variants ?? []) {
      const w = gv.get(v.id); if (!w) { note('variant.<missing in good>', p.id, v.id, null); continue; }
      for (const k of new Set([...Object.keys(v), ...Object.keys(w)])) if (JSON.stringify(v[k]) !== JSON.stringify(w[k])) note(`variant.${k}`, p.id, v[k], w[k]);
    }
  }
  return { compared_products: compared, only_in_bad: onlyBad, only_in_good: good.size, differing_fields: fields, examples };
}

async function main() {
  const env = {
    started_at: new Date().toISOString(),
    runtime: process.env.MATRIX_RUNTIME || 'node',
    runner: process.env.GITHUB_ACTIONS ? `github ${process.env.RUNNER_OS} ${process.env.RUNNER_ARCH} ${process.env.ImageOS ?? ''} ${process.env.ImageVersion ?? ''}`.trim() : 'local',
    node: process.version,
    curl: execFileSync('curl', ['--version']).toString().split('\n')[0],
  };
  const sent = {
    node_scraper_headers: await captureOnLoopback((u) => fetch(u, { headers: SCRAPER_HEADERS })),
    node_no_extra: await captureOnLoopback((u) => fetch(u)),
    curl_default: await captureOnLoopback(curlSend([])),
    curl_scraper_headers: await captureOnLoopback(curlSend(['-A', SCRAPER_UA, '-H', 'Accept: application/json'])),
  };
  const nd = sent.node_scraper_headers;
  const NODE_EXTRAS = { 'accept-language': nd['accept-language'], 'sec-fetch-mode': nd['sec-fetch-mode'], 'accept-encoding': nd['accept-encoding'] };
  const curlH = (h) => Object.entries(h).filter(([, v]) => v != null).flatMap(([k, v]) => ['-H', `${k}: ${v}`]);
  const scraperCurl = ['-A', SCRAPER_UA, '-H', 'Accept: application/json'];

  // Case 1 = the live scraper's order: Toycra first, then MyBrickHouse, through its own function.
  const cases = [{ id: 'seq.scrape-now-order', host: HOSTS.old, client: "scraper's fetchAllProducts: toycra then lego.mybrickhouse.com (scrape-now.mjs:167-172)", headers: 'scraper', run: async () => {
    await import('@supabase/supabase-js').catch(() => null); // loaded as scrape-now does, never instantiated (no secrets)
    const toycra = await scraperFn('www.toycra.com', '/collections/lego/products.json');
    const mbh = await scraperFn(HOSTS.old, '/products.json');
    return [...toycra.map((p) => ({ ...p, store: 'toycra' })), ...mbh.map((p) => ({ ...p, store: 'mybrickhouse' }))];
  } }];
  for (const [hk, host] of Object.entries(HOSTS)) {
    const url = `https://${host}/products.json?limit=250&page=1`;
    cases.push({ id: `${hk}.node.scraper-fn`, host, client: "scraper's fetchAllProducts (all pages)", headers: 'scraper', run: () => scraperFn(host, '/products.json') });
    cases.push({ id: `${hk}.node.scraper-headers`, host, client: 'node fetch', headers: 'scraper (UA + Accept json)', run: () => nodeCase(url, SCRAPER_HEADERS) });
    cases.push({ id: `${hk}.node.curl-headers`, host, client: 'node fetch', headers: "curl's (UA curl/x, Accept */*)", run: () => nodeCase(url, { 'User-Agent': sent.curl_default['user-agent'], Accept: '*/*' }) });
    cases.push({ id: `${hk}.node.no-extra`, host, client: 'node fetch', headers: 'none set by us', run: () => nodeCase(url, {}) });
    cases.push({ id: `${hk}.curl.scraper-headers`, host, client: 'curl', headers: 'scraper (UA + Accept json)', run: () => curlCase(url, scraperCurl, `${hk}-curl-scraper`) });
    cases.push({ id: `${hk}.curl.default`, host, client: 'curl', headers: "curl's defaults", run: () => curlCase(url, [], `${hk}-curl-default`) });
    for (const [k, v] of Object.entries(NODE_EXTRAS)) {
      if (v == null) continue;
      cases.push({ id: `${hk}.curl.scraper+${k}`, host, client: 'curl', headers: `scraper + ${k}: ${v}`, run: () => curlCase(url, [...scraperCurl, ...curlH({ [k]: v }), ...(k === 'accept-encoding' ? ['--compressed'] : [])], `${hk}-curl-${k}`) });
    }
    cases.push({ id: `${hk}.curl.scraper+all-node-extras`, host, client: 'curl', headers: 'scraper + every node default', run: () => curlCase(url, [...scraperCurl, ...curlH(NODE_EXTRAS), '--compressed'], `${hk}-curl-allnode`) });
  }

  const results = [];
  let goodRef = null;
  const badPages = [];
  for (const c of cases) {
    const ip = publicIp();
    const at = new Date().toISOString();
    let pages;
    try { pages = await c.run(); } catch (e) { pages = null; results.push({ id: c.id, at, public_ip: ip, error: String(e.message ?? e) }); }
    if (pages) {
      const lego = pages.filter((p) => p.store !== 'toycra');
      const tot = lego.reduce((a, p) => ({ products: a.products + (p.products ?? 0), variants: a.variants + (p.variants ?? 0), t: a.t + (p.available_true ?? 0), f: a.f + (p.available_false ?? 0) }), { products: 0, variants: 0, t: 0, f: 0 });
      const p1 = lego[0];
      if (p1?._body && p1.json) {
        if (p1.available_true === 0) { const file = path.join(BODIES, `${c.id}.page1.json`); fs.writeFileSync(file, p1._body); badPages.push({ id: c.id, file, buf: p1._body }); }
        else if (!goodRef) { const file = path.join(BODIES, `good-reference.${c.id}.page1.json`); fs.writeFileSync(file, p1._body); goodRef = { id: c.id, file, buf: p1._body }; }
      }
      for (const p of pages) delete p._body;
      results.push({ id: c.id, host: c.host, client: c.client, headers: c.headers, runtime: env.runtime, at, public_ip: ip,
        products: tot.products, variants: tot.variants, available_true: tot.t, available_false: tot.f, pages });
      const r = results.at(-1);
      console.log(`${at} ip=${ip} ${c.id.padEnd(36)} products=${r.products} variants=${r.variants} true=${r.available_true} false=${r.available_false} hops=${JSON.stringify(lego.map((p) => (p.hops ?? []).map((h) => h.status).join('>') || (p.redirected ? 'redirected' : p.status)))} sha1=${(p1?.body_sha256 || '').slice(0, 12)}`);
      for (const [k, v] of p1?.response_headers ?? []) if (/^(cf-ray|cf-cache-status|age|vary|x-cache|x-shopify-|set-cookie|content-encoding|server|via|x-sorting-hat|x-request-id|content-language)/i.test(k)) console.log(`      ${k}: ${v}`);
    }
    await sleep(PAUSE_MS);
  }

  const diffs = goodRef ? badPages.map((b) => ({ bad_case: b.id, bad_file: b.file, good_case: goodRef.id, good_file: goodRef.file, ...diffBodies(b.buf, goodRef.buf) })) : [];
  fs.writeFileSync(path.join(OUT, 'matrix.json'), JSON.stringify({ env, request_headers_sent: sent, cases: results, all_unavailable_diffs: diffs }, null, 2));
  console.log('\nrequest headers actually sent (captured on loopback):');
  for (const [k, v] of Object.entries(sent)) console.log(`  ${k}: ${JSON.stringify(v)}`);
  console.log(`\ncases reading all unavailable on page 1: ${badPages.length ? badPages.map((b) => b.id).join(', ') : 'none'}`);
  for (const d of diffs) console.log(`diff ${d.bad_case} vs ${d.good_case}: ${JSON.stringify(d.differing_fields)}`);
  console.log(`wrote ${path.join(OUT, 'matrix.json')}`);
}
main().catch((e) => { console.error(e); process.exit(1); });

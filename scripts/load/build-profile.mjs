#!/usr/bin/env node
// Builds the production load profile for the staging measurement (docs/release/gates/MEASUREMENT.md in bricks-of-india).
// Read-only. Reads the last 7 days of zone request counts from Cloudflare analytics, groups the top request paths into
// the site's route templates, and writes route classes with their request shares. No IP addresses, visitor identifiers
// or query strings are read or written. Assets, API, admin and feed paths are excluded and reported as a count only.
// Env: CLOUDFLARE_API_TOKEN (or CLOUDFLARE_ANALYTICS_TOKEN), CLOUDFLARE_ACCOUNT_ID, ZONE_NAME (default bricksofindia.com),
//      ROUTE_TEMPLATES (path to a JSON array of templates), OUT (output file).
import fs from 'node:fs';

const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';
const COVERAGE_MIN = 0.9;

/** Pure. A route template (for example /sets/[slug]) to a regular expression. [[...x]] matches any depth; [x] matches one segment. */
export function templateToRegex(template) {
  if (template === '/') return /^\/$/;
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);
  const src = escaped
    .replace(/\\\[\\\[\\\.\\\.\\\.[^\]]*\\\]\\\]/g, '.*')   // optional catch-all: [[...path]]
    .replace(/\\\[[^\]]*\\\]/g, '[^/]+');                    // one segment: [param]
  return new RegExp(`^${src}/?$`);
}

/** Pure. Paths that are not visitor page loads: assets, API, admin and feeds. */
export function excluded(path) {
  return /^\/(_next|api|admin|pending)(\/|$)/.test(path)
    || /\.(jpg|jpeg|png|webp|gif|svg|ico|css|js|map|txt|xml|json|woff2?)$/i.test(path);
}

// Paths that match no template are answered by the site's not-found page (probes, scanners, unknown URLs).
// They form one class, so they count toward coverage at their observed share. The denominator is unchanged.
export const NOT_FOUND_CLASS = '(not found)';

/** Pure. Classes counted paths by the most specific matching template. */
export function classify(paths, templates) {
  const ordered = [...templates].sort((a, b) => b.length - a.length);
  const regexes = ordered.map((t) => [t, templateToRegex(t)]);
  const classes = new Map();
  let excludedCount = 0;
  let classifiedCount = 0;
  for (const { path, count } of paths) {
    if (excluded(path)) { excludedCount += count; continue; }
    const hit = regexes.find(([, re]) => re.test(path));
    if (!hit) {
      classes.set(NOT_FOUND_CLASS, (classes.get(NOT_FOUND_CLASS) ?? 0) + count);
      classifiedCount += count;
      continue;
    }
    classes.set(hit[0], (classes.get(hit[0]) ?? 0) + count);
    classifiedCount += count;
  }
  return { classes, excludedCount, classifiedCount };
}

/** Pure. The shape of a path with ids and slugs replaced: a plain lowercase word is kept, anything else becomes [x]. */
export function shapeOf(path) {
  const segs = path.split('/').map((s) => (s === '' || /^[a-z]{1,20}$/.test(s) ? s : '[x]'));
  return segs.join('/') || '/';
}

/** Pure. Unmatched (not excluded, no template) paths grouped by shape: top `limit` by request count. No full paths are returned. */
export function unmatchedShapes(paths, templates, limit = 20) {
  const regexes = templates.map((t) => templateToRegex(t));
  const byShape = new Map();
  for (const { path, count } of paths) {
    if (excluded(path)) continue;
    if (regexes.some((re) => re.test(path))) continue;
    const shape = shapeOf(path);
    byShape.set(shape, (byShape.get(shape) ?? 0) + count);
  }
  return [...byShape.entries()]
    .map(([shape, requests]) => ({ shape, requests }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, limit);
}

export const ROW_LIMIT = 10000;

/** Pure. Response class of an HTTP status: 2xx, 3xx, 4xx, 5xx, or other. */
export function statusClass(code) {
  const n = Number(code);
  if (n >= 200 && n < 300) return '2xx';
  if (n >= 300 && n < 400) return '3xx';
  if (n >= 400 && n < 500) return '4xx';
  if (n >= 500 && n < 600) return '5xx';
  return 'other';
}

/** Pure. Rows of (path, status, count) to one entry per path, with its class split. */
export function aggregatePaths(rows) {
  const byPath = new Map();
  for (const { path, status, count } of rows) {
    let e = byPath.get(path);
    if (!e) { e = { path, count: 0, classes: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 } }; byPath.set(path, e); }
    e.count += count;
    e.classes[statusClass(status)] += count;
  }
  return [...byPath.values()];
}

/** Pure. Unmatched shapes with their class split: top `limit`, and the rest as one total. No full paths. */
export function unmatchedSummary(paths, templates, limit = 60) {
  const regexes = templates.map((t) => templateToRegex(t));
  const byShape = new Map();
  for (const { path, count, classes } of paths) {
    if (excluded(path)) continue;
    if (regexes.some((re) => re.test(path))) continue;
    const shape = shapeOf(path);
    let e = byShape.get(shape);
    if (!e) { e = { shape, requests: 0, classes: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 } }; byShape.set(shape, e); }
    e.requests += count;
    for (const k of Object.keys(e.classes)) e.classes[k] += (classes?.[k] ?? 0);
  }
  const all = [...byShape.values()].sort((a, b) => b.requests - a.requests);
  const top = all.slice(0, limit);
  const rest = all.slice(limit);
  const otherRequests = rest.reduce((a, e) => a + e.requests, 0);
  const classes = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 };
  for (const e of all) for (const k of Object.keys(classes)) classes[k] += e.classes[k];
  const otherClasses = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 };
  for (const e of rest) for (const k of Object.keys(otherClasses)) otherClasses[k] += e.classes[k];
  return { top, classes, others: { shapes: rest.length, requests: otherRequests, classes: otherClasses } };
}

async function gql(token, query, variables) {
  const r = await fetch(GRAPHQL, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors?.length) throw new Error('graphql: ' + j.errors.map((e) => e.message).join('; '));
  return j.data;
}

async function main() {
  const env = process.env;
  const token = env.CLOUDFLARE_ANALYTICS_TOKEN || env.CLOUDFLARE_API_TOKEN;
  const acct = env.CLOUDFLARE_ACCOUNT_ID;
  const zoneName = env.ZONE_NAME || 'bricksofindia.com';
  const out = env.OUT || 'load-profile.json';
  if (!token || !acct) { console.error('analytics token or account id is not set'); return 2; }

  const templates = JSON.parse(fs.readFileSync(env.ROUTE_TEMPLATES || 'route-templates.json', 'utf8'));
  // Zone tag: from ZONE_TAG when given, else from the zones list (read-only REST call).
  let zoneTag = env.ZONE_TAG;
  if (!zoneTag) {
    const r = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(zoneName)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    zoneTag = j.result?.[0]?.id;
    if (!zoneTag) {
      const all = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', { headers: { authorization: `Bearer ${token}` } });
      const names = ((await all.json()).result ?? []).map((z) => z.name);
      throw new Error(`zone ${zoneName} not found (HTTP ${r.status}); zones visible to this token: ${names.length} (${names.join(', ') || 'none'})`);
    }
  }
  const zone = { zoneTag };

  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - 7 * 86400e3);
  const filter = `{ datetime_geq: "${start.toISOString()}", datetime_lt: "${end.toISOString()}" }`;
  const data = await gql(token, `query P($zone: String!) {
    viewer { zones(filter: { zoneTag: $zone }) {
      total: httpRequestsAdaptiveGroups(limit: 1, filter: ${filter}) { count }
      top: httpRequestsAdaptiveGroups(limit: ${ROW_LIMIT}, orderBy: [count_DESC], filter: ${filter}) { count dimensions { clientRequestPath edgeResponseStatus } }
    } } }`, { zone: zone.zoneTag });
  const z = data.viewer.zones[0];
  const total = z.total[0]?.count ?? 0;
  const rows = z.top.map((g) => ({ path: g.dimensions.clientRequestPath, status: g.dimensions.edgeResponseStatus, count: g.count }));
  const paths = aggregatePaths(rows);
  const returned = rows.reduce((a, r) => a + r.count, 0);
  const rowLimitHit = rows.length >= ROW_LIMIT;
  const outside = Math.max(0, total - returned);
  const summary = unmatchedSummary(paths, templates, 60);
  const { classes, excludedCount, classifiedCount } = classify(paths, templates);
  const countable = total - excludedCount;
  const coverage = countable > 0 ? classifiedCount / countable : 0;
  const profile = {
    window: { start: start.toISOString(), end: end.toISOString(), days: 7 },
    total_requests: total,
    excluded_requests: excludedCount,
    coverage: Number(coverage.toFixed(4)),
    classes: [...classes.entries()]
      .map(([template, requests]) => ({ template, requests, share: Number((requests / countable).toFixed(6)) }))
      .sort((a, b) => b.requests - a.requests),
    method: 'Top 10,000 request paths of the zone, grouped by route template; assets, API, admin and feed paths excluded.',
    unmatched_top: summary.top.map((u) => ({ shape: u.shape, requests: u.requests, share: Number((u.requests / countable).toFixed(6)), classes: u.classes })),
    unmatched_classes: summary.classes,
    unmatched_other: { shapes: summary.others.shapes, requests: summary.others.requests, share: Number((summary.others.requests / countable).toFixed(6)), classes: summary.others.classes },
    analytics_rows: { returned: rows.length, row_limit: ROW_LIMIT, row_limit_hit: rowLimitHit, requests_outside_rows: outside, share_outside_rows: Number((outside / Math.max(total, 1)).toFixed(6)) },
  };
  fs.writeFileSync(out, JSON.stringify(profile, null, 2) + '\n');
  console.log(`profile written: ${profile.classes.length} classes, coverage ${(coverage * 100).toFixed(1)}% of ${countable} counted requests`);
  const cls = (c) => `2xx=${c['2xx']} 3xx=${c['3xx']} 4xx=${c['4xx']} 5xx=${c['5xx']} other=${c.other}`;
  console.log(`unmatched traffic by response class: ${cls(summary.classes)}`);
  console.log('unmatched path shapes (top 60, share of counted requests, class split):');
  for (const u of profile.unmatched_top) console.log(`  ${u.shape}  share=${(u.share * 100).toFixed(2)}%  requests=${u.requests}  ${cls(u.classes)}`);
  const o = profile.unmatched_other;
  console.log(`all other shapes: ${o.requests} requests, ${(o.share * 100).toFixed(2)}% (${o.shapes} shapes; ${cls(o.classes)})`);
  const r = profile.analytics_rows;
  console.log(`analytics rows: ${r.returned} returned of row limit ${r.row_limit}; row limit hit: ${r.row_limit_hit ? 'yes' : 'no'}; requests outside the returned rows: ${r.requests_outside_rows} (${(r.share_outside_rows * 100).toFixed(2)}% of total)`);
  if (coverage < COVERAGE_MIN) {
    console.error(`coverage below ${COVERAGE_MIN * 100}%: the profile is not usable`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('build-profile.mjs')) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error('profile build failed:', e.message); process.exitCode = 1; });
}

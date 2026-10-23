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
    if (!hit) continue;
    classes.set(hit[0], (classes.get(hit[0]) ?? 0) + count);
    classifiedCount += count;
  }
  return { classes, excludedCount, classifiedCount };
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
      top: httpRequestsAdaptiveGroups(limit: 10000, orderBy: [count_DESC], filter: ${filter}) { count dimensions { clientRequestPath } }
    } } }`, { zone: zone.zoneTag });
  const z = data.viewer.zones[0];
  const total = z.total[0]?.count ?? 0;
  const paths = z.top.map((g) => ({ path: g.dimensions.clientRequestPath, count: g.count }));
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
  };
  fs.writeFileSync(out, JSON.stringify(profile, null, 2) + '\n');
  console.log(`profile written: ${profile.classes.length} classes, coverage ${(coverage * 100).toFixed(1)}% of ${countable} counted requests`);
  if (coverage < COVERAGE_MIN) {
    console.error(`coverage below ${COVERAGE_MIN * 100}%: the profile is not usable`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('build-profile.mjs')) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error('profile build failed:', e.message); process.exitCode = 1; });
}

#!/usr/bin/env node
// Builds the load generator's sample file from a site's sitemap: for each route template in the profile, a deterministic
// list of concrete paths (sorted, first N). Read-only (one GET of the sitemap). Writes JSON to OUT.
// Env: SITE (required, e.g. the staging site address), PROFILE (path to the load profile JSON), OUT, PER_TEMPLATE (default 50).
import fs from 'node:fs';

/** Pure. A route template to a regular expression. [[...x]] matches any depth; [x] matches one segment. */
export function templateToRegex(template) {
  if (template === '/') return /^\/$/;
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);
  const src = escaped
    .replace(/\\\[\\\[\\\.\\\.\\\.[^\]]*\\\]\\\]/g, '.*')
    .replace(/\\\[[^\]]*\\\]/g, '[^/]+');
  return new RegExp(`^${src}/?$`);
}

/** Pure. Groups site paths under the most specific profile template they match. Paths with query strings are skipped. */
export function groupPaths(paths, templates) {
  const ordered = [...templates].sort((a, b) => b.length - a.length);
  const regexes = ordered.map((t) => [t, templateToRegex(t)]);
  const groups = new Map(templates.map((t) => [t, []]));
  for (const p of paths) {
    if (p.includes('?')) continue;
    const hit = regexes.find(([, re]) => re.test(p));
    if (hit) groups.get(hit[0]).push(p);
  }
  return groups;
}

/** Pure. Deterministic sample: the first `per` paths in sorted order, for each template that has any paths. */
export function samplesFrom(groups, per) {
  const out = {};
  for (const [t, list] of groups) {
    if (list.length === 0) continue;
    out[t] = [...new Set(list)].sort().slice(0, per);
  }
  return out;
}

/**
 * Pure. The <loc> entries of a sitemap, as paths. The host is ignored: a staging sitemap may list production addresses
 * (it did on 23 Oct 2026), and the paths are what the load generator sends to its own site.
 */
export function pathsFromSitemap(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => { try { const u = new URL(m[1].trim()); return u.pathname + u.search; } catch { return null; } })
    .filter((p) => p !== null);
}

async function main() {
  const site = process.env.SITE;
  if (!site) { console.error('SITE is required'); return 2; }
  const profile = JSON.parse(fs.readFileSync(process.env.PROFILE || 'load-profile.json', 'utf8'));
  const per = Number(process.env.PER_TEMPLATE || 50);
  const res = await fetch(`${site.replace(/\/$/, '')}/sitemap.xml`, { redirect: 'manual' });
  if (!res.ok) { console.error(`sitemap HTTP ${res.status}`); return 1; }
  const paths = pathsFromSitemap(await res.text());
  const templates = profile.classes.map((c) => c.template);
  const samples = samplesFrom(groupPaths(paths, templates), per);
  const missing = templates.filter((t) => !samples[t]);
  fs.writeFileSync(process.env.OUT || 'load-samples.json', JSON.stringify(samples, null, 2) + '\n');
  console.log(`samples: ${Object.keys(samples).length} of ${templates.length} templates have paths; ${missing.length} have none (not sampled)`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('gen-samples.mjs')) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error('sample build failed:', e.message); process.exitCode = 1; });
}

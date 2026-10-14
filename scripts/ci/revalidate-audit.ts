/**
 * P10 item 1: every route's EFFECTIVE revalidate vs its INTENDED cadence
 * (src/lib/route-cadence.ts). Fails (exit 1) on any difference, any route
 * missing from the registry, or any sample that can't be measured.
 *
 *   effective, build-time routes:  .next/prerender-manifest.json initialRevalidateSeconds
 *                                  (already the lowest of segment config and every read)
 *   effective, per-param ISR:      a render against a server started with
 *                                  REVALIDATE_AUDIT=1 (next.config.mjs drops its fixed
 *                                  Cache-Control hints, so the response carries Next's own
 *                                  s-maxage = the render's effective revalidate)
 *   dynamic (ƒ) routes:            neither in the prerender manifest's routes nor its
 *                                  dynamicRoutes
 *
 *   AUDIT_BASE=http://localhost:3000 AUDIT_SAMPLES=ci npx tsx scripts/ci/revalidate-audit.ts
 *   AUDIT_SAMPLES=<file.json>  {"/news/[slug]": ["/news/some-slug"], "/sets/[slug]#priced": [...], ...}
 * Writes a markdown table to stdout (and to GITHUB_STEP_SUMMARY in Actions).
 */
import fs from 'node:fs';
import { ROUTE_CADENCE, STATIC, DYNAMIC, type Cadence } from '../../src/lib/route-cadence';

const BASE = (process.env.AUDIT_BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const YEAR = 31536000;

// CI samples: stub fixtures (scripts/ci/supabase-stub.mjs, jsonld-price-fixtures.mjs).
const CI_SAMPLES: Record<string, string[]> = {
  '/sets/[slug]#priced': ['/sets/99002-ci-fixture-set-99002'],
  '/sets/[slug]#unpriced': ['/sets/99004-ci-fixture-set-99004'],
  '/news/[slug]': ['/news/ci-fixture'],
  '/reviews/[slug]': ['/reviews/ci-fixture'],
  '/guides/[slug]': ['/guides/ci-fixture'],
  '/community/[slug]': ['/community/ci-fixture'],
  '/themes/[theme]': ['/themes/city'],
};

type Row = { route: string; kind: string; intended: string; effective: string; ok: boolean; note?: string };
const show = (v: number | false | string) => (v === false ? 'static (per deploy)' : typeof v === 'number' ? `${v} s (${v >= 86400 ? v / 86400 + ' d' : v / 3600 + ' h'})` : v);

async function measure(path: string): Promise<{ status: number; seconds: number | false | null; header: string }> {
  const r = await fetch(`${BASE}${path}`, { headers: { 'x-forwarded-proto': 'https' }, redirect: 'manual' });
  const cc = r.headers.get('cache-control') ?? '';
  await r.arrayBuffer();
  const m = /s-maxage=(\d+)/.exec(cc);
  const seconds = m ? (Number(m[1]) >= YEAR ? false : Number(m[1])) : null;
  return { status: r.status, seconds, header: cc };
}

(async () => {
  const pm = JSON.parse(fs.readFileSync('.next/prerender-manifest.json', 'utf8'));
  const appRoutes: string[] = [...new Set(Object.values(JSON.parse(fs.readFileSync('.next/app-path-routes-manifest.json', 'utf8'))) as string[])].sort();
  const samples: Record<string, string[]> = process.env.AUDIT_SAMPLES === 'ci' || !process.env.AUDIT_SAMPLES
    ? CI_SAMPLES : JSON.parse(fs.readFileSync(process.env.AUDIT_SAMPLES, 'utf8'));

  const built = new Map<string, Set<number | false>>();
  for (const [r, v] of Object.entries<any>(pm.routes)) {
    const src = v.srcRoute ?? r;
    (built.get(src) ?? built.set(src, new Set()).get(src)!).add(v.initialRevalidateSeconds);
  }
  const isrParams = new Set(Object.keys(pm.dynamicRoutes ?? {}));
  const rows: Row[] = [];
  const want = (c: Cadence, part?: 'priced' | 'unpriced'): number | false | string =>
    c === STATIC ? false : typeof c === 'object' ? c[part!] : c;

  for (const route of appRoutes) {
    const c = ROUTE_CADENCE[route];
    if (c === undefined) { rows.push({ route, kind: '?', intended: 'MISSING from route-cadence.ts', effective: '-', ok: false }); continue; }
    if (isrParams.has(route)) {
      const parts: (undefined | 'priced' | 'unpriced')[] = typeof c === 'object' ? ['priced', 'unpriced'] : [undefined];
      for (const part of parts) {
        const key = part ? `${route}#${part}` : route;
        const paths = samples[key] ?? [];
        if (!paths.length) { rows.push({ route: key, kind: 'ISR (per param)', intended: show(want(c, part)), effective: 'no sample', ok: false }); continue; }
        for (const p of paths) {
          const m = await measure(p);
          const ok = m.status === 200 && m.seconds === want(c, part);
          rows.push({ route: key, kind: 'ISR (per param)', intended: show(want(c, part)), effective: m.seconds === null ? `unmeasured (${m.status} ${m.header || 'no cache-control'})` : show(m.seconds), ok, note: `${p} -> ${m.status}` });
        }
      }
    } else if (built.has(route)) {
      const vals = [...built.get(route)!];
      const eff = vals.length === 1 ? vals[0] : `mixed ${vals.join('/')}`;
      rows.push({ route, kind: 'build-time', intended: show(want(c)), effective: show(eff as any), ok: vals.length === 1 && vals[0] === want(c) });
    } else {
      rows.push({ route, kind: 'dynamic', intended: show(c as string), effective: DYNAMIC, ok: c === DYNAMIC });
    }
  }
  for (const r of Object.keys(ROUTE_CADENCE)) if (!appRoutes.includes(r)) rows.push({ route: r, kind: '-', intended: 'registered', effective: 'route no longer exists', ok: false });

  const table = ['| Route | Kind | Intended | Effective | OK | Sample |', '|---|---|---|---|---|---|',
    ...rows.map((r) => `| \`${r.route}\` | ${r.kind} | ${r.intended} | ${r.effective} | ${r.ok ? '✅' : '❌'} | ${r.note ?? ''} |`)].join('\n');
  console.log(table);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Revalidate audit (P10)\n${table}\n`);
  const bad = rows.filter((r) => !r.ok);
  if (bad.length) {
    for (const b of bad) console.log(`::error::revalidate audit: ${b.route} intended ${b.intended}, effective ${b.effective}`);
    process.exit(1);
  }
  console.log(`PASS: ${rows.length} routes/samples at their intended cadence`);
})().catch((e) => { console.error(e); process.exit(1); });

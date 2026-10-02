/**
 * P10 item 4: read-only scan of every published review, news article and guide
 * for gift-with-purchase sets carrying a price claim. Writes NOTHING to the
 * database. Output -> GWP_SCAN_OUT (default boi-db-backups/gwp-scan) as JSON +
 * markdown, for the #246 correction batches (G16).
 *
 *   npx tsx scripts/gwp-price-scan.ts
 *
 * GWP = Brickset availability "LEGO Gift with Purchase" (one batched getSets
 * per 100 set numbers, cached) OR sets.is_gwp. A finding = a sentence in an
 * article about a GWP set (it links /sets/<n>-... or names <n> in its title)
 * that states a price-like figure (₹ / $ / £ / €) and is not a spend-threshold
 * statement and does not say the set is not sold separately (lib: gwpPriceClaims).
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '../src/lib/get-secret';
import { gwpPriceClaims } from '../src/lib/gate14';

dotenv.config({ path: '.env.local', quiet: true });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSecret('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const OUT = process.env.GWP_SCAN_OUT ?? 'C:/Users/bharg/boi-db-backups/gwp-scan';
fs.mkdirSync(OUT, { recursive: true });

async function all<T>(q: (a: number, b: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; ; off += 1000) { const { data, error } = await q(off, off + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break; }
  return out;
}

(async () => {
  const tables = [
    { t: 'reviews', path: '/reviews/' }, { t: 'news_articles', path: '/news/' }, { t: 'guides', path: '/guides/' },
  ];
  const articles: { table: string; url: string; title: string; content: string; published_at: string; sets: Set<string>; subject: Set<string> }[] = [];
  for (const { t, path: p } of tables) {
    for (const r of await all<any>((a, b) => sb.from(t).select('slug, title, content, published_at').range(a, b))) {
      const content = String(r.content ?? '');
      const sets = new Set([...content.matchAll(/\]\(\/sets\/(\d{4,7})-/g)].map((m) => m[1]));
      const subject = new Set([...String(r.title ?? '').matchAll(/\b(\d{4,7})\b/g)].map((m) => m[1]).filter((n) => !/^(19|20)\d\d$/.test(n)));
      for (const n of subject) sets.add(n);
      articles.push({ table: t, url: `${p}${r.slug}`, title: r.title, content, published_at: r.published_at, sets, subject });
    }
  }
  const allSets = [...new Set(articles.flatMap((a) => [...a.sets]))].sort();

  // GWP classification: Brickset availability (cached), plus sets.is_gwp
  const cacheFile = path.join(OUT, 'brickset-availability.json');
  const cache: Record<string, string | null> = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  const need = allSets.filter((n) => !(n in cache));
  let calls = 0;
  for (let i = 0; i < need.length; i += 100) {  // 100 per call: a longer GET URL comes back empty
    const chunk = need.slice(i, i + 100);
    const params = JSON.stringify({ setNumber: chunk.map((n) => `${n}-1`).join(','), pageSize: 500 });
    const res = await fetch(`https://brickset.com/api/v3.asmx/getSets?apiKey=${encodeURIComponent(getSecret('BRICKSET_API_KEY')!)}&userHash=&params=${encodeURIComponent(params)}`);
    const text = await res.text();
    calls++;
    if (!text) throw new Error(`Brickset: empty response (HTTP ${res.status})`);
    const j = JSON.parse(text);
    if (j.status !== 'success') throw new Error(`Brickset: ${j.message ?? j.status}`);
    for (const n of chunk) cache[n] = null;
    for (const s of j.sets ?? []) cache[String(s.number)] = s.availability ?? null;
  }
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1));
  const flagged = new Set<string>();
  for (let i = 0; i < allSets.length; i += 200) {
    const { data, error } = await sb.from('sets').select('set_number, is_gwp').in('set_number', allSets.slice(i, i + 200));
    if (error) throw error;
    for (const r of data ?? []) if (r.is_gwp) flagged.add(r.set_number);
  }
  // Brickset wins where it has an answer: a flag-only set Brickset lists as retail (30730, 40919) is
  // reported as a flag error, not scanned. A GWP an Indian store sells on its own is not "no price".
  const listed = new Set<string>();
  const storePrices = new Map<string, number[]>();
  for (let i = 0; i < allSets.length; i += 200) {
    const { data, error } = await sb.from('store_prices').select('set_id, price_inr').in('set_id', allSets.slice(i, i + 200));
    if (error) throw error;
    for (const r of data ?? []) { listed.add(r.set_id); (storePrices.get(r.set_id) ?? storePrices.set(r.set_id, []).get(r.set_id)!).push(Number(r.price_inr)); }
  }
  // Group B: GWPs an Indian store sells on its own. A price is fine there, but an invented
  // "estimated import" figure that isn't the listing's price is still wrong.
  const gwpSold = new Set(allSets.filter((n) => cache[n] === 'LEGO Gift with Purchase' && listed.has(n)));
  const inrs = (t: string) => [...t.matchAll(/₹\s?(\d{1,3}(?:,\d{2,3})+|\d+)/g)].map((m) => Number(m[1].replace(/,/g, '')));
  const gwp = new Set(allSets.filter((n) => (cache[n] === 'LEGO Gift with Purchase' || (flagged.has(n) && cache[n] == null)) && !listed.has(n)));

  // findings: articles whose SUBJECT (title) is a GWP set get every price sentence checked; articles that only
  // link a GWP set get the sentences that name that set checked.
  const findings: any[] = [];
  for (const a of articles) {
    const gwpSubject = [...a.subject].filter((n) => gwp.has(n));
    const gwpLinked = [...a.sets].filter((n) => gwp.has(n) && !a.subject.has(n));
    if (!gwpSubject.length && !gwpLinked.length) continue;
    const claims = [
      ...(gwpSubject.length ? gwpPriceClaims(a.content, undefined, gwpSubject).map((s) => ({ set: gwpSubject.join(','), sentence: s })) : []),
      ...gwpLinked.flatMap((n) => gwpPriceClaims(a.content, n).map((s) => ({ set: n, sentence: s }))),
    ];
    const seen = new Set<string>();
    const uniq = claims.filter((c) => (seen.has(c.sentence) ? false : (seen.add(c.sentence), true)));
    if (uniq.length) findings.push({ url: a.url, table: a.table, title: a.title, published_at: a.published_at, gwp_sets: [...gwpSubject, ...gwpLinked], claims: uniq });
  }
  findings.sort((x, y) => x.url.localeCompare(y.url));

  const findingsSold: any[] = [];
  for (const a of articles) {
    const hit = [...a.sets].filter((n) => gwpSold.has(n));
    if (!hit.length) continue;
    const claims = hit.flatMap((n) => (a.subject.has(n) ? gwpPriceClaims(a.content, undefined, [n]) : gwpPriceClaims(a.content, n))
      .filter((t) => /import|estimat/i.test(t) || !inrs(t).length || inrs(t).some((v) => !(storePrices.get(n) ?? []).some((p) => Math.abs(p - v) <= 1)))
      .filter((t) => !inrs(t).length || inrs(t).some((v) => !(storePrices.get(n) ?? []).some((p) => Math.abs(p - v) <= 1)))
      .map((t) => ({ set: n, sentence: t, listed_inr: storePrices.get(n) })));
    if (claims.length) findingsSold.push({ url: a.url, table: a.table, title: a.title, published_at: a.published_at, gwp_sets: hit, claims });
  }
  findingsSold.sort((x, y) => x.url.localeCompare(y.url));

  const summary = {
    articles: articles.length, sets_referenced: allSets.length, gwp_sets: gwp.size, gwp_by_brickset: allSets.filter((n) => cache[n] === 'LEGO Gift with Purchase').length,
    flag_wrong: [...flagged].filter((n) => cache[n] != null && cache[n] !== 'LEGO Gift with Purchase').map((n) => `${n}: Brickset "${cache[n]}"`),
    flag_missing: allSets.filter((n) => cache[n] === 'LEGO Gift with Purchase' && !flagged.has(n)),
    gwp_sold_in_india: allSets.filter((n) => cache[n] === 'LEGO Gift with Purchase' && listed.has(n)),
    articles_with_findings: findings.length, claims: findings.reduce((k, f) => k + f.claims.length, 0),
    sold_articles_with_findings: findingsSold.length, sold_claims: findingsSold.reduce((k, f) => k + f.claims.length, 0), brickset_calls: calls,
  };
  fs.writeFileSync(path.join(OUT, 'gwp-price-scan.json'), JSON.stringify({ summary, gwp_sets: [...gwp].sort(), findings, findings_sold_in_india: findingsSold }, null, 1));
  const md = [`# GWP price-claim scan (${new Date().toISOString().slice(0, 10)})`, '```json', JSON.stringify(summary, null, 1), '```',
    '## A. GWPs not sold separately in India: any price claim is wrong',
    ...findings.map((f) => `### ${f.url}\n${f.title} · GWP ${f.gwp_sets.join(', ')} · ${String(f.published_at).slice(0, 10)}\n${f.claims.map((c: any) => `- (${c.set}) ${c.sentence.replace(/\n/g, ' ')}`).join('\n')}`)].join('\n\n');
  const mdSold = ['## B. GWPs an Indian store sells on its own: invented figures that are not the listing',
    ...findingsSold.map((f) => `### ${f.url}\n${f.title} · ${f.gwp_sets.join(', ')} · ${String(f.published_at).slice(0, 10)}\n${f.claims.map((c: any) => `- (${c.set}, listed ₹${(c.listed_inr ?? []).join('/')}) ${c.sentence.replace(/\n/g, ' ')}`).join('\n')}`)].join('\n\n');
  fs.writeFileSync(path.join(OUT, 'gwp-price-scan.md'), md + '\n\n' + mdSold);
  console.log(JSON.stringify(summary, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });

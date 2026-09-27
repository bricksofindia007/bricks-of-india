/**
 * Read-only review fact audit (open item #21, full-history review
 * authenticity; 2026-09-27). Checks every published review deterministically
 * against the catalogue and store data and REPORTS mismatches by severity.
 * Writes nothing to the database.
 *
 *   npx tsx scripts/audit-review-facts.ts   -> docs/review-fact-audit/<date>.{md,json}
 *
 * Checks (per review, against its linked sets row):
 *   - link: set_id missing or pointing at no sets row
 *   - set number: a catalogue set number in the TITLE that is not the linked set
 *   - name: the linked set's catalogue name not recognisable in the title/opening
 *   - piece count: "<n> pieces / <n>-piece" claims vs sets.pieces
 *       ("over n" must be just above n, "around/about n" within 5%, bare n exact)
 *   - year: "released/launched/arrives ... <year>" vs sets.year
 *   - import price: any ₹ figure in an "import"/"estimated" sentence. HIGH when the
 *     set has a store row (it is sold in India, so the figure is invented or stale).
 * Sentences that compare against OTHER sets (another set number, "other",
 * "compared", "than", "similar") are reported as LOW context hits, not errors.
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '../src/lib/get-secret';
import { nameMatchesText } from '../src/lib/set-identity';

dotenv.config({ path: '.env.local', quiet: true });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSecret('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

type Severity = 'HIGH' | 'MEDIUM' | 'LOW';
type Finding = { severity: Severity; check: string; slug: string; set: string | null; detail: string };

async function all<T>(q: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await q(off, off + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
const sentences = (t: string) => t.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
const num = (s: string) => Number(s.replace(/,/g, ''));
const COMPARISON = /\b(other|compared|than|similar|versus|vs\.?|typical|average|most)\b/i;
const PIECES_RE = /(?<![₹\d.,])(?:(just over|over|more than|nearly|almost|around|about|roughly|approximately|some|under|fewer than)\s+)?(\d{1,3}(?:,\d{3})+|\d{2,5})\s*(?:[-‑–]\s*)?(pieces?|pcs|elements)\b/gi;
const RELEASE_RE = /\b(released|launch(?:ed|es|ing)?|arriv(?:ed|es|ing)|debut(?:ed|s)?|hit shelves|came out|out in)\b/i;

(async () => {
  const reviews = await all<any>((a, b) => sb.from('reviews').select('id, slug, title, content, verdict, set_id').range(a, b));
  const sets = await all<any>((a, b) => sb.from('sets').select('id, set_number, name, pieces, year').range(a, b));
  const byId = new Map(sets.map((s) => [s.id, s]));
  const byNumber = new Map(sets.map((s) => [s.set_number, s]));
  const stocked = new Set((await all<any>((a, b) => sb.from('store_prices').select('set_id').range(a, b))).map((r) => r.set_id));
  const f: Finding[] = [];

  for (const r of reviews) {
    const set = r.set_id ? byId.get(r.set_id) : null;
    if (!set) {
      f.push({ severity: 'HIGH', check: 'link', slug: r.slug, set: null, detail: `set_id ${r.set_id ?? 'NULL'} matches no sets row` });
      continue;
    }
    const text: string = r.content ?? '';

    for (const n of (r.title ?? '').match(/(?<![\d₹,])\d{4,6}(?![\d,])/g) ?? []) {
      const other = byNumber.get(n);
      if (n !== set.set_number && other && !nameMatchesText(other.name, r.title)) {
        f.push({ severity: 'HIGH', check: 'set number', slug: r.slug, set: set.set_number, detail: `title cites ${n} ("${other.name}") but the review is linked to ${set.set_number}` });
      }
    }
    if (!nameMatchesText(set.name, `${r.title} ${text.slice(0, 600)}`)) {
      f.push({ severity: 'MEDIUM', check: 'name', slug: r.slug, set: set.set_number, detail: `catalogue name "${set.name}" not recognisable in the title/opening; title: "${r.title}"` });
    }

    for (const s of sentences(text)) {
      if (set.pieces) {
        for (const m of s.matchAll(PIECES_RE)) {
          const q = (m[1] ?? '').toLowerCase();
          const n = num(m[2]);
          const p = set.pieces;
          let ok: boolean;
          if (/over|more than/.test(q)) ok = p > n && p <= n * 1.1;
          else if (/under|fewer than/.test(q)) ok = p < n && p >= n * 0.9;
          else if (q) ok = Math.abs(p - n) <= Math.max(2, p * 0.05);
          else ok = n === p;
          if (ok) continue;
          const context = COMPARISON.test(s) || [...s.matchAll(/\b\d{4,6}\b/g)].some((x) => x[0] !== set.set_number && byNumber.has(x[0]));
          // Within 2% is catalogue-vs-box counting (spare parts), not an error; a
          // negated claim ("this isn't the 10,000-piece monster") asserts nothing.
          const near = Math.abs(n - p) <= p * 0.02;
          if (/\b(isn['’]t|is not|not a|not the)\b[^.]{0,20}$/i.test(s.slice(0, m.index ?? 0))) continue;
          const note = near ? ' (within 2%: box vs catalogue count)' : context ? ' (comparison sentence, may refer to another set)' : '';
          f.push({ severity: context || near ? 'LOW' : 'HIGH', check: 'piece count', slug: r.slug, set: set.set_number, detail: `says "${m[0]}"; catalogue ${p} pieces${note}: "${s.slice(0, 160)}"` });
        }
      }
      if (set.year && RELEASE_RE.test(s)) {
        for (const y of s.match(/\b(19[5-9]\d|20[0-3]\d)\b/g) ?? []) {
          if (Number(y) !== set.year && !COMPARISON.test(s) && !/\b(original|first|since|back in|anniversary|retir)/i.test(s)) {
            f.push({ severity: 'LOW', check: 'year', slug: r.slug, set: set.set_number, detail: `mentions ${y}; catalogue year ${set.year}: "${s.slice(0, 140)}"` });
          }
        }
      }
      if (/₹\s?[\d,]+/.test(s) && /\b(import|estimat)/i.test(s)) {
        const sold = stocked.has(set.set_number);
        f.push({ severity: sold ? 'HIGH' : 'MEDIUM', check: 'import price', slug: r.slug, set: set.set_number, detail: `${sold ? 'set IS sold in India (store row exists)' : 'no store row'}: "${s.slice(0, 160)}"` });
      }
    }
  }

  const order: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  f.sort((a, b) => order[a.severity] - order[b.severity] || a.check.localeCompare(b.check) || a.slug.localeCompare(b.slug));
  const count = (sev: Severity, check?: string) => f.filter((x) => x.severity === sev && (!check || x.check === check)).length;
  const checks = ['link', 'set number', 'name', 'piece count', 'year', 'import price'];
  const reviewsWithHigh = new Set(f.filter((x) => x.severity === 'HIGH').map((x) => x.slug)).size;
  const sevs: Severity[] = ['HIGH', 'MEDIUM', 'LOW'];
  const lines = [
    `# Review fact audit (${new Date().toISOString().slice(0, 16)}Z, read-only)`, '',
    `${reviews.length} reviews checked against ${sets.length} catalogue sets and current store rows. ${reviewsWithHigh} reviews have at least one HIGH finding.`, '',
    '| check | HIGH | MEDIUM | LOW |', '|---|---|---|---|',
    ...checks.map((c) => `| ${c} | ${count('HIGH', c)} | ${count('MEDIUM', c)} | ${count('LOW', c)} |`), '',
    ...sevs.flatMap((sev) => [`## ${sev} (${count(sev)})`, '', ...f.filter((x) => x.severity === sev).map((x) => `- **${x.check}** · \`${x.slug}\`${x.set ? ` (${x.set})` : ''}: ${x.detail}`), '']),
  ];
  const dir = path.join('docs', 'review-fact-audit');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(dir, `${stamp}.md`), lines.join('\n'));
  fs.writeFileSync(path.join(dir, `${stamp}.json`), JSON.stringify(f, null, 1));
  console.log(`reviews=${reviews.length} findings=${f.length} HIGH=${count('HIGH')} MEDIUM=${count('MEDIUM')} LOW=${count('LOW')} reviewsWithHigh=${reviewsWithHigh}`);
  for (const c of checks) console.log(`  ${c.padEnd(12)} H=${count('HIGH', c)} M=${count('MEDIUM', c)} L=${count('LOW', c)}`);
})().catch((e) => { console.error(e); process.exit(1); });

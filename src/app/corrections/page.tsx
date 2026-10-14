import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/metadata';
import { createServerClient } from '@/lib/supabase';
import { extractCorrections, STORE_RENAME_NOTE, noteParts, groupKey, groupLabel, GROUP_MIN, type NotePart } from '@/lib/corrections';

// FP7.6 (3 Oct 2026): every dated correction on the site, newest first, linked to the page it fixed.
export const revalidate = 86400; // = READ_REVALIDATE_SECONDS (src/lib/route-cadence.ts; segment config must be a literal)

export const metadata: Metadata = buildMetadata({
  title: 'Corrections',
  description: 'Every correction we have made on Bricks of India, with the date and the page it fixed.',
  path: '/corrections',
});

type Row = { date: string; text: string; href: string; title: string };
const SOURCES = [
  { table: 'news_articles', path: '/news' },
  { table: 'reviews', path: '/reviews' },
  { table: 'guides', path: '/guides' },
] as const;

async function loadCorrections(): Promise<{ rows: Row[]; renameCount: number; renameDate: string | null }> {
  const sb = createServerClient({ revalidate: 86400 });
  const rows: Row[] = [];
  let renameCount = 0, renameDate: string | null = null;
  for (const { table, path } of SOURCES) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(table).select('slug, title, content').range(from, from + 999);
      if (error || !data) break;
      for (const r of data as { slug: string; title: string; content: string | null }[]) {
        for (const n of extractCorrections(r.content)) {
          if (STORE_RENAME_NOTE.test(n.text)) {
            renameCount++;
            if (renameDate === null || n.date > (renameDate as string)) renameDate = n.date;
            continue;
          }
          rows.push({ ...n, href: `${path}/${r.slug}`, title: r.title });
        }
      }
      if (data.length < 1000) break;
    }
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));
  return { rows, renameCount, renameDate };
}

type Item = { kind: 'one'; row: Row } | { kind: 'group'; date: string; label: string; rows: Row[] };
function toItems(rows: Row[]): Item[] {
  const groups = new Map<string, Row[]>();
  for (const r of rows) (groups.get(groupKey(r.date, r.text)) ?? groups.set(groupKey(r.date, r.text), []).get(groupKey(r.date, r.text))!).push(r);
  const done = new Set<string>(); const out: Item[] = [];
  for (const r of rows) {
    const k = groupKey(r.date, r.text); const g = groups.get(k)!;
    if (g.length < GROUP_MIN) { out.push({ kind: 'one', row: r }); continue; }
    if (done.has(k)) continue;
    done.add(k); out.push({ kind: 'group', date: r.date, label: groupLabel(r.text, g.length), rows: g });
  }
  return out;
}

function Note({ parts }: { parts: NotePart[] }) {
  return <>{parts.map((p, i) => (p.href ? <Link key={i} href={p.href} className="underline hover:no-underline">{p.text}</Link> : <span key={i}>{p.text}</span>))}</>;
}

function fmt(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
}

export default async function CorrectionsPage() {
  const { rows, renameCount, renameDate } = await loadCorrections();
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-heading text-dark text-5xl mb-2">CORRECTIONS</h1>
        <div className="font-body text-gray-600 leading-relaxed space-y-4 mb-10">
          <p>We get things wrong sometimes. When we do, we fix the page itself, leave a dated note on it saying what changed, and list it here. No quiet edits, no pretending it never happened.</p>
          <p>Spotted something we got wrong? <Link href="/contact" className="underline hover:no-underline">Tell us</Link> and we&apos;ll fix it.</p>
        </div>
        {renameCount > 0 && renameDate && (
          <div className="border-2 border-border rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-400 mb-1">{fmt(renameDate)}</p>
            <p className="font-body text-dark">MyBrickHouse&apos;s online store is now LEGO.in. We updated the store name on {renameCount.toLocaleString('en-US')} pages.</p>
          </div>
        )}
        {rows.length === 0 ? (
          <p className="font-body text-gray-600">No corrections yet.</p>
        ) : (
          <ul className="space-y-4">
            {toItems(rows).map((it, i) => it.kind === 'one' ? (
              <li key={`${it.row.href}-${i}`} className="border-2 border-border rounded-xl p-4">
                <p className="text-sm text-gray-400 mb-1">{fmt(it.row.date)} · <Link href={it.row.href} className="underline hover:no-underline">{it.row.title}</Link></p>
                <p className="font-body text-dark"><Note parts={noteParts(it.row.text)} /></p>
              </li>
            ) : (
              <li key={`group-${it.date}-${i}`} className="border-2 border-border rounded-xl p-4">
                <p className="text-sm text-gray-400 mb-1">{fmt(it.date)}</p>
                <p className="font-body text-dark">{it.label}</p>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-gray-600">Show the {it.rows.length} pages</summary>
                  <ul className="mt-2 space-y-1 list-disc pl-5">
                    {it.rows.map((r) => <li key={r.href}><Link href={r.href} className="underline hover:no-underline">{r.title}</Link></li>)}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

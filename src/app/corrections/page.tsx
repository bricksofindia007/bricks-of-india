import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/metadata';
import { createServerClient } from '@/lib/supabase';
import { extractCorrections, STORE_RENAME_NOTE } from '@/lib/corrections';

// FP7.6 (3 Oct 2026): every dated correction on the site, newest first, linked to the page it fixed.
export const revalidate = 3600; // = READ_REVALIDATE_SECONDS (src/lib/route-cadence.ts; segment config must be a literal)

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
  const sb = createServerClient({ revalidate: 3600 });
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
            {rows.map((r, i) => (
              <li key={`${r.href}-${i}`} className="border-2 border-border rounded-xl p-4">
                <p className="text-sm text-gray-400 mb-1">{fmt(r.date)} · <Link href={r.href} className="underline hover:no-underline">{r.title}</Link></p>
                <p className="font-body text-dark">{r.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

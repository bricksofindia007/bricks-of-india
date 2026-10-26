import type { Metadata } from 'next';
import { cookies, type UnsafeUnwrappedCookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { ADMIN_COOKIE, isValidAdminSession } from '@/lib/admin-session';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { createServerClient } from '@/lib/supabase';
import { buildMetadata } from '@/lib/metadata';

// Owner-only (order 0050, issue 822). Not linked, not in the sitemap, not indexed.
// Off until FEATURE_FLAGS.visitorCounter is true: a 404, with nothing read or written.
export const metadata: Metadata = buildMetadata({
  title: 'Bricks of India',
  absoluteTitle: true,
  description: 'Bricks of India.',
  path: '/admin/visitors',
  robots: { index: false, follow: false },
});

export const dynamic = 'force-dynamic';

const PAGE_CLASSES = ['set', 'theme', 'review', 'news', 'guide', 'lab', 'other'] as const;

type VisitRow = { day: string; page_class: string; views: number };

export default async function VisitorsPage() {
  if (!FEATURE_FLAGS.visitorCounter) notFound();

  const session = (cookies() as unknown as UnsafeUnwrappedCookies).get(ADMIN_COOKIE)?.value;
  if (!(await isValidAdminSession(session))) redirect('/admin/pending');

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await createServerClient()
    .from('visit_daily')
    .select('day, page_class, views')
    .gte('day', since)
    .order('day', { ascending: false });

  const rows: VisitRow[] = error || !data ? [] : (data as VisitRow[]);
  const totals = new Map<string, number>(PAGE_CLASSES.map((c) => [c, 0]));
  for (const r of rows) totals.set(r.page_class, (totals.get(r.page_class) ?? 0) + Number(r.views));

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22 }}>Daily views, last 30 days</h1>
      <p style={{ color: '#444' }}>
        Totals per page group, from the existing traffic reader. Counts include bots as the source counts them. No
        visitor is identified. {error ? 'The totals could not be read.' : ''}
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>Page group</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: 6 }}>Views</th>
          </tr>
        </thead>
        <tbody>
          {PAGE_CLASSES.map((c) => (
            <tr key={c}>
              <td style={{ padding: 6 }}>{c}</td>
              <td style={{ padding: 6, textAlign: 'right' }}>{(totals.get(c) ?? 0).toLocaleString('en-US')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { DELETION_COPY } from '@/lib/legal-copy';

// Approved wording (23 Oct 2026). Off until FEATURE_FLAGS.dataDeletionPage is true. The text still has three bracketed
// fields (timeline, contact address, backup retention) that the owner must supply, so the flag cannot go on yet
// (tests/legal-approved-copy.test.ts). Not indexed.
export const metadata: Metadata = {
  title: 'Delete your BOI account',
  robots: { index: false, follow: false },
};

export default function DataDeletionPage() {
  if (!FEATURE_FLAGS.dataDeletionPage) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-heading text-dark text-4xl mb-6">{DELETION_COPY.heading}</h1>
      <p className="text-dark/80 leading-relaxed">{DELETION_COPY.body}</p>
    </main>
  );
}

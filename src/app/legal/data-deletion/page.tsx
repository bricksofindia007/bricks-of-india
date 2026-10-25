import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { DELETION_COPY } from '@/lib/legal-copy';

// Approved wording (23 Oct 2026; its fields were filled by the owner's approvals of 18 and 23 Oct). Off until
// FEATURE_FLAGS.dataDeletionPage is true. Not indexed.
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

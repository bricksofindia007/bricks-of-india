import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

// Structure only (queue item 4). The request flow needs accounts (H2) and email (H4); the wording comes from the owner
// and Chat. Off until FEATURE_FLAGS.dataDeletionPage is true. Not indexed while it is a placeholder.
export const metadata: Metadata = {
  title: 'Delete your data',
  robots: { index: false, follow: false },
};

const STEPS = [
  'Ask for deletion (signed-in request form)',
  'Confirm by the link we email you',
  'We remove the account, the saved collection and the alert settings',
  'You get a confirmation email when it is done',
];

export default function DataDeletionPage() {
  if (!FEATURE_FLAGS.dataDeletionPage) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-heading text-dark text-4xl mb-6">Delete your data</h1>
      <p className="text-dark/70 mb-4">[Copy pending: owner approval and Chat draft]</p>
      <ol className="list-decimal pl-6 mb-8 text-dark/80">
        {STEPS.map((s) => <li key={s} className="mb-2">{s}</li>)}
      </ol>
      <p className="text-dark/60">[Request form not built: waits for sign-in (H2)]</p>
    </main>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

// Structure only (queue item 4). The 18+ rule wording comes from the owner and Chat; the guardian-consent path is
// not built. Off until FEATURE_FLAGS.ageRulePage is true. Not indexed while it is a placeholder.
export const metadata: Metadata = {
  title: 'Age rule',
  robots: { index: false, follow: false },
};

export default function AgeRulePage() {
  if (!FEATURE_FLAGS.ageRulePage) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-heading text-dark text-4xl mb-6">Age rule</h1>
      <p className="text-dark/70 mb-4">[Copy pending: owner approval and Chat draft]</p>
      <p className="text-dark/60">[Guardian-consent path not built: waits for the consent model (FP7.3)]</p>
    </main>
  );
}

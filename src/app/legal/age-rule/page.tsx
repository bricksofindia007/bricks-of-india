import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { AGE_RULE_COPY } from '@/lib/legal-copy';

// Approved wording (23 Oct 2026). Off until FEATURE_FLAGS.ageRulePage is true, and not to be switched on while the
// approved text still has bracketed fields (tests/legal-approved-copy.test.ts). Not indexed.
export const metadata: Metadata = {
  title: 'Age rule',
  robots: { index: false, follow: false },
};

export default function AgeRulePage() {
  if (!FEATURE_FLAGS.ageRulePage) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-heading text-dark text-4xl mb-6">{AGE_RULE_COPY.heading}</h1>
      <p className="text-dark/80 leading-relaxed">{AGE_RULE_COPY.body}</p>
    </main>
  );
}

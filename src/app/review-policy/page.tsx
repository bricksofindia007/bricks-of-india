import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

// Structure only (queue item 14). The wording comes from the owner and Chat; every section below holds a placeholder.
// Off until FEATURE_FLAGS.reviewPolicyPage is true. Not indexed while it is a placeholder.
export const metadata: Metadata = {
  title: 'Review policy',
  robots: { index: false, follow: false },
};

const SECTIONS = [
  { id: 'how-we-review', heading: 'How we review' },
  { id: 'prices-and-stock', heading: 'Prices and stock' },
  { id: 'affiliate-links', heading: 'Affiliate links' },
  { id: 'corrections', heading: 'Corrections' },
  { id: 'disclaimer', heading: 'Disclaimer' },
] as const;

export default function ReviewPolicyPage() {
  if (!FEATURE_FLAGS.reviewPolicyPage) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-heading text-dark text-4xl mb-6">Review policy</h1>
      {SECTIONS.map((s) => (
        <section key={s.id} id={s.id} className="mb-8">
          <h2 className="font-heading text-dark text-2xl mb-2">{s.heading}</h2>
          <p className="text-dark/70">[Copy pending: owner approval and Chat draft]</p>
        </section>
      ))}
    </main>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { DELETE_BUTTON, DELETE_HEADING, DELETE_PARAGRAPHS } from '@/lib/legal-copy';

export const metadata: Metadata = {
  title: 'Delete my data',
  robots: { index: false, follow: false },
};

export default function DeleteAccountPage() {
  if (!FEATURE_FLAGS.accountsEnabled) notFound();
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-heading text-dark text-5xl mb-8">{DELETE_HEADING}</h1>
        <div className="font-body space-y-6 text-gray-600 leading-relaxed">
          {DELETE_PARAGRAPHS.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        {/* Wired when the account store lands; until then the button is inert. */}
        <button type="button" disabled className="mt-8 font-body text-white bg-dark px-5 py-3 rounded opacity-60">
          {DELETE_BUTTON}
        </button>
      </div>
    </div>
  );
}

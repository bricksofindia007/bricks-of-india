import { notFound } from 'next/navigation';
import Link from 'next/link';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { StandeeLanding } from '@/components/standee/StandeeLanding';

// Landing page for the standee QR code. Off: 404. The copy below is new and needs owner review before the flag is on.
export const dynamic = 'force-dynamic';

export default function StandeePage() {
  if (!FEATURE_FLAGS.standeeTracking) notFound();
  return (
    <main className="max-w-xl mx-auto px-4 py-16">
      <StandeeLanding tag="standee_qr" />
      <h1 className="font-heading text-dark text-3xl mb-4">Welcome to Bricks of India</h1>
      <p className="text-gray-600 mb-6">Browse LEGO sets by theme and see what they cost in India.</p>
      <Link href="/sets" className="text-dark underline">Browse sets</Link>
    </main>
  );
}

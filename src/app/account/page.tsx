import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/metadata';
import { signInOn } from '@/lib/signin-gate';
import { AccountDeleteForm } from './AccountDeleteForm';

// My BOI. Off (404) unless the accounts and sign-in flags are on and the hash key is provisioned. Not indexed.
// The page reads no cookie: the delete routes check the session. The page only offers account deletion for now.
export const metadata: Metadata = buildMetadata({
  title: 'My BOI',
  description: 'Your BOI account.',
  path: '/account',
  robots: { index: false, follow: false },
});

export default function AccountPage() {
  if (!signInOn()) notFound();
  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <h1 className="font-heading text-dark text-4xl mb-6">My BOI</h1>
      <AccountDeleteForm />
    </main>
  );
}

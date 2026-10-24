import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/metadata';
import { signInOn } from '@/lib/signin-gate';
import { SignInForm } from './SignInForm';

// Sign-in page. Off (404) unless the accounts and sign-in flags are on and the hash key is provisioned.
// Not indexed. The page reads no cookie: the form is client-side and the session is set by the verify route.
export const metadata: Metadata = buildMetadata({
  title: 'Sign in',
  description: 'Sign in to your account.',
  path: '/auth',
  robots: { index: false, follow: false },
});

export default function AuthPage() {
  if (!signInOn()) notFound();
  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <h1 className="font-heading text-dark text-4xl mb-6">Sign in</h1>
      <SignInForm />
    </main>
  );
}

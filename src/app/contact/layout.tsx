import type { Metadata } from 'next';

// Issue #110: page.tsx is a Client Component ('use client', uses useFormState),
// and Next.js doesn't allow a metadata export from a Client Component -- this
// sibling layout.tsx is the documented pattern for exactly that case.
export const metadata: Metadata = {
  title: 'Contact Bricks of India — Get in Touch',
  description:
    "Have a question about LEGO prices in India, a set we haven't reviewed, or something else on your mind? Send us a message — we usually reply within 48 hours.",
  alternates: { canonical: 'https://bricksofindia.com/contact' },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}

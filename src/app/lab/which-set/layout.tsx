import type { Metadata } from 'next';

// Issue #110: page.tsx is a Client Component ('use client', quiz state) --
// see src/app/contact/layout.tsx for why a sibling layout.tsx, not a direct
// export, is the fix here.
export const metadata: Metadata = {
  title: 'Which LEGO Set Are You? — A Quiz With Opinions | Bricks of India Lab',
  description:
    'A short quiz that judges your taste and recommends a real LEGO set available in India. No apologies for the honesty.',
  alternates: { canonical: 'https://bricksofindia.com/lab/which-set' },
};

export default function WhichSetLayout({ children }: { children: React.ReactNode }) {
  return children;
}

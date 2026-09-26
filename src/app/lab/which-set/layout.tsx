import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/metadata';

// Issue #110: page.tsx is a Client Component ('use client', quiz state) --
// see src/app/contact/layout.tsx for why a sibling layout.tsx, not a direct
// export, is the fix here.
export const metadata: Metadata = buildMetadata({
  title: 'Which LEGO Set Are You? — A Quiz With Opinions',
  description: 'A short quiz that judges your taste and recommends a real LEGO set available in India. No apologies for the honesty.',
  path: '/lab/which-set',
});

export default function WhichSetLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/metadata';

// Issue #110: page.tsx is a Client Component ('use client', d3 rendering) --
// see src/app/contact/layout.tsx for why a sibling layout.tsx, not a direct
// export, is the fix here.
export const metadata: Metadata = buildMetadata({
  title: 'LEGO Search Pulse — The Lab',
  description: 'Google Trends search interest for LEGO across India, city by city and state by state. See where the obsession actually runs deepest — not where you assume it does.',
  path: '/lab/heat-map',
});

export default function HeatMapLayout({ children }: { children: React.ReactNode }) {
  return children;
}

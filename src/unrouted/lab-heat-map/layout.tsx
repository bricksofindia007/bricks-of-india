import type { Metadata } from 'next';

// Issue #110: page.tsx is a Client Component ('use client', d3 rendering) --
// see src/app/contact/layout.tsx for why a sibling layout.tsx, not a direct
// export, is the fix here.
export const metadata: Metadata = {
  title: 'LEGO Search Pulse — Which Indian City Searches for LEGO Most | Bricks of India Lab',
  description:
    'Google Trends search interest for LEGO across India, city by city and state by state. See where the obsession actually runs deepest — not where you assume it does.',
  alternates: { canonical: 'https://bricksofindia.com/lab/heat-map' },
};

export default function HeatMapLayout({ children }: { children: React.ReactNode }) {
  return children;
}

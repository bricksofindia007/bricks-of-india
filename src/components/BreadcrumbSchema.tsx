'use client';

import { usePathname } from 'next/navigation';

const LABELS: Record<string, string> = {
  compare:  'Compare Prices',
  deals:    'Deals',
  reviews:  'Reviews',
  news:     'News',
  blog:     'Blog',
  themes:   'Themes',
  sets:     'Sets',
  about:    'About',
  contact:  'Contact',
  calendar: 'Release Calendar',
  legal:    'Legal',
};

function segmentLabel(seg: string): string {
  if (LABELS[seg]) return LABELS[seg];
  return seg
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function BreadcrumbSchema() {
  // Real bug, found live in a Netlify credit-usage audit (2026-08-14):
  // headers() is a server-only Dynamic API -- calling it here, in a
  // component rendered unconditionally by the root layout, forced every
  // route in the app into dynamic (per-request) rendering, regardless of
  // any individual page's own revalidate export. usePathname() reads the
  // same current-path value client-side via Next's routing context
  // instead, with no server-side Dynamic API involved -- confirmed via a
  // real production build that this alone restores static/ISR rendering
  // app-wide (see PR description for the before/after route table).
  const pathname = usePathname() ?? '/';
  if (!pathname || pathname === '/') return null;

  const segments = pathname.split('/').filter(Boolean);

  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://www.bricksofindia.com',
    },
    ...segments.map((seg, i) => ({
      '@type': 'ListItem',
      position: i + 2,
      name: segmentLabel(seg),
      item: `https://www.bricksofindia.com/${segments.slice(0, i + 1).join('/')}`,
    })),
  ];

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };

  const json = JSON.stringify(schema).replace(/</g, '\\u003c');

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

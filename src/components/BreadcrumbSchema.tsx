import { headers } from 'next/headers';

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
  const pathname = headers().get('x-pathname') ?? '/';
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

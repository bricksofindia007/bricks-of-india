/**
 * Renders one or more JSON-LD schema objects as <script type="application/ld+json">
 * Place inside <head> via Next.js layout or page components.
 *
 * Usage:
 *   <SchemaLD data={orgSchema} />
 *   <SchemaLD data={[orgSchema, websiteSchema]} />
 */
interface Props {
  data: object | object[];
}

export function SchemaLD({ data }: Props) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ── Shared schema objects ────────────────────────────────────────────────────

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Bricks of India',
  url: 'https://www.bricksofindia.com',
  logo: 'https://www.bricksofindia.com/brand/hero-banner.png',
  email: 'abhinav@bricksofindia.com',
  founder: {
    '@type': 'Person',
    name: 'Abhinav Bhargav',
    jobTitle: 'Founder',
  },
  sameAs: [
    'https://www.youtube.com/@BricksofIndia',
    'https://www.instagram.com/bricksofindia/',
  ],
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Bricks of India',
  url: 'https://www.bricksofindia.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://www.bricksofindia.com/search?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
};

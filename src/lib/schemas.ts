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

export const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Abhinav Bhargav',
  jobTitle: 'Founder, Bricks of India',
  email: 'abhinav@bricksofindia.com',
  url: 'https://www.bricksofindia.com/about',
  description:
    '20+ years in enterprise sales, marketing, and account management. Cornell University. Founder of Bricks of India.',
  sameAs: [
    'https://www.youtube.com/@BricksofIndia',
    'https://www.instagram.com/bricksofindia/',
    'https://www.linkedin.com/in/abhinavbhargav/',
  ],
  alumniOf: { '@type': 'EducationalOrganization', name: 'Cornell University' },
  worksFor: { '@type': 'Organization', name: 'Bricks of India' },
};

export const publisherSchema = {
  '@type': 'Organization',
  name: 'Bricks of India',
  logo: {
    '@type': 'ImageObject',
    url: 'https://www.bricksofindia.com/brand/hero-banner.png',
  },
} as const;

export const authorSchema = {
  '@type': 'Person',
  name: 'Abhinav Bhargav',
  jobTitle: 'Founder, Bricks of India',
  url: 'https://www.bricksofindia.com/about',
} as const;

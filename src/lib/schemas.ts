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

// ── Page-level schema builders ────────────────────────────────────────────────

type SetListItem = {
  name: string;
  set_number: string;
  image_url?: string | null;
  bestPrice: { price_inr: number; buy_url?: string | null } | null;
};

export function buildItemListSchema(
  name: string,
  total: number,
  items: SetListItem[],
  startPosition = 1,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: total,
    itemListElement: items.map((item, i) => {
      const product: Record<string, unknown> = {
        '@type': 'Product',
        name: item.name,
        productID: item.set_number,
        brand: { '@type': 'Brand', name: 'LEGO' },
      };
      if (item.image_url) product.image = item.image_url;
      if (item.bestPrice) {
        product.offers = {
          '@type': 'Offer',
          price: item.bestPrice.price_inr,
          priceCurrency: 'INR',
          url: item.bestPrice.buy_url,
          availability: 'https://schema.org/InStock',
        };
      }
      return { '@type': 'ListItem', position: startPosition + i, item: product };
    }),
  };
}

type StorePrice = {
  price_inr: number;
  product_url?: string | null;
  store_id: string;
  in_stock: boolean;
};

type SetData = {
  name: string;
  set_number: string;
  image_url?: string | null;
  description?: string | null;
  theme?: string | null;
  pieces?: number | null;
};

export function buildProductSchema(
  set: SetData,
  activePrices: StorePrice[],
  slug: string,
  storeNames: Record<string, string>,
) {
  const hasPrices = activePrices.length > 0;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: set.name,
    sku: set.set_number,
    ...(set.image_url && { image: set.image_url }),
    description:
      set.description ||
      `LEGO ${set.theme ? set.theme + ' ' : ''}set ${set.set_number}${set.pieces ? ', ' + set.pieces + ' pieces' : ''}, compare prices across Indian stores`,
    brand: { '@type': 'Brand', name: 'LEGO' },
    ...(hasPrices && {
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'INR',
        lowPrice: activePrices.reduce(
          (min, sp) => (sp.price_inr < min ? sp.price_inr : min),
          activePrices[0].price_inr,
        ),
        highPrice: activePrices.reduce(
          (max, sp) => (sp.price_inr > max ? sp.price_inr : max),
          activePrices[0].price_inr,
        ),
        offerCount: activePrices.length,
        availability: 'https://schema.org/InStock',
        offers: activePrices.map((sp) => ({
          '@type': 'Offer',
          price: sp.price_inr,
          priceCurrency: 'INR',
          url: sp.product_url || `https://bricksofindia.com/sets/${slug}`,
          availability: sp.in_stock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          seller: { '@type': 'Organization', name: storeNames[sp.store_id] ?? sp.store_id },
        })),
      },
    }),
  };
}

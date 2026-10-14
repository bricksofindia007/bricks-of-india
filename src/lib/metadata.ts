import type { Metadata } from 'next';

// One metadata builder for every route (#208, Wave 1 PR-C).
//
// Before: each route hand-built its Metadata. Page titles already ended in
// "| Bricks of India" and layout.tsx's template ("%s | Bricks of India")
// appended it again (22 routes rendered "... | Bricks of India | Bricks of
// India"); layout.tsx hardcoded openGraph.url to the homepage, so every
// static route's og:url pointed at "/"; routes that set their own openGraph
// replaced the layout's object wholesale and emitted no og:url at all; the
// legal routes and /precision had no canonical and fell back to the site-wide
// default description.
//
// buildMetadata() makes the correct shape the only easy shape:
//   - title is given WITHOUT the brand; any trailing "| Bricks of India" /
//     "— Bricks of India" is stripped so the template adds it exactly once
//     (absoluteTitle opts out of the template entirely -- homepage only)
//   - description is required
//   - alternates.canonical and openGraph.url are the same absolute URL
//   - openGraph/twitter always carry an image (the site default unless a
//     page-specific one is given)

export const SITE_URL = 'https://bricksofindia.com';
export const SITE_NAME = 'Bricks of India';
export const DEFAULT_OG_IMAGE = {
  url: '/assets/og-image.jpg',
  width: 1200,
  height: 630,
  alt: 'Bricks of India — LEGO Price Comparison India',
};

const BRAND_SUFFIX = /\s*[|—–-]\s*Bricks of India\s*$/i;

export function stripBrandSuffix(title: string): string {
  let t = title.trim();
  while (BRAND_SUFFIX.test(t)) t = t.replace(BRAND_SUFFIX, '').trim();
  return t;
}

export function canonicalUrl(path: string): string {
  if (!path || path === '/') return SITE_URL;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface BuildMetadataInput {
  /** Page title without the brand suffix -- the root layout's template adds it once. */
  title: string;
  description: string;
  /** Route path, e.g. "/deals" or `/sets/${slug}`. Canonical and og:url are built from it. */
  path: string;
  /** Page-specific social image (absolute or site-relative URL). Omitted/null = site default. */
  image?: string | null;
  /** Social-card overrides where a route deliberately words them differently from the <title>. */
  ogTitle?: string;
  ogDescription?: string;
  ogType?: 'website' | 'article';
  robots?: Metadata['robots'];
  /** Render `title` verbatim with no template (homepage only). */
  absoluteTitle?: boolean;
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const url = canonicalUrl(input.path);
  const title = input.absoluteTitle ? input.title : stripBrandSuffix(input.title);
  const ogTitle = input.ogTitle ?? (input.absoluteTitle ? input.title : `${title} | ${SITE_NAME}`);
  const ogDescription = input.ogDescription ?? input.description;
  const images = input.image ? [{ url: input.image }] : [DEFAULT_OG_IMAGE];

  return {
    title: input.absoluteTitle ? { absolute: title } : title,
    description: input.description,
    alternates: { canonical: url },
    ...(input.robots && { robots: input.robots }),
    openGraph: {
      type: input.ogType ?? 'website',
      locale: 'en_IN',
      siteName: SITE_NAME,
      url,
      title: ogTitle,
      description: ogDescription,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: images.map((i) => i.url),
    },
  };
}

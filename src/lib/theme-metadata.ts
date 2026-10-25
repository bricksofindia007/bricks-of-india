import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/metadata';
import { getThemeCardOgUrl } from '@/lib/themeCard';
import { THEMES } from '@/lib/brand';
import { canonicalThemePath, type ThemeSort } from '@/lib/theme-paging';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

/**
 * Theme pages with no priced set (checked 20 Oct 2026 against the staging restore; Chat rechecks against live before
 * the bundle ships). Behind FEATURE_FLAGS.thinThemeNoindex: while it is off, every theme page is unchanged.
 */
export const NO_PRICED_SET_THEMES: readonly string[] = [
  'nexo-knights',
  'legends-of-chima',
  'bionicle',
  'dreamzzz',
  'dots',
];

/** Whether a theme page is kept out of search (noindex, follow) and left out of the sitemap. */
export function themeIsThin(slug: string): boolean {
  return FEATURE_FLAGS.thinThemeNoindex && NO_PRICED_SET_THEMES.includes(slug);
}

/**
 * Metadata for a theme page. Pages in the default sort are indexed, each with its own canonical (page 1 is the bare
 * theme address). A sorted view is noindex, follow, with its canonical on the default-sort address for the same page,
 * so a sorted list never competes with the default list in search.
 */
export function themeRouteMetadata(slug: string, page: number, sort: ThemeSort | null): Metadata {
  const theme = THEMES.find((t) => t.slug === slug);
  if (!theme) return { title: 'Theme Not Found' };
  return buildMetadata({
    title: page > 1
      ? `LEGO ${theme.name} Sets India 2026 — Page ${page}`
      : `LEGO ${theme.name} Sets India 2026 — Compare Prices`,
    description: `All LEGO ${theme.name} sets available in India. Compare prices across Indian stores and find the best deals.`,
    path: canonicalThemePath(slug, page),
    image: getThemeCardOgUrl(theme.slug),
    ogTitle: `LEGO ${theme.name} Sets India 2026 — Bricks of India`,
    ogDescription: `Compare all LEGO ${theme.name} prices across Indian stores.`,
    ...(sort || themeIsThin(slug) ? { robots: { index: false, follow: true } } : {}),
  });
}

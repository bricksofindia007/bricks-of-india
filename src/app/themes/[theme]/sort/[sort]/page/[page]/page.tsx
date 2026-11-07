import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { loadThemeView } from '@/lib/theme-page-data';
import { themeRouteMetadata } from '@/lib/theme-metadata';
import { isThemeSort, themeHref } from '@/lib/theme-paging';
import { ThemePageBody } from '@/components/themes/ThemePageBody';

// A sorted view, pages 2 and up: noindex, canonical to the default-sort page of the same number.
// Cached daily as an ISR route (queue 1, 23 Oct). generateStaticParams returns none, so each sorted page render on first request and then
// stay cached, the same as the default-sort page. The declaration is what makes Next register the route for caching.
export const revalidate = 86400;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}


interface Props {
  params: Promise<{ theme: string; sort: string; page: string }>;
}

/** Only plain positive whole numbers are pages. Anything else is not a page. */
function pageNumber(raw: string): number | null {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { theme, sort, page } = await props.params;
  const n = pageNumber(page);
  return themeRouteMetadata(theme, n && n > 1 ? n : 1, isThemeSort(sort) ? sort : null);
}

export default async function ThemeSortedPageN(props: Props) {
  const { theme, sort, page } = await props.params;
  const n = pageNumber(page);
  if (!isThemeSort(sort) || n === null || n < 1) notFound();
  if (n === 1) permanentRedirect(themeHref(theme, { sort }));
  if (sort === 'year-desc') permanentRedirect(themeHref(theme, { page: n }));
  const view = await loadThemeView(theme, sort, n);
  if (!view) notFound();
  return <ThemePageBody view={view} />;
}

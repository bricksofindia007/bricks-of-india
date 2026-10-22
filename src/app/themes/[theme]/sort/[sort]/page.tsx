import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { loadThemeView } from '@/lib/theme-page-data';
import { themeRouteMetadata } from '@/lib/theme-metadata';
import { isThemeSort, themeHref } from '@/lib/theme-paging';
import { ThemePageBody } from '@/components/themes/ThemePageBody';

// A sorted view, page one. Sorted views are rendered per request, noindex, and canonical to the default-sort page.
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ theme: string; sort: string }>;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { theme, sort } = await props.params;
  return themeRouteMetadata(theme, 1, isThemeSort(sort) ? sort : null);
}

export default async function ThemeSortedPage(props: Props) {
  const { theme, sort } = await props.params;
  if (!isThemeSort(sort)) notFound();
  // The default order is the default address, not a second copy of it.
  if (sort === 'year-desc') permanentRedirect(themeHref(theme, { page: 1 }));
  const view = await loadThemeView(theme, sort, 1);
  if (!view) notFound();
  return <ThemePageBody view={view} />;
}

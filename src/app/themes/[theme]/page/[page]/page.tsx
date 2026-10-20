import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { loadThemeView } from '@/lib/theme-page-data';
import { themeRouteMetadata } from '@/lib/theme-metadata';
import { themeHref } from '@/lib/theme-paging';
import { ThemePageBody } from '@/components/themes/ThemePageBody';

// Pages 2 and up in the default sort. Each page is built on its first request and cached for a day, like page one.
export const revalidate = 86400;
export const dynamicParams = true;

interface Props {
  params: Promise<{ theme: string; page: string }>;
}

export async function generateStaticParams() {
  return [];
}

/** Only plain positive whole numbers are pages. Anything else is not a page. */
function pageNumber(raw: string): number | null {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { theme, page } = await props.params;
  const n = pageNumber(page);
  return themeRouteMetadata(theme, n && n > 1 ? n : 1, null);
}

export default async function ThemePageN(props: Props) {
  const { theme, page } = await props.params;
  const n = pageNumber(page);
  if (n === null || n < 1) notFound();
  if (n === 1) permanentRedirect(themeHref(theme, { page: 1 }));
  const view = await loadThemeView(theme, 'year-desc', n);
  if (!view) notFound();
  return <ThemePageBody view={view} />;
}
